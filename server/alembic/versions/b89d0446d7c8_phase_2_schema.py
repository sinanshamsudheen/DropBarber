"""phase 2 schema

Revision ID: b89d0446d7c8
Revises:
Create Date: 2026-08-30 16:05:40.413264

"""

from typing import Sequence, Union

import geoalchemy2
import sqlalchemy as sa
from alembic import op


# revision identifiers, used by Alembic.
revision: str = "b89d0446d7c8"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# Everything below is Postgres-specific SQL with no SQLAlchemy Core
# equivalent (FK to an out-of-metadata auth.users, a trigger-based
# auth.users sync, a GiST exclusion constraint, a cross-table validation
# trigger, and RLS functions/policies) -- executed one statement per
# op.execute() call since asyncpg's extended query protocol rejects
# multiple statements in a single execute.

_USERS_AUTH_FK = """
    ALTER TABLE users
        ADD CONSTRAINT fk_users_id_auth_users
        FOREIGN KEY (id) REFERENCES auth.users (id) ON DELETE CASCADE
"""

_HANDLE_NEW_AUTH_USER_FN = """
    CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
    RETURNS trigger
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public, pg_temp
    AS $$
    BEGIN
        INSERT INTO public.users (id, email, phone, display_name, avatar_url)
        VALUES (
            NEW.id,
            NULLIF(NEW.email, ''),
            NULLIF(NEW.phone, ''),
            NEW.raw_user_meta_data ->> 'display_name',
            NEW.raw_user_meta_data ->> 'avatar_url'
        )
        ON CONFLICT (id) DO NOTHING;
        RETURN NEW;
    END;
    $$
"""

_HANDLE_NEW_AUTH_USER_TRIGGER = """
    CREATE TRIGGER on_auth_user_created
        AFTER INSERT ON auth.users
        FOR EACH ROW
        EXECUTE FUNCTION public.handle_new_auth_user()
"""

_APPOINTMENTS_NO_OVERLAP = """
    ALTER TABLE appointments ADD CONSTRAINT ck_appointments_no_overlap
        EXCLUDE USING gist (
            barber_profile_id WITH =,
            tstzrange(start_at, end_at, '[)') WITH &&
        ) WHERE (status <> 'cancelled')
"""

_CHECK_PREFERRED_BARBER_FN = """
    CREATE OR REPLACE FUNCTION public.check_shop_customer_preferred_barber()
    RETURNS trigger
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public, pg_temp
    AS $$
    BEGIN
        IF NEW.preferred_barber_id IS NOT NULL THEN
            IF NOT EXISTS (
                SELECT 1
                FROM barber_profiles bp
                JOIN shop_members sm ON sm.id = bp.shop_member_id
                WHERE bp.id = NEW.preferred_barber_id
                  AND sm.shop_id = NEW.shop_id
            ) THEN
                RAISE EXCEPTION 'preferred_barber_id % does not belong to shop %', NEW.preferred_barber_id, NEW.shop_id;
            END IF;
        END IF;
        RETURN NEW;
    END;
    $$
"""

_CHECK_PREFERRED_BARBER_TRIGGER = """
    CREATE TRIGGER shop_customers_check_preferred_barber
        BEFORE INSERT OR UPDATE OF preferred_barber_id, shop_id ON shop_customers
        FOR EACH ROW
        EXECUTE FUNCTION public.check_shop_customer_preferred_barber()
"""

_RLS_SCHEMA = "CREATE SCHEMA IF NOT EXISTS app_rls"

_IS_ACTIVE_SHOP_MEMBER_FN = """
    CREATE OR REPLACE FUNCTION app_rls.is_active_shop_member(p_shop_id uuid, p_roles text[] DEFAULT NULL)
    RETURNS boolean
    LANGUAGE sql
    STABLE
    SECURITY DEFINER
    SET search_path = public, pg_temp
    AS $$
        SELECT EXISTS (
            SELECT 1 FROM shop_members sm
            WHERE sm.shop_id = p_shop_id
              AND sm.user_id = auth.uid()
              AND sm.status = 'active'
              AND (p_roles IS NULL OR sm.role = ANY(p_roles))
        );
    $$
"""

_SHOP_ID_FOR_BARBER_PROFILE_FN = """
    CREATE OR REPLACE FUNCTION app_rls.shop_id_for_barber_profile(p_barber_profile_id uuid)
    RETURNS uuid
    LANGUAGE sql
    STABLE
    SECURITY DEFINER
    SET search_path = public, pg_temp
    AS $$
        SELECT sm.shop_id
        FROM barber_profiles bp
        JOIN shop_members sm ON sm.id = bp.shop_member_id
        WHERE bp.id = p_barber_profile_id;
    $$
"""

_SHOP_HAS_ANY_MEMBER_FN = """
    CREATE OR REPLACE FUNCTION app_rls.shop_has_any_member(p_shop_id uuid)
    RETURNS boolean
    LANGUAGE sql
    STABLE
    SECURITY DEFINER
    SET search_path = public, pg_temp
    AS $$
        SELECT EXISTS (SELECT 1 FROM shop_members WHERE shop_id = p_shop_id);
    $$
"""

_RLS_HELPER_GRANTS = [
    "GRANT EXECUTE ON FUNCTION app_rls.is_active_shop_member(uuid, text[]) TO authenticated, anon",
    "GRANT EXECUTE ON FUNCTION app_rls.shop_id_for_barber_profile(uuid) TO authenticated, anon",
    "GRANT EXECUTE ON FUNCTION app_rls.shop_has_any_member(uuid) TO authenticated, anon",
]

