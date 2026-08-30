# api.md

## API Direction

Backend: **Python + FastAPI**

Authentication:

* **JWT-based authentication**
* Access tokens for authenticated API requests
* Refresh-token strategy should be implemented securely
* Supabase/PostgreSQL remains the source of application data
* JWT identity is used to establish the authenticated user context

Authorization:

* **RBAC** at the application layer
* **PostgreSQL RLS** as the database-level isolation boundary
* Never rely on frontend role checks for security

API style:

* REST
* JSON request/response bodies
* Versioned under `/api/v1`
* UUID resource identifiers
* Consistent error response format
* UTC timestamps in API responses
* Shop/barber timezone used when calculating availability

---

## Authentication

### `POST /api/v1/auth/register`

**Auth:** Public

Create a platform account.

Used by:

* Customers
* Shop owners
* Other users entering through the normal signup flow

Request includes appropriate account information.

Returns:

* User
* Access token
* Refresh token/session information

---

### `POST /api/v1/auth/login`

**Auth:** Public

Authenticate a user.

Returns:

* Access token
* Refresh token/session information
* Basic user information
* Applicable roles/memberships

---

### `POST /api/v1/auth/refresh`

**Auth:** Authenticated session / refresh token

Issue a new access token using the refresh mechanism.

Refresh tokens must not be exposed in unsafe storage or logged.

---

### `POST /api/v1/auth/logout`

**Auth:** Logged-in

Invalidate the current session/refresh token where supported.

---

### `GET /api/v1/auth/me`

**Auth:** Logged-in

Returns:

* Current user
* Customer profile if applicable
* Shop memberships
* Applicable roles

---

# Customer Discovery

These endpoints are intentionally public where possible so customers can discover shops without creating an account first.

### `GET /api/v1/shops`

**Auth:** Public

Search/discover barber shops.

Supports:

* Latitude/longitude
* Search location
* Radius
* Pagination
* Rating filters
* Service filters
* Availability-related filtering where practical

Returns summarized shop cards.

---

### `GET /api/v1/shops/{shop_id}`

**Auth:** Public

Returns the public shop profile.

Includes:

* Shop information
* Location
* Opening hours
* Rating summary
* Services
* Active barbers
* Basic shop information

Must not expose private CRM data.

---

### `GET /api/v1/shops/{shop_id}/services`

**Auth:** Public

Returns active services offered by the shop.

---

### `GET /api/v1/shops/{shop_id}/barbers`

**Auth:** Public

Returns active public barber profiles.

---

### `GET /api/v1/barbers/{barber_id}`

**Auth:** Public

Returns public barber information.

Includes:

* Name
* Photo
* Bio
* Shop
* Services
* Public rating where supported

Does not expose private customer information.

---

# Availability

### `GET /api/v1/shops/{shop_id}/barbers/{barber_id}/availability`

**Auth:** Public

Returns available booking slots.

Required inputs:

* `service_id`
* `date`

The backend calculates availability using:

* Barber working hours
* Barber time off
* Service duration for that barber
* Existing active appointments
* Configured buffers

The frontend must not calculate authoritative availability itself.

---

### Availability rules

The API should only return slots where the entire requested service can fit.

For example:

```text
Barber availability: 10:00–13:00
Service duration: 20 minutes
Existing appointment: 11:00–11:30
```

The API must not offer slots overlapping the existing appointment.

Availability results are informational until the booking is committed.

---

# Customer Bookings

### `POST /api/v1/appointments`

**Auth:** Logged-in customer

Create a booking.

Request includes:

* `shop_id`
* `barber_id`
* `service_id`
* `start_at`
* Optional booking note
* Optional reference media IDs

The backend must:

1. Verify the shop/barber/service relationship.
2. Verify the customer is allowed to book.
3. Recalculate availability.
4. Verify the requested time is still available.
5. Create the appointment transactionally.
6. Create/update the shop-customer relationship.
7. Return the confirmed appointment.

The backend must protect against race conditions where two customers attempt to book the same barber simultaneously.

---

### `GET /api/v1/appointments`

**Auth:** Logged-in

Returns appointments accessible to the current user.

For customers:

* Their own appointments.

For shop staff:

* Appointments belonging to their authorized shop(s), subject to RBAC.

---

### `GET /api/v1/appointments/{appointment_id}`

**Auth:** Logged-in

Returns an appointment if the current user is authorized to access it.

Customer:

* Their appointment.

Barber/staff:

* Appointment belonging to an authorized shop and within their permissions.

---

### `POST /api/v1/appointments/{appointment_id}/cancel`

**Auth:** Logged-in, authorized party

Cancel an appointment according to the v1 cancellation rules.

The backend must verify:

* Current appointment status
* User authorization
* Cancellation eligibility

---

### `POST /api/v1/appointments/{appointment_id}/reschedule`

**Auth:** Logged-in, authorized party

Reschedule an appointment.

