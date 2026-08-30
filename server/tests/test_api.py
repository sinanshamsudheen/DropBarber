"""Phase 3 API tests — the spec's minimum list: auth, RBAC, tenancy,
customer access, booking concurrency, completion idempotency, reviews.

Runs the real HTTP stack in-process (httpx ASGITransport, via the `client`
fixture from conftest.py) but auth routes make real calls out to the local
Supabase Auth stack (`npx supabase start`), so every test here is skipped if
that isn't reachable — consistent with test_schema.py's approach.
"""

import uuid
from datetime import date, timedelta

import httpx
import pytest

from app.core.config import get_settings


async def _supabase_reachable() -> bool:
    settings = get_settings()
    try:
        async with httpx.AsyncClient(timeout=2.0) as http:
            response = await http.get(f"{settings.supabase_url}/auth/v1/health")
        return response.status_code == 200
    except httpx.HTTPError:
        return False


@pytest.fixture(autouse=True)
async def _skip_if_no_supabase():
    if not await _supabase_reachable():
        pytest.skip("No reachable local Supabase stack for Phase 3 API tests.")


async def _register(client, *, role_hint: str) -> tuple[str, dict]:
    email = f"{role_hint}-{uuid.uuid4().hex[:12]}@example.com"
    response = await client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "password123", "display_name": role_hint.title()},
    )
    assert response.status_code == 201, response.text
    body = response.json()["data"]
    return body["access_token"], body


async def _create_shop(client, owner_token: str) -> str:
    response = await client.post(
        "/api/v1/shops",
        headers={"Authorization": f"Bearer {owner_token}"},
        json={
            "name": f"Shop {uuid.uuid4().hex[:8]}",
            "address_line_1": "1 Main St",
            "city": "Testville",
            "country": "US",
            "latitude": "40.0",
            "longitude": "-73.0",
            "timezone": "America/New_York",
        },
    )
    assert response.status_code == 201, response.text
    shop_id = response.json()["data"]["id"]
    activated = await client.patch(
        f"/api/v1/shops/{shop_id}",
        headers={"Authorization": f"Bearer {owner_token}"},
        json={"status": "active"},
    )
    assert activated.status_code == 200
    return shop_id


async def _create_service(client, owner_token: str, shop_id: str) -> str:
    response = await client.post(
        f"/api/v1/shops/{shop_id}/services",
        headers={"Authorization": f"Bearer {owner_token}"},
        json={"name": "Haircut", "price": "25.00", "currency": "USD"},
    )
    assert response.status_code == 201, response.text
    return response.json()["data"]["id"]


async def _add_barber(client, owner_token: str, shop_id: str, barber_user_id: str) -> str:
    response = await client.post(
        f"/api/v1/shops/{shop_id}/barbers",
        headers={"Authorization": f"Bearer {owner_token}"},
        json={"user_id": barber_user_id, "display_name": "Test Barber"},
    )
    assert response.status_code == 201, response.text
    return response.json()["data"]["id"]


async def _fully_set_up_shop(client) -> dict:
    """Owner + shop + service + barber (with duration + working hours)."""
    owner_token, _ = await _register(client, role_hint="owner")
    shop_id = await _create_shop(client, owner_token)
    service_id = await _create_service(client, owner_token, shop_id)
    barber_token, barber_body = await _register(client, role_hint="barber")
    barber_user_id = str(barber_body["user_id"])
    barber_id = await _add_barber(client, owner_token, shop_id, barber_user_id)

    owner_headers = {"Authorization": f"Bearer {owner_token}"}
    barber_headers = {"Authorization": f"Bearer {barber_token}"}
    await client.put(
        f"/api/v1/shops/{shop_id}/barbers/{barber_id}/services/{service_id}",
        headers=owner_headers,
        json={"is_active": True, "duration_minutes": 15},
    )
    await client.put(
        f"/api/v1/shops/{shop_id}/barbers/{barber_id}/working-hours",
        headers=barber_headers,
        json=[
            {"day_of_week": d, "start_time": "09:00:00", "end_time": "18:00:00", "is_active": True}
            for d in range(7)
        ],
    )
    return {
        "owner_token": owner_token,
        "owner_headers": owner_headers,
        "barber_token": barber_token,
        "barber_headers": barber_headers,
        "shop_id": shop_id,
        "service_id": service_id,
        "barber_id": barber_id,
    }


async def _book(client, customer_headers, shop) -> tuple[httpx.Response, str]:
    target_date = date.today() + timedelta(days=2)
    availability = await client.get(
        f"/api/v1/shops/{shop['shop_id']}/barbers/{shop['barber_id']}/availability",
        params={"service_id": shop["service_id"], "date": target_date.isoformat()},
    )
    assert availability.status_code == 200, availability.text
    slot_time = availability.json()["data"]["slots"][0]["time"]
    start_at = f"{target_date.isoformat()}T{slot_time}-04:00"
    response = await client.post(
        "/api/v1/appointments",
        headers=customer_headers,
        json={
            "shop_id": shop["shop_id"],
            "barber_id": shop["barber_id"],
            "service_id": shop["service_id"],
            "start_at": start_at,
        },
    )
    return response, start_at