# (table, [policy statements]) in dependency order -- also drives downgrade,
# which disables RLS and drops policies in reverse.
_RLS_POLICIES: list[tuple[str, list[str]]] = [
    (
        "users",
        [
            """CREATE POLICY users_select ON users FOR SELECT
            USING (
                id = auth.uid()
                OR EXISTS (
                    SELECT 1 FROM shop_customers sc
                    WHERE sc.customer_user_id = users.id
                      AND app_rls.is_active_shop_member(sc.shop_id)
                )
            )""",
            """CREATE POLICY users_update_own ON users FOR UPDATE
            USING (id = auth.uid())
            WITH CHECK (id = auth.uid())""",
        ],
    ),
    (
        "customer_profiles",
        [
            "CREATE POLICY customer_profiles_select ON customer_profiles FOR SELECT USING (user_id = auth.uid())",
            "CREATE POLICY customer_profiles_insert ON customer_profiles FOR INSERT WITH CHECK (user_id = auth.uid())",
            """CREATE POLICY customer_profiles_update ON customer_profiles FOR UPDATE
            USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid())""",
            "CREATE POLICY customer_profiles_delete ON customer_profiles FOR DELETE USING (user_id = auth.uid())",
        ],
    ),
    (
        "customer_preference_media",
        [
            """CREATE POLICY customer_preference_media_select ON customer_preference_media FOR SELECT
            USING (customer_user_id = auth.uid())""",
            """CREATE POLICY customer_preference_media_insert ON customer_preference_media FOR INSERT
            WITH CHECK (customer_user_id = auth.uid())""",
            """CREATE POLICY customer_preference_media_update ON customer_preference_media FOR UPDATE
            USING (customer_user_id = auth.uid()) WITH CHECK (customer_user_id = auth.uid())""",
            """CREATE POLICY customer_preference_media_delete ON customer_preference_media FOR DELETE
            USING (customer_user_id = auth.uid())""",
        ],
    ),
    (
        "shops",
        [
            """CREATE POLICY shops_select_public ON shops FOR SELECT
            USING (status = 'active' OR app_rls.is_active_shop_member(id))""",
            # Bootstrap: any authenticated user may create a shop; becoming its
            # owner happens via the shop_members bootstrap policy below.
            "CREATE POLICY shops_insert ON shops FOR INSERT WITH CHECK (auth.uid() IS NOT NULL)",
            """CREATE POLICY shops_update ON shops FOR UPDATE
            USING (app_rls.is_active_shop_member(id, ARRAY['owner', 'manager']))
            WITH CHECK (app_rls.is_active_shop_member(id, ARRAY['owner', 'manager']))""",
        ],
    ),
    (
        "shop_members",
        [
            """CREATE POLICY shop_members_select ON shop_members FOR SELECT
            USING (
                user_id = auth.uid()
                OR app_rls.is_active_shop_member(shop_id, ARRAY['owner', 'manager'])
            )""",
            # Bootstrap: the first member of a shop may insert themselves as
            # owner; afterwards only an existing owner may add members.
            """CREATE POLICY shop_members_insert ON shop_members FOR INSERT
            WITH CHECK (
                app_rls.is_active_shop_member(shop_id, ARRAY['owner'])
                OR (user_id = auth.uid() AND role = 'owner' AND NOT app_rls.shop_has_any_member(shop_id))
            )""",
            """CREATE POLICY shop_members_update ON shop_members FOR UPDATE
            USING (app_rls.is_active_shop_member(shop_id, ARRAY['owner']))
            WITH CHECK (app_rls.is_active_shop_member(shop_id, ARRAY['owner']))""",
            """CREATE POLICY shop_members_delete ON shop_members FOR DELETE
            USING (app_rls.is_active_shop_member(shop_id, ARRAY['owner']))""",
        ],
    ),
    (
        "barber_profiles",
        [
            """CREATE POLICY barber_profiles_select_public ON barber_profiles FOR SELECT
            USING (
                status = 'active'
                OR app_rls.is_active_shop_member(app_rls.shop_id_for_barber_profile(id))
            )""",
            """CREATE POLICY barber_profiles_insert ON barber_profiles FOR INSERT
            WITH CHECK (
                EXISTS (
                    SELECT 1 FROM shop_members sm
                    WHERE sm.id = shop_member_id
                      AND app_rls.is_active_shop_member(sm.shop_id, ARRAY['owner'])
                )
            )""",
            """CREATE POLICY barber_profiles_update ON barber_profiles FOR UPDATE
            USING (app_rls.is_active_shop_member(app_rls.shop_id_for_barber_profile(id), ARRAY['owner']))
            WITH CHECK (app_rls.is_active_shop_member(app_rls.shop_id_for_barber_profile(id), ARRAY['owner']))""",
        ],
    ),
    (
        "services",
        [
            """CREATE POLICY services_select_public ON services FOR SELECT
            USING (status = 'active' OR app_rls.is_active_shop_member(shop_id))""",
            """CREATE POLICY services_insert ON services FOR INSERT
            WITH CHECK (app_rls.is_active_shop_member(shop_id, ARRAY['owner', 'manager']))""",
            """CREATE POLICY services_update ON services FOR UPDATE
            USING (app_rls.is_active_shop_member(shop_id, ARRAY['owner', 'manager']))
            WITH CHECK (app_rls.is_active_shop_member(shop_id, ARRAY['owner', 'manager']))""",
        ],
    ),
    (
        "barber_services",
        [
            """CREATE POLICY barber_services_select ON barber_services FOR SELECT
            USING (app_rls.is_active_shop_member(app_rls.shop_id_for_barber_profile(barber_profile_id)))""",
            """CREATE POLICY barber_services_insert ON barber_services FOR INSERT
            WITH CHECK (app_rls.is_active_shop_member(
                app_rls.shop_id_for_barber_profile(barber_profile_id), ARRAY['owner', 'manager']))""",
            """CREATE POLICY barber_services_update ON barber_services FOR UPDATE
            USING (app_rls.is_active_shop_member(
                app_rls.shop_id_for_barber_profile(barber_profile_id), ARRAY['owner', 'manager']))
            WITH CHECK (app_rls.is_active_shop_member(
                app_rls.shop_id_for_barber_profile(barber_profile_id), ARRAY['owner', 'manager']))""",
            """CREATE POLICY barber_services_delete ON barber_services FOR DELETE
            USING (app_rls.is_active_shop_member(
                app_rls.shop_id_for_barber_profile(barber_profile_id), ARRAY['owner', 'manager']))""",
        ],
    ),
    (
        "barber_working_hours",
        [
            """CREATE POLICY barber_working_hours_select ON barber_working_hours FOR SELECT
            USING (app_rls.is_active_shop_member(app_rls.shop_id_for_barber_profile(barber_profile_id)))""",
            """CREATE POLICY barber_working_hours_insert ON barber_working_hours FOR INSERT
            WITH CHECK (app_rls.is_active_shop_member(
                app_rls.shop_id_for_barber_profile(barber_profile_id), ARRAY['owner', 'manager']))""",
            """CREATE POLICY barber_working_hours_update ON barber_working_hours FOR UPDATE
            USING (app_rls.is_active_shop_member(
                app_rls.shop_id_for_barber_profile(barber_profile_id), ARRAY['owner', 'manager']))
            WITH CHECK (app_rls.is_active_shop_member(
                app_rls.shop_id_for_barber_profile(barber_profile_id), ARRAY['owner', 'manager']))""",
            """CREATE POLICY barber_working_hours_delete ON barber_working_hours FOR DELETE
            USING (app_rls.is_active_shop_member(
                app_rls.shop_id_for_barber_profile(barber_profile_id), ARRAY['owner', 'manager']))""",
        ],
    ),
    (
        "barber_time_off",
        [
            """CREATE POLICY barber_time_off_select ON barber_time_off FOR SELECT
            USING (app_rls.is_active_shop_member(app_rls.shop_id_for_barber_profile(barber_profile_id)))""",
            """CREATE POLICY barber_time_off_insert ON barber_time_off FOR INSERT
            WITH CHECK (app_rls.is_active_shop_member(
                app_rls.shop_id_for_barber_profile(barber_profile_id), ARRAY['owner', 'manager']))""",
            """CREATE POLICY barber_time_off_update ON barber_time_off FOR UPDATE
            USING (app_rls.is_active_shop_member(
                app_rls.shop_id_for_barber_profile(barber_profile_id), ARRAY['owner', 'manager']))
            WITH CHECK (app_rls.is_active_shop_member(
                app_rls.shop_id_for_barber_profile(barber_profile_id), ARRAY['owner', 'manager']))""",
            """CREATE POLICY barber_time_off_delete ON barber_time_off FOR DELETE
            USING (app_rls.is_active_shop_member(
                app_rls.shop_id_for_barber_profile(barber_profile_id), ARRAY['owner', 'manager']))""",
        ],
    ),
    # The core CRM boundary -- shop staff of that shop only, no
    # customer-side or public policy at all.
    (
        "shop_customers",
        [
            "CREATE POLICY shop_customers_select ON shop_customers FOR SELECT USING (app_rls.is_active_shop_member(shop_id))",
            "CREATE POLICY shop_customers_insert ON shop_customers FOR INSERT WITH CHECK (app_rls.is_active_shop_member(shop_id))",
            """CREATE POLICY shop_customers_update ON shop_customers FOR UPDATE
            USING (app_rls.is_active_shop_member(shop_id)) WITH CHECK (app_rls.is_active_shop_member(shop_id))""",
            """CREATE POLICY shop_customers_delete ON shop_customers FOR DELETE
            USING (app_rls.is_active_shop_member(shop_id, ARRAY['owner', 'manager']))""",
        ],
    ),
    (
        "appointments",
        [
            """CREATE POLICY appointments_select ON appointments FOR SELECT
            USING (customer_user_id = auth.uid() OR app_rls.is_active_shop_member(shop_id))""",
            """CREATE POLICY appointments_insert ON appointments FOR INSERT
            WITH CHECK (
                customer_user_id = auth.uid()
                OR app_rls.is_active_shop_member(shop_id, ARRAY['owner', 'manager'])
            )""",
            """CREATE POLICY appointments_update ON appointments FOR UPDATE
            USING (customer_user_id = auth.uid() OR app_rls.is_active_shop_member(shop_id))
            WITH CHECK (customer_user_id = auth.uid() OR app_rls.is_active_shop_member(shop_id))""",
            # No DELETE policy: cancellation is a status update, never a hard delete.
        ],
    ),
    (
        "appointment_details",
        [
            """CREATE POLICY appointment_details_select ON appointment_details FOR SELECT
            USING (EXISTS (
                SELECT 1 FROM appointments a
                WHERE a.id = appointment_details.appointment_id
                  AND app_rls.is_active_shop_member(a.shop_id)
            ))""",
            """CREATE POLICY appointment_details_insert ON appointment_details FOR INSERT
            WITH CHECK (EXISTS (
                SELECT 1 FROM appointments a
                WHERE a.id = appointment_details.appointment_id
                  AND app_rls.is_active_shop_member(a.shop_id)
            ))""",
            """CREATE POLICY appointment_details_update ON appointment_details FOR UPDATE
            USING (EXISTS (
                SELECT 1 FROM appointments a
                WHERE a.id = appointment_details.appointment_id
                  AND app_rls.is_active_shop_member(a.shop_id)
            ))
            WITH CHECK (EXISTS (
                SELECT 1 FROM appointments a
                WHERE a.id = appointment_details.appointment_id
                  AND app_rls.is_active_shop_member(a.shop_id)
            ))""",
        ],
    ),
    (
        "appointment_media",
        [
            """CREATE POLICY appointment_media_select ON appointment_media FOR SELECT
            USING (EXISTS (
                SELECT 1 FROM appointments a
                WHERE a.id = appointment_media.appointment_id
                  AND (a.customer_user_id = auth.uid() OR app_rls.is_active_shop_member(a.shop_id))
            ))""",
            """CREATE POLICY appointment_media_insert ON appointment_media FOR INSERT
            WITH CHECK (EXISTS (
                SELECT 1 FROM appointments a
                WHERE a.id = appointment_media.appointment_id
                  AND (a.customer_user_id = auth.uid() OR app_rls.is_active_shop_member(a.shop_id))
            ))""",
            """CREATE POLICY appointment_media_delete ON appointment_media FOR DELETE
            USING (EXISTS (
                SELECT 1 FROM appointments a
                WHERE a.id = appointment_media.appointment_id
                  AND app_rls.is_active_shop_member(a.shop_id)
            ))""",
        ],
    ),
    (
        "barber_points",
        [
            """CREATE POLICY barber_points_select ON barber_points FOR SELECT
            USING (app_rls.is_active_shop_member(app_rls.shop_id_for_barber_profile(barber_profile_id)))""",
            """CREATE POLICY barber_points_insert ON barber_points FOR INSERT
            WITH CHECK (app_rls.is_active_shop_member(app_rls.shop_id_for_barber_profile(barber_profile_id)))""",
        ],
    ),
    (
        "media_assets",
        [
            """CREATE POLICY media_assets_select ON media_assets FOR SELECT
            USING (
                uploaded_by_user_id = auth.uid()
                OR EXISTS (
                    SELECT 1 FROM appointment_media am
                    JOIN appointments a ON a.id = am.appointment_id
                    WHERE am.media_asset_id = media_assets.id
                      AND (a.customer_user_id = auth.uid() OR app_rls.is_active_shop_member(a.shop_id))
                )
                OR EXISTS (
                    SELECT 1 FROM customer_preference_media cpm
                    WHERE cpm.media_asset_id = media_assets.id
                      AND cpm.customer_user_id = auth.uid()
                )
            )""",
            "CREATE POLICY media_assets_insert ON media_assets FOR INSERT WITH CHECK (uploaded_by_user_id = auth.uid())",
        ],
    ),
    # Public read; insert restricted to the customer's own completed
    # appointment -- enforces "no anonymous/free-floating reviews" at the
    # RLS layer too, not just the app.
    (
        "reviews",
        [
            "CREATE POLICY reviews_select_public ON reviews FOR SELECT USING (true)",
            """CREATE POLICY reviews_insert ON reviews FOR INSERT
            WITH CHECK (
                customer_user_id = auth.uid()
                AND EXISTS (
                    SELECT 1 FROM appointments a
                    WHERE a.id = reviews.appointment_id
                      AND a.customer_user_id = auth.uid()
                      AND a.status = 'completed'
                )
            )""",
            """CREATE POLICY reviews_update ON reviews FOR UPDATE
            USING (customer_user_id = auth.uid()) WITH CHECK (customer_user_id = auth.uid())""",
        ],
    ),
]