Must run the same availability and concurrency checks as a new booking.

---

# Appointment Completion

### `POST /api/v1/appointments/{appointment_id}/complete`

**Auth:** Barber / manager / owner with permission

Mark appointment completed.

Request can include:

* Actual service
* Final price
* Notes
* Finished-cut media
* Other supported completion information

On successful detailed completion:

* Appointment becomes `completed`
* Appointment details are stored
* Barber points are awarded according to the v1 points rule
* Point awarding must be idempotent

---

### `POST /api/v1/appointments/{appointment_id}/skip-completion`

**Auth:** Barber / manager / owner

Close the appointment without completing the optional CRM workflow.

Result:

* Appointment can be closed according to the defined state rules
* No barber points awarded

---

### `POST /api/v1/appointments/{appointment_id}/no-show`

**Auth:** Barber / manager / owner

Mark customer as no-show.

Result:

* Appointment status becomes `no_show`
* No points awarded

---

# Customer CRM

### `GET /api/v1/shops/{shop_id}/customers`

**Auth:** Shop staff with customer-read permission

Returns customers belonging to that shop.

Supports:

* Search
* Pagination
* Sorting
* Basic filters

Must only return the current shop's `shop_customers`.

---

### `GET /api/v1/shops/{shop_id}/customers/{customer_id}`

**Auth:** Authorized shop staff

Returns shop-specific customer information.

Includes:

* Customer basic profile
* Visit history at this shop
* Services
* Preferred barber
* Shop-specific notes
* Relevant reference media
* Relevant appointment history

It must **not** return the customer's history with other shops.

---

### `PATCH /api/v1/shops/{shop_id}/customers/{customer_id}`

**Auth:** Shop staff with customer-write permission

Allows authorized staff to update shop-specific CRM fields such as:

* Notes
* Preferred barber
* Other supported shop-level preferences

---

### `GET /api/v1/me/history`

**Auth:** Customer

Returns the customer's own cross-shop history.

This endpoint is intentionally different from the shop CRM endpoint.

The customer can see their own history across shops.

---

# Shop Management

### `POST /api/v1/shops`

**Auth:** Logged-in user

Create a shop.

The creator becomes the initial shop owner.

---

### `GET /api/v1/my/shops`

**Auth:** Logged-in

Returns shops the user belongs to.

---

### `GET /api/v1/shops/{shop_id}/manage`

**Auth:** Shop owner/manager

Returns management-oriented shop information.

Private CRM and operational information must be permission-checked separately.

---

### `PATCH /api/v1/shops/{shop_id}`

**Auth:** Owner/manager with shop-edit permission

Update:

* Shop name
* Description
* Contact details
* Address
* Location
* Opening information
* Other supported public shop profile fields

---

# Shop Staff / Barbers

### `GET /api/v1/shops/{shop_id}/members`

**Auth:** Owner/manager with staff-read permission

List shop staff.

---

### `POST /api/v1/shops/{shop_id}/barbers`

**Auth:** Owner/manager with staff-write permission

Add a barber.

Can include:

* User/account association
* Barber name
* Bio
* Profile photo
* Initial services
* Initial schedule

---

### `GET /api/v1/shops/{shop_id}/barbers/{barber_id}`

**Auth:** Authorized shop staff

Return barber management information.

---

### `PATCH /api/v1/shops/{shop_id}/barbers/{barber_id}`

**Auth:** Owner/manager or authorized barber for allowed self-edit fields

Update barber information.

---

### `POST /api/v1/shops/{shop_id}/barbers/{barber_id}/deactivate`

**Auth:** Owner/manager

Deactivate a barber.

Existing historical appointments remain intact.

---

# Services

### `POST /api/v1/shops/{shop_id}/services`

**Auth:** Owner/manager with service-write permission

Create a shop service.

---

### `GET /api/v1/shops/{shop_id}/services/manage`

**Auth:** Authorized shop staff

List all services, including inactive services.

---

### `PATCH /api/v1/shops/{shop_id}/services/{service_id}`

**Auth:** Owner/manager

Update service.

---

### `POST /api/v1/shops/{shop_id}/services/{service_id}/deactivate`

**Auth:** Owner/manager

Deactivate service.

Historical appointments must remain valid.

---

# Barber-Service Configuration

### `PUT /api/v1/shops/{shop_id}/barbers/{barber_id}/services/{service_id}`

**Auth:** Owner/manager

Configure a barber's relationship with a service.

Fields include:

* Active/inactive
* Duration
* Optional price override

This endpoint supports the requirement that service duration varies by barber.

Example:

```text
Haircut
  Raj → 15 minutes
  Arun → 25 minutes
```

---

# Barber Scheduling

### `GET /api/v1/shops/{shop_id}/barbers/{barber_id}/schedule`

**Auth:** Barber themselves or authorized manager/owner

Returns:

* Working hours
* Breaks where modeled
* Time-off periods

---