# --- Auth -------------------------------------------------------------


async def test_protected_endpoint_rejects_unauthenticated(client):
    response = await client.get("/api/v1/auth/me")
    assert response.status_code == 401


async def test_protected_endpoint_rejects_invalid_jwt(client):
    response = await client.get("/api/v1/auth/me", headers={"Authorization": "Bearer not-a-real-jwt"})
    assert response.status_code == 401


# --- RBAC ---------------------------------------------------------------


async def test_customer_cannot_manage_shop(client):
    shop = await _fully_set_up_shop(client)
    customer_token, _ = await _register(client, role_hint="customer")
    response = await client.post(
        f"/api/v1/shops/{shop['shop_id']}/services",
        headers={"Authorization": f"Bearer {customer_token}"},
        json={"name": "Beard trim", "price": "10.00", "currency": "USD"},
    )
    assert response.status_code == 403


async def test_barber_cannot_perform_owner_only_operation(client):
    shop = await _fully_set_up_shop(client)
    response = await client.post(
        f"/api/v1/shops/{shop['shop_id']}/barbers/{shop['barber_id']}/deactivate",
        headers=shop["barber_headers"],
    )
    assert response.status_code == 403


async def test_owner_permission_allows_service_management(client):
    """The positive case for the same require_shop_permission mechanism the
    two tests above prove rejects unauthorized roles — an owner (who has
    services.create) succeeds where a customer/barber were rejected.
    """
    shop = await _fully_set_up_shop(client)
    response = await client.post(
        f"/api/v1/shops/{shop['shop_id']}/services",
        headers=shop["owner_headers"],
        json={"name": "Beard trim", "price": "10.00", "currency": "USD"},
    )
    assert response.status_code == 201


# --- Tenancy --------------------------------------------------------------


async def test_shop_a_staff_cannot_access_shop_b_customers(client):
    shop_a = await _fully_set_up_shop(client)
    customer_token, _ = await _register(client, role_hint="customer")
    response, _ = await _book(client, {"Authorization": f"Bearer {customer_token}"}, shop_a)
    assert response.status_code == 201, response.text

    other_owner_token, _ = await _register(client, role_hint="otherowner")
    await _create_shop(client, other_owner_token)

    forbidden = await client.get(
        f"/api/v1/shops/{shop_a['shop_id']}/customers",
        headers={"Authorization": f"Bearer {other_owner_token}"},
    )
    assert forbidden.status_code == 403


async def test_shop_a_staff_cannot_access_shop_b_appointment(client):
    shop_a = await _fully_set_up_shop(client)
    customer_token, _ = await _register(client, role_hint="customer")
    response, _ = await _book(client, {"Authorization": f"Bearer {customer_token}"}, shop_a)
    assert response.status_code == 201, response.text
    appointment_id = response.json()["data"]["id"]

    other_owner_token, _ = await _register(client, role_hint="otherowner2")
    await _create_shop(client, other_owner_token)

    forbidden = await client.get(
        f"/api/v1/appointments/{appointment_id}", headers={"Authorization": f"Bearer {other_owner_token}"}
    )
    assert forbidden.status_code == 404  # never confirm existence to an unauthorized caller


# --- Customer access -------------------------------------------------------


async def test_customer_can_access_own_appointment_not_anothers(client):
    shop = await _fully_set_up_shop(client)
    customer_a_token, _ = await _register(client, role_hint="customera")
    response, _ = await _book(client, {"Authorization": f"Bearer {customer_a_token}"}, shop)
    assert response.status_code == 201, response.text
    appointment_id = response.json()["data"]["id"]

    own = await client.get(
        f"/api/v1/appointments/{appointment_id}", headers={"Authorization": f"Bearer {customer_a_token}"}
    )
    assert own.status_code == 200

    customer_b_token, _ = await _register(client, role_hint="customerb")
    forbidden = await client.get(
        f"/api/v1/appointments/{appointment_id}", headers={"Authorization": f"Bearer {customer_b_token}"}
    )
    assert forbidden.status_code == 404


# --- Booking ----------------------------------------------------------------


async def test_booking_conflict_and_cancellation_unblocks(client):
    shop = await _fully_set_up_shop(client)
    customer_token, _ = await _register(client, role_hint="booker")
    customer_headers = {"Authorization": f"Bearer {customer_token}"}

    first, start_at = await _book(client, customer_headers, shop)
    assert first.status_code == 201, first.text
    appointment_id = first.json()["data"]["id"]

    target_date = date.today() + timedelta(days=2)
    conflict = await client.post(
        "/api/v1/appointments",
        headers=customer_headers,
        json={
            "shop_id": shop["shop_id"],
            "barber_id": shop["barber_id"],
            "service_id": shop["service_id"],
            "start_at": start_at,
        },
    )
    assert conflict.status_code == 409
    assert conflict.json()["error"]["code"] == "APPOINTMENT_SLOT_UNAVAILABLE"

    cancel = await client.post(f"/api/v1/appointments/{appointment_id}/cancel", headers=customer_headers)
    assert cancel.status_code == 200
    assert cancel.json()["data"]["status"] == "cancelled"

    # The same slot is bookable again now that the conflicting appointment is cancelled.
    rebooked = await client.post(
        "/api/v1/appointments",
        headers=customer_headers,
        json={
            "shop_id": shop["shop_id"],
            "barber_id": shop["barber_id"],
            "service_id": shop["service_id"],
            "start_at": start_at,
        },
    )
    assert rebooked.status_code == 201, rebooked.text
    assert target_date.isoformat() in start_at