def _enable_rls_and_policies() -> None:
    op.execute(_RLS_SCHEMA)
    op.execute(_IS_ACTIVE_SHOP_MEMBER_FN)
    op.execute(_SHOP_ID_FOR_BARBER_PROFILE_FN)
    op.execute(_SHOP_HAS_ANY_MEMBER_FN)
    for grant in _RLS_HELPER_GRANTS:
        op.execute(grant)
    for table, policies in _RLS_POLICIES:
        op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")
        for policy in policies:
            op.execute(policy)


def _disable_rls_and_policies() -> None:
    for table, policies in reversed(_RLS_POLICIES):
        for policy in reversed(policies):
            policy_name = policy.split(" ON ")[0].removeprefix("CREATE POLICY ").strip()
            op.execute(f"DROP POLICY IF EXISTS {policy_name} ON {table}")
        op.execute(f"ALTER TABLE {table} DISABLE ROW LEVEL SECURITY")
    op.execute("DROP FUNCTION IF EXISTS app_rls.shop_has_any_member(uuid)")
    op.execute("DROP FUNCTION IF EXISTS app_rls.shop_id_for_barber_profile(uuid)")
    op.execute("DROP FUNCTION IF EXISTS app_rls.is_active_shop_member(uuid, text[])")
    op.execute("DROP SCHEMA IF EXISTS app_rls")