### `PUT /api/v1/shops/{shop_id}/barbers/{barber_id}/working-hours`

**Auth:** Owner/manager, or barber if permitted

Create/update recurring working hours.

---

### `POST /api/v1/shops/{shop_id}/barbers/{barber_id}/time-off`

**Auth:** Barber or authorized manager/owner

Create a time-off period.

---

### `DELETE /api/v1/shops/{shop_id}/barbers/{barber_id}/time-off/{time_off_id}`

**Auth:** Owner/manager or authorized creator

Remove an eligible time-off record.

---

# Reviews

### `POST /api/v1/appointments/{appointment_id}/review`

**Auth:** Customer who owns the appointment

Create a review after an eligible completed appointment.

Request:

* Rating
* Optional review text
* Optional barber rating if supported

The backend must verify appointment eligibility.

---

### `GET /api/v1/shops/{shop_id}/reviews`

**Auth:** Public

Returns public shop reviews.

Supports:

* Pagination
* Sorting

---

### `GET /api/v1/barbers/{barber_id}/reviews`

**Auth:** Public

Returns eligible public barber reviews if barber-level reviews are enabled.

---

# Media

### `POST /api/v1/media/upload`

**Auth:** Logged-in

Create an authorized media upload.

The API should return the appropriate upload/storage information rather than passing large image binaries through normal application endpoints when Supabase Storage can handle the upload.

---

### `POST /api/v1/appointments/{appointment_id}/media`

**Auth:** Authorized customer/barber/staff

Associate uploaded media with an appointment.

Media type:

* Customer reference
* Finished cut

Authorization must ensure the uploader is allowed to attach that media to the appointment.

---

### `POST /api/v1/me/preferences/media`

**Auth:** Customer

Associate an uploaded image with the customer's saved preferences.

---

# Barber Points

### `GET /api/v1/shops/{shop_id}/barbers/{barber_id}/points`

**Auth:** Barber themselves or authorized owner/manager

Returns points summary and history.

---

### `GET /api/v1/shops/{shop_id}/points`

**Auth:** Owner/manager

Returns shop-level barber points information.

No complex rewards/redemption system is included in v1.

---

# RBAC Model

Permissions should be capability-oriented rather than scattered role checks.

Example permissions:

```text
shop.read
shop.update

staff.read
staff.create
staff.update
staff.manage

services.read
services.create
services.update
services.manage

appointments.read
appointments.create
appointments.update
appointments.complete

customers.read
customers.update

schedule.read
schedule.update

reviews.read

points.read
```

Roles map to permissions.

### Owner

Full shop management.

### Manager

Operational management according to assigned permissions.

### Barber

Primarily:

* Own schedule
* Assigned appointments
* Relevant shop customer information
* Appointment completion
* Own points
* Limited profile management

The exact permission matrix should be implemented centrally rather than duplicated throughout route handlers.

---

# RLS Requirements

RLS is mandatory for tenant isolation.

Important policies:

### Shop-scoped records

For tables containing `shop_id`, access must be restricted according to the authenticated user's shop membership and permissions.

### Customer-owned records

Customer-owned records must be restricted to the authenticated customer's user ID.

### Cross-shop customer history

A shop member may access only:

```text
shop_customers
WHERE shop_id = authorized_shop
```

and related appointments/media belonging to that shop.

They must never gain access to the customer's records from another shop merely because they know the customer's platform user ID.

### Public data

Public shop discovery endpoints may expose only explicitly public fields.

Private CRM fields must never become accessible through public queries.

---

# API Error Model

Use a consistent structure, for example:

```json
{
  "error": {
    "code": "APPOINTMENT_SLOT_UNAVAILABLE",
    "message": "The selected time is no longer available."
  }
}
```

Useful error codes include:

* `UNAUTHORIZED`
* `FORBIDDEN`
* `NOT_FOUND`
* `VALIDATION_ERROR`
* `APPOINTMENT_SLOT_UNAVAILABLE`
* `INVALID_SERVICE`
* `INVALID_BARBER`
* `BARBER_UNAVAILABLE`
* `INVALID_APPOINTMENT_STATE`
* `REVIEW_NOT_ELIGIBLE`

Do not expose database errors or internal implementation details to clients.

---

# API Design Principles

1. **FastAPI validates requests; PostgreSQL/RLS enforces data boundaries.**
2. **Frontend availability is never authoritative.**
3. **Booking confirmation always performs a server-side availability check.**
4. **Appointment completion and points must be idempotent.**
5. **Historical appointment records should remain understandable after service/barber configuration changes.**
6. **Public APIs expose only public shop/barber information.**
7. **Customer CRM endpoints are always shop-scoped.**
8. **All authenticated routes derive identity from the verified JWT, never from a user ID supplied by the client.**
9. **RBAC is centralized and reusable across routes.**
10. **Future payment, branch, loyalty and messaging modules should be introduced as independent modules rather than forcing unrelated logic into appointments or shops.**