# --- Completion --------------------------------------------------------------


async def test_completion_authorization_and_points_idempotency(client):
    shop = await _fully_set_up_shop(client)
    customer_token, _ = await _register(client, role_hint="completer")
    customer_headers = {"Authorization": f"Bearer {customer_token}"}
    response, _ = await _book(client, customer_headers, shop)
    assert response.status_code == 201, response.text
    appointment_id = response.json()["data"]["id"]

    # An unrelated barber (not assigned) cannot complete it.
    other_barber_token, _ = await _register(client, role_hint="otherbarber")
    unauthorized = await client.post(
        f"/api/v1/appointments/{appointment_id}/complete",
        headers={"Authorization": f"Bearer {other_barber_token}"},
        json={},
    )
    assert unauthorized.status_code in (403, 404)

    complete = await client.post(
        f"/api/v1/appointments/{appointment_id}/complete",
        headers=shop["barber_headers"],
        json={"final_price": "25.00"},
    )
    assert complete.status_code == 200
    assert complete.json()["data"]["status"] == "completed"

    retry = await client.post(
        f"/api/v1/appointments/{appointment_id}/complete", headers=shop["barber_headers"], json={}
    )
    assert retry.status_code == 409  # one-way state machine, not silently re-completable

    points = await client.get(
        f"/api/v1/shops/{shop['shop_id']}/barbers/{shop['barber_id']}/points", headers=shop["barber_headers"]
    )
    assert points.status_code == 200
    assert points.json()["data"]["total_points"] == 10  # never doubled


async def test_skip_completion_and_no_show_award_no_points(client):
    shop = await _fully_set_up_shop(client)

    customer_token, _ = await _register(client, role_hint="skipper")
    response, _ = await _book(client, {"Authorization": f"Bearer {customer_token}"}, shop)
    appointment_id = response.json()["data"]["id"]
    skip = await client.post(
        f"/api/v1/appointments/{appointment_id}/skip-completion", headers=shop["barber_headers"]
    )
    assert skip.status_code == 200
    assert skip.json()["data"]["status"] == "completed"

    customer_token2, _ = await _register(client, role_hint="noshow")
    response2, _ = await _book(client, {"Authorization": f"Bearer {customer_token2}"}, shop)
    appointment_id2 = response2.json()["data"]["id"]
    no_show = await client.post(
        f"/api/v1/appointments/{appointment_id2}/no-show", headers=shop["barber_headers"]
    )
    assert no_show.status_code == 200
    assert no_show.json()["data"]["status"] == "no_show"

    points = await client.get(
        f"/api/v1/shops/{shop['shop_id']}/barbers/{shop['barber_id']}/points", headers=shop["barber_headers"]
    )
    assert points.json()["data"]["total_points"] == 0


# --- Reviews ------------------------------------------------------------------


async def test_review_eligibility(client):
    shop = await _fully_set_up_shop(client)
    customer_token, _ = await _register(client, role_hint="reviewer")
    customer_headers = {"Authorization": f"Bearer {customer_token}"}
    response, _ = await _book(client, customer_headers, shop)
    appointment_id = response.json()["data"]["id"]

    too_early = await client.post(
        f"/api/v1/appointments/{appointment_id}/review",
        headers=customer_headers,
        json={"rating": 5},
    )
    assert too_early.status_code == 409
    assert too_early.json()["error"]["code"] == "REVIEW_NOT_ELIGIBLE"

    await client.post(
        f"/api/v1/appointments/{appointment_id}/complete", headers=shop["barber_headers"], json={}
    )

    ok = await client.post(
        f"/api/v1/appointments/{appointment_id}/review", headers=customer_headers, json={"rating": 5}
    )
    assert ok.status_code == 201, ok.text

    duplicate = await client.post(
        f"/api/v1/appointments/{appointment_id}/review", headers=customer_headers, json={"rating": 4}
    )
    assert duplicate.status_code == 409
    assert duplicate.json()["error"]["code"] == "REVIEW_NOT_ELIGIBLE"

    other_customer_token, _ = await _register(client, role_hint="notowner")
    not_owner = await client.post(
        f"/api/v1/appointments/{appointment_id}/review",
        headers={"Authorization": f"Bearer {other_customer_token}"},
        json={"rating": 1},
    )
    assert not_owner.status_code == 404