def upgrade() -> None:
    # Extensions: postgis for shops.location (radius/nearby queries later),
    # btree_gist for the appointments booking-overlap exclusion constraint.
    op.execute("CREATE EXTENSION IF NOT EXISTS postgis WITH SCHEMA extensions")
    op.execute("CREATE EXTENSION IF NOT EXISTS btree_gist WITH SCHEMA extensions")

    # ### commands auto generated by Alembic - please adjust! ###
    op.create_table(
        "shops",
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("phone", sa.String(), nullable=True),
        sa.Column("email", sa.String(), nullable=True),
        sa.Column("address_line_1", sa.Text(), nullable=False),
        sa.Column("address_line_2", sa.Text(), nullable=True),
        sa.Column("city", sa.String(), nullable=False),
        sa.Column("state", sa.String(), nullable=True),
        sa.Column("postal_code", sa.String(), nullable=True),
        sa.Column("country", sa.String(), nullable=False),
        sa.Column("latitude", sa.Numeric(precision=9, scale=6), nullable=False),
        sa.Column("longitude", sa.Numeric(precision=9, scale=6), nullable=False),
        sa.Column(
            "location",
            geoalchemy2.types.Geography(
                geometry_type="POINT",
                srid=4326,
                dimension=2,
                spatial_index=False,
                from_text="ST_GeogFromText",
                name="geography",
            ),
            sa.Computed("ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography", persisted=True),
            nullable=True,
        ),
        sa.Column("timezone", sa.Text(), nullable=False),
        sa.Column("status", sa.Text(), nullable=False),
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint("status IN ('pending', 'active', 'inactive')", name=op.f("ck_shops_status")),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_shops")),
    )
    op.create_index(op.f("ix_shops_status"), "shops", ["status"], unique=False)
    op.create_table(
        "users",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("email", sa.String(), nullable=True),
        sa.Column("phone", sa.String(), nullable=True),
        sa.Column("display_name", sa.String(), nullable=True),
        sa.Column("avatar_url", sa.String(), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_users")),
        sa.UniqueConstraint("email", name="uq_users_email"),
        sa.UniqueConstraint("phone", name="uq_users_phone"),
    )
    op.create_table(
        "customer_profiles",
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("display_name", sa.String(), nullable=True),
        sa.Column("phone", sa.String(), nullable=True),
        sa.Column("avatar_url", sa.String(), nullable=True),
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(
            ["user_id"], ["users.id"], name=op.f("fk_customer_profiles_user_id_users"), ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_customer_profiles")),
        sa.UniqueConstraint("user_id", name="uq_customer_profiles_user_id"),
    )
    op.create_table(
        "media_assets",
        sa.Column("uploaded_by_user_id", sa.UUID(), nullable=False),
        sa.Column("storage_path", sa.Text(), nullable=False),
        sa.Column("media_type", sa.Text(), nullable=False),
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint("media_type IN ('image')", name=op.f("ck_media_assets_media_type")),
        sa.ForeignKeyConstraint(
            ["uploaded_by_user_id"], ["users.id"], name=op.f("fk_media_assets_uploaded_by_user_id_users")
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_media_assets")),
    )
    op.create_table(
        "services",
        sa.Column("shop_id", sa.UUID(), nullable=False),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("price", sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column("currency", sa.String(length=3), nullable=False),
        sa.Column("status", sa.Text(), nullable=False),
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint("status IN ('active', 'inactive')", name=op.f("ck_services_status")),
        sa.CheckConstraint("price >= 0", name=op.f("ck_services_price_non_negative")),
        sa.ForeignKeyConstraint(["shop_id"], ["shops.id"], name=op.f("fk_services_shop_id_shops")),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_services")),
        sa.UniqueConstraint("shop_id", "name", name="uq_services_shop_id_name"),
    )
    op.create_index("ix_services_shop_id_status", "services", ["shop_id", "status"], unique=False)
    op.create_table(
        "shop_members",
        sa.Column("shop_id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("role", sa.Text(), nullable=False),
        sa.Column("status", sa.Text(), nullable=False),
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint("role IN ('owner', 'manager', 'barber')", name=op.f("ck_shop_members_role")),
        sa.CheckConstraint("status IN ('active', 'inactive')", name=op.f("ck_shop_members_status")),
        sa.ForeignKeyConstraint(["shop_id"], ["shops.id"], name=op.f("fk_shop_members_shop_id_shops")),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], name=op.f("fk_shop_members_user_id_users")),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_shop_members")),
        sa.UniqueConstraint("shop_id", "user_id", name="uq_shop_members_shop_id_user_id"),
    )
    op.create_index("ix_shop_members_shop_id_role", "shop_members", ["shop_id", "role"], unique=False)
    op.create_index("ix_shop_members_shop_id_status", "shop_members", ["shop_id", "status"], unique=False)
    op.create_index(op.f("ix_shop_members_user_id"), "shop_members", ["user_id"], unique=False)
    op.create_table(
        "barber_profiles",
        sa.Column("shop_member_id", sa.UUID(), nullable=False),
        sa.Column("display_name", sa.Text(), nullable=False),
        sa.Column("bio", sa.Text(), nullable=True),
        sa.Column("profile_image_url", sa.String(), nullable=True),
        sa.Column("status", sa.Text(), nullable=False),
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint("status IN ('active', 'inactive')", name=op.f("ck_barber_profiles_status")),
        sa.ForeignKeyConstraint(
            ["shop_member_id"],
            ["shop_members.id"],
            name=op.f("fk_barber_profiles_shop_member_id_shop_members"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_barber_profiles")),
        sa.UniqueConstraint("shop_member_id", name="uq_barber_profiles_shop_member_id"),
    )
    op.create_index(op.f("ix_barber_profiles_status"), "barber_profiles", ["status"], unique=False)
    op.create_table(
        "customer_preference_media",
        sa.Column("customer_user_id", sa.UUID(), nullable=False),
        sa.Column("media_asset_id", sa.UUID(), nullable=False),
        sa.Column("caption", sa.Text(), nullable=True),
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(
            ["customer_user_id"],
            ["users.id"],
            name=op.f("fk_customer_preference_media_customer_user_id_users"),
        ),
        sa.ForeignKeyConstraint(
            ["media_asset_id"],
            ["media_assets.id"],
            name=op.f("fk_customer_preference_media_media_asset_id_media_assets"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_customer_preference_media")),
    )
    op.create_table(
        "appointments",
        sa.Column("shop_id", sa.UUID(), nullable=False),
        sa.Column("customer_user_id", sa.UUID(), nullable=False),
        sa.Column("barber_profile_id", sa.UUID(), nullable=False),
        sa.Column("service_id", sa.UUID(), nullable=False),
        sa.Column("start_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("end_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("status", sa.Text(), nullable=False),
        sa.Column("booking_note", sa.Text(), nullable=True),
        sa.Column("cancelled_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint(
            "status IN ('booked', 'completed', 'cancelled', 'no_show')", name=op.f("ck_appointments_status")
        ),
        sa.CheckConstraint("start_at < end_at", name=op.f("ck_appointments_start_before_end")),
        sa.ForeignKeyConstraint(
            ["barber_profile_id"],
            ["barber_profiles.id"],
            name=op.f("fk_appointments_barber_profile_id_barber_profiles"),
        ),
        sa.ForeignKeyConstraint(
            ["customer_user_id"], ["users.id"], name=op.f("fk_appointments_customer_user_id_users")
        ),
        sa.ForeignKeyConstraint(
            ["service_id"], ["services.id"], name=op.f("fk_appointments_service_id_services")
        ),
        sa.ForeignKeyConstraint(["shop_id"], ["shops.id"], name=op.f("fk_appointments_shop_id_shops")),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_appointments")),
    )
    op.create_index(
        "ix_appointments_barber_profile_id_start_at",
        "appointments",
        ["barber_profile_id", "start_at"],
        unique=False,
    )
    op.create_index(
        "ix_appointments_customer_user_id_start_at",
        "appointments",
        ["customer_user_id", "start_at"],
        unique=False,
    )
    op.create_index("ix_appointments_shop_id_start_at", "appointments", ["shop_id", "start_at"], unique=False)
    op.create_index(
        "ix_appointments_shop_id_status_start_at",
        "appointments",
        ["shop_id", "status", "start_at"],
        unique=False,
    )
    op.create_table(
        "barber_services",
        sa.Column("barber_profile_id", sa.UUID(), nullable=False),
        sa.Column("service_id", sa.UUID(), nullable=False),
        sa.Column("duration_minutes", sa.Integer(), nullable=False),
        sa.Column("price_override", sa.Numeric(precision=10, scale=2), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint("duration_minutes > 0", name=op.f("ck_barber_services_duration_positive")),
        sa.CheckConstraint(
            "price_override IS NULL OR price_override >= 0",
            name=op.f("ck_barber_services_price_non_negative"),
        ),
        sa.ForeignKeyConstraint(
            ["barber_profile_id"],
            ["barber_profiles.id"],
            name=op.f("fk_barber_services_barber_profile_id_barber_profiles"),
        ),
        sa.ForeignKeyConstraint(
            ["service_id"], ["services.id"], name=op.f("fk_barber_services_service_id_services")
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_barber_services")),
        sa.UniqueConstraint("barber_profile_id", "service_id", name="uq_barber_services_barber_service"),
    )
    op.create_index(
        "ix_barber_services_barber_profile_id_is_active",
        "barber_services",
        ["barber_profile_id", "is_active"],
        unique=False,
    )
    op.create_index(
        "ix_barber_services_service_id_is_active",
        "barber_services",
        ["service_id", "is_active"],
        unique=False,
    )
    op.create_table(
        "barber_time_off",
        sa.Column("barber_profile_id", sa.UUID(), nullable=False),
        sa.Column("start_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("end_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("reason", sa.Text(), nullable=True),
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint("start_at < end_at", name=op.f("ck_barber_time_off_start_before_end")),
        sa.ForeignKeyConstraint(
            ["barber_profile_id"],
            ["barber_profiles.id"],
            name=op.f("fk_barber_time_off_barber_profile_id_barber_profiles"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_barber_time_off")),
    )
    op.create_index(
        "ix_barber_time_off_barber_profile_id_start_at",
        "barber_time_off",
        ["barber_profile_id", "start_at"],
        unique=False,
    )
    op.create_index(
        "ix_barber_time_off_barber_profile_id_start_at_end_at",
        "barber_time_off",
        ["barber_profile_id", "start_at", "end_at"],
        unique=False,
    )
    op.create_table(
        "barber_working_hours",
        sa.Column("barber_profile_id", sa.UUID(), nullable=False),
        sa.Column("day_of_week", sa.SmallInteger(), nullable=False),
        sa.Column("start_time", sa.Time(), nullable=False),
        sa.Column("end_time", sa.Time(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint(
            "day_of_week BETWEEN 0 AND 6", name=op.f("ck_barber_working_hours_day_of_week_range")
        ),
        sa.CheckConstraint("start_time < end_time", name=op.f("ck_barber_working_hours_start_before_end")),
        sa.ForeignKeyConstraint(
            ["barber_profile_id"],
            ["barber_profiles.id"],
            name=op.f("fk_barber_working_hours_barber_profile_id_barber_profiles"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_barber_working_hours")),
    )
    op.create_index(
        "ix_barber_working_hours_barber_profile_id_day_of_week",
        "barber_working_hours",
        ["barber_profile_id", "day_of_week"],
        unique=False,
    )
    op.create_table(
        "shop_customers",
        sa.Column("shop_id", sa.UUID(), nullable=False),
        sa.Column("customer_user_id", sa.UUID(), nullable=False),
        sa.Column("preferred_barber_id", sa.UUID(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(
            ["customer_user_id"], ["users.id"], name=op.f("fk_shop_customers_customer_user_id_users")
        ),
        sa.ForeignKeyConstraint(
            ["preferred_barber_id"],
            ["barber_profiles.id"],
            name=op.f("fk_shop_customers_preferred_barber_id_barber_profiles"),
        ),
        sa.ForeignKeyConstraint(["shop_id"], ["shops.id"], name=op.f("fk_shop_customers_shop_id_shops")),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_shop_customers")),
        sa.UniqueConstraint("shop_id", "customer_user_id", name="uq_shop_customers_shop_id_customer_user_id"),
    )
    op.create_index(op.f("ix_shop_customers_shop_id"), "shop_customers", ["shop_id"], unique=False)
    op.create_index(
        "ix_shop_customers_shop_id_preferred_barber_id",
        "shop_customers",
        ["shop_id", "preferred_barber_id"],
        unique=False,
    )
    op.create_table(
        "appointment_details",
        sa.Column("appointment_id", sa.UUID(), nullable=False),
        sa.Column("actual_service_id", sa.UUID(), nullable=True),
        sa.Column("final_price", sa.Numeric(precision=10, scale=2), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("completed_by_member_id", sa.UUID(), nullable=False),
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint(
            "final_price IS NULL OR final_price >= 0",
            name=op.f("ck_appointment_details_final_price_non_negative"),
        ),
        sa.ForeignKeyConstraint(
            ["actual_service_id"],
            ["services.id"],
            name=op.f("fk_appointment_details_actual_service_id_services"),
        ),
        sa.ForeignKeyConstraint(
            ["appointment_id"],
            ["appointments.id"],
            name=op.f("fk_appointment_details_appointment_id_appointments"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["completed_by_member_id"],
            ["shop_members.id"],
            name=op.f("fk_appointment_details_completed_by_member_id_shop_members"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_appointment_details")),
        sa.UniqueConstraint("appointment_id", name="uq_appointment_details_appointment_id"),
    )
    op.create_table(
        "appointment_media",
        sa.Column("appointment_id", sa.UUID(), nullable=False),
        sa.Column("media_asset_id", sa.UUID(), nullable=False),
        sa.Column("media_type", sa.Text(), nullable=False),
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint(
            "media_type IN ('customer_reference', 'finished_cut')",
            name=op.f("ck_appointment_media_media_type"),
        ),
        sa.ForeignKeyConstraint(
            ["appointment_id"],
            ["appointments.id"],
            name=op.f("fk_appointment_media_appointment_id_appointments"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["media_asset_id"],
            ["media_assets.id"],
            name=op.f("fk_appointment_media_media_asset_id_media_assets"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_appointment_media")),
        sa.UniqueConstraint(
            "appointment_id", "media_asset_id", name="uq_appointment_media_appointment_id_media_asset_id"
        ),
    )
    op.create_table(
        "barber_points",
        sa.Column("barber_profile_id", sa.UUID(), nullable=False),
        sa.Column("appointment_id", sa.UUID(), nullable=False),
        sa.Column("points", sa.Integer(), nullable=False),
        sa.Column("reason", sa.Text(), nullable=False),
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint("points > 0", name=op.f("ck_barber_points_points_positive")),
        sa.ForeignKeyConstraint(
            ["appointment_id"], ["appointments.id"], name=op.f("fk_barber_points_appointment_id_appointments")
        ),
        sa.ForeignKeyConstraint(
            ["barber_profile_id"],
            ["barber_profiles.id"],
            name=op.f("fk_barber_points_barber_profile_id_barber_profiles"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_barber_points")),
        sa.UniqueConstraint("appointment_id", "reason", name="uq_barber_points_appointment_id_reason"),
    )
    op.create_index(
        op.f("ix_barber_points_appointment_id"), "barber_points", ["appointment_id"], unique=False
    )
    op.create_index(
        "ix_barber_points_barber_profile_id_created_at",
        "barber_points",
        ["barber_profile_id", "created_at"],
        unique=False,
    )
    op.create_table(
        "reviews",
        sa.Column("appointment_id", sa.UUID(), nullable=False),
        sa.Column("shop_id", sa.UUID(), nullable=False),
        sa.Column("customer_user_id", sa.UUID(), nullable=False),
        sa.Column("barber_profile_id", sa.UUID(), nullable=True),
        sa.Column("rating", sa.SmallInteger(), nullable=False),
        sa.Column("review_text", sa.Text(), nullable=True),
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint("rating BETWEEN 1 AND 5", name=op.f("ck_reviews_rating_range")),
        sa.ForeignKeyConstraint(
            ["appointment_id"], ["appointments.id"], name=op.f("fk_reviews_appointment_id_appointments")
        ),
        sa.ForeignKeyConstraint(
            ["barber_profile_id"],
            ["barber_profiles.id"],
            name=op.f("fk_reviews_barber_profile_id_barber_profiles"),
        ),
        sa.ForeignKeyConstraint(
            ["customer_user_id"], ["users.id"], name=op.f("fk_reviews_customer_user_id_users")
        ),
        sa.ForeignKeyConstraint(["shop_id"], ["shops.id"], name=op.f("fk_reviews_shop_id_shops")),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_reviews")),
        sa.UniqueConstraint("appointment_id", name="uq_reviews_appointment_id"),
    )
    op.create_index(
        "ix_reviews_barber_profile_id_created_at",
        "reviews",
        ["barber_profile_id", "created_at"],
        unique=False,
    )
    op.create_index(
        "ix_reviews_customer_user_id_created_at", "reviews", ["customer_user_id", "created_at"], unique=False
    )
    op.create_index("ix_reviews_shop_id_created_at", "reviews", ["shop_id", "created_at"], unique=False)
    # ### end Alembic commands ###

    op.execute(_USERS_AUTH_FK)
    op.execute(_HANDLE_NEW_AUTH_USER_FN)
    op.execute(_HANDLE_NEW_AUTH_USER_TRIGGER)
    op.execute(_APPOINTMENTS_NO_OVERLAP)
    op.execute(_CHECK_PREFERRED_BARBER_FN)
    op.execute(_CHECK_PREFERRED_BARBER_TRIGGER)
    _enable_rls_and_policies()


def downgrade() -> None:
    _disable_rls_and_policies()
    op.execute("DROP TRIGGER IF EXISTS shop_customers_check_preferred_barber ON shop_customers")
    op.execute("DROP FUNCTION IF EXISTS public.check_shop_customer_preferred_barber()")
    op.execute("ALTER TABLE appointments DROP CONSTRAINT IF EXISTS ck_appointments_no_overlap")
    op.execute("DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users")
    op.execute("DROP FUNCTION IF EXISTS public.handle_new_auth_user()")
    op.execute("ALTER TABLE users DROP CONSTRAINT IF EXISTS fk_users_id_auth_users")

    # ### commands auto generated by Alembic - please adjust! ###
    op.drop_index("ix_reviews_shop_id_created_at", table_name="reviews")
    op.drop_index("ix_reviews_customer_user_id_created_at", table_name="reviews")
    op.drop_index("ix_reviews_barber_profile_id_created_at", table_name="reviews")
    op.drop_table("reviews")
    op.drop_index("ix_barber_points_barber_profile_id_created_at", table_name="barber_points")
    op.drop_index(op.f("ix_barber_points_appointment_id"), table_name="barber_points")
    op.drop_table("barber_points")
    op.drop_table("appointment_media")
    op.drop_table("appointment_details")
    op.drop_index("ix_shop_customers_shop_id_preferred_barber_id", table_name="shop_customers")
    op.drop_index(op.f("ix_shop_customers_shop_id"), table_name="shop_customers")
    op.drop_table("shop_customers")
    op.drop_index("ix_barber_working_hours_barber_profile_id_day_of_week", table_name="barber_working_hours")
    op.drop_table("barber_working_hours")
    op.drop_index("ix_barber_time_off_barber_profile_id_start_at_end_at", table_name="barber_time_off")
    op.drop_index("ix_barber_time_off_barber_profile_id_start_at", table_name="barber_time_off")
    op.drop_table("barber_time_off")
    op.drop_index("ix_barber_services_service_id_is_active", table_name="barber_services")
    op.drop_index("ix_barber_services_barber_profile_id_is_active", table_name="barber_services")
    op.drop_table("barber_services")
    op.drop_index("ix_appointments_shop_id_status_start_at", table_name="appointments")
    op.drop_index("ix_appointments_shop_id_start_at", table_name="appointments")
    op.drop_index("ix_appointments_customer_user_id_start_at", table_name="appointments")
    op.drop_index("ix_appointments_barber_profile_id_start_at", table_name="appointments")
    op.drop_table("appointments")
    op.drop_table("customer_preference_media")
    op.drop_index(op.f("ix_barber_profiles_status"), table_name="barber_profiles")
    op.drop_table("barber_profiles")
    op.drop_index(op.f("ix_shop_members_user_id"), table_name="shop_members")
    op.drop_index("ix_shop_members_shop_id_status", table_name="shop_members")
    op.drop_index("ix_shop_members_shop_id_role", table_name="shop_members")
    op.drop_table("shop_members")
    op.drop_index("ix_services_shop_id_status", table_name="services")
    op.drop_table("services")
    op.drop_table("media_assets")
    op.drop_table("customer_profiles")
    op.drop_table("users")
    op.drop_index(op.f("ix_shops_status"), table_name="shops")
    op.drop_table("shops")
    # ### end Alembic commands ###
