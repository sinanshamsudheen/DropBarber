"""storage media bucket

Revision ID: e932096f4bc0
Revises: b89d0446d7c8
Create Date: 2026-08-30 16:44:16.435471

Infrastructure setup for Phase 3's media integration, not a business-schema
change -- creates the Supabase Storage bucket actual files live in, plus RLS
policies on storage.objects mirroring docs/security.md's `customer/`,
`appointment/`, `shop/` path-prefix convention. Never made public: private
reference/finished-cut media stays gated by these policies, not by bucket
visibility.
"""

from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "e932096f4bc0"
down_revision: Union[str, None] = "b89d0446d7c8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_CREATE_BUCKET = """
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES ('media', 'media', false, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp'])
    ON CONFLICT (id) DO NOTHING
"""

_INSERT_CUSTOMER = """
    CREATE POLICY media_insert_customer ON storage.objects FOR INSERT
    WITH CHECK (
        bucket_id = 'media'
        AND (storage.foldername(name))[1] = 'customer'
        AND (storage.foldername(name))[2] = auth.uid()::text
    )
"""

_INSERT_APPOINTMENT = """
    CREATE POLICY media_insert_appointment ON storage.objects FOR INSERT
    WITH CHECK (
        bucket_id = 'media'
        AND (storage.foldername(name))[1] = 'appointment'
        AND EXISTS (
            SELECT 1 FROM appointments a
            WHERE a.id::text = (storage.foldername(name))[2]
              AND (a.customer_user_id = auth.uid() OR app_rls.is_active_shop_member(a.shop_id))
        )
    )
"""

_INSERT_SHOP = """
    CREATE POLICY media_insert_shop ON storage.objects FOR INSERT
    WITH CHECK (
        bucket_id = 'media'
        AND (storage.foldername(name))[1] = 'shop'
        AND app_rls.is_active_shop_member(((storage.foldername(name))[2])::uuid, ARRAY['owner', 'manager'])
    )
"""

_SELECT = """
    CREATE POLICY media_select ON storage.objects FOR SELECT
    USING (
        bucket_id = 'media'
        AND (
            ((storage.foldername(name))[1] = 'customer' AND (storage.foldername(name))[2] = auth.uid()::text)
            OR (
                (storage.foldername(name))[1] = 'appointment'
                AND EXISTS (
                    SELECT 1 FROM appointments a
                    WHERE a.id::text = (storage.foldername(name))[2]
                      AND (a.customer_user_id = auth.uid() OR app_rls.is_active_shop_member(a.shop_id))
                )
            )
            OR (
                (storage.foldername(name))[1] = 'shop'
                AND app_rls.is_active_shop_member(((storage.foldername(name))[2])::uuid)
            )
        )
    )
"""

_POLICY_NAMES = [
    "media_insert_customer",
    "media_insert_appointment",
    "media_insert_shop",
    "media_select",
]


def upgrade() -> None:
    op.execute(_CREATE_BUCKET)
    op.execute(_INSERT_CUSTOMER)
    op.execute(_INSERT_APPOINTMENT)
    op.execute(_INSERT_SHOP)
    op.execute(_SELECT)


def downgrade() -> None:
    for name in reversed(_POLICY_NAMES):
        op.execute(f"DROP POLICY IF EXISTS {name} ON storage.objects")
    op.execute("DELETE FROM storage.buckets WHERE id = 'media'")
