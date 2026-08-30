"""add shop photos

Revision ID: 5097c9993b8c
Revises: e932096f4bc0
Create Date: 2026-08-30 15:28:03.211707

Adds `shop_photos`, a join table between `shops` and `media_assets` mirroring
`appointment_media`'s shape, plus a new, dedicated public Supabase Storage
bucket (`shop-media`) for the actual image bytes. Shop photos must be
viewable by anonymous customers browsing shops, so they get their own
public bucket rather than living in the existing private `media` bucket
(whose "never made public" guarantee, from the storage_media_bucket
migration, stays intact for customer/appointment reference photos).
"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "5097c9993b8c"
down_revision: Union[str, None] = "e932096f4bc0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_RLS_POLICIES: list[tuple[str, list[str]]] = [
    (
        "shop_photos",
        [
            """CREATE POLICY shop_photos_select ON shop_photos FOR SELECT
            USING (true)""",
            """CREATE POLICY shop_photos_insert ON shop_photos FOR INSERT
            WITH CHECK (app_rls.is_active_shop_member(shop_id, ARRAY['owner', 'manager']))""",
            """CREATE POLICY shop_photos_delete ON shop_photos FOR DELETE
            USING (app_rls.is_active_shop_member(shop_id, ARRAY['owner', 'manager']))""",
        ],
    ),
]

_CREATE_BUCKET = """
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES ('shop-media', 'shop-media', true, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp'])
    ON CONFLICT (id) DO NOTHING
"""

_INSERT_SHOP_MEDIA = """
    CREATE POLICY shop_media_insert ON storage.objects FOR INSERT
    WITH CHECK (
        bucket_id = 'shop-media'
        AND (storage.foldername(name))[1] = 'shop'
        AND app_rls.is_active_shop_member(((storage.foldername(name))[2])::uuid, ARRAY['owner', 'manager'])
    )
"""

_STORAGE_POLICY_NAMES = ["shop_media_insert"]


def _enable_rls_and_policies() -> None:
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


def upgrade() -> None:
    op.create_table(
        "shop_photos",
        sa.Column("shop_id", sa.UUID(), nullable=False),
        sa.Column("media_asset_id", sa.UUID(), nullable=False),
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(
            ["media_asset_id"], ["media_assets.id"], name=op.f("fk_shop_photos_media_asset_id_media_assets")
        ),
        sa.ForeignKeyConstraint(
            ["shop_id"], ["shops.id"], name=op.f("fk_shop_photos_shop_id_shops"), ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_shop_photos")),
        sa.UniqueConstraint("shop_id", "media_asset_id", name="uq_shop_photos_shop_id_media_asset_id"),
    )

    _enable_rls_and_policies()

    op.execute(_CREATE_BUCKET)
    op.execute(_INSERT_SHOP_MEDIA)


def downgrade() -> None:
    for name in reversed(_STORAGE_POLICY_NAMES):
        op.execute(f"DROP POLICY IF EXISTS {name} ON storage.objects")
    op.execute("DELETE FROM storage.buckets WHERE id = 'shop-media'")

    _disable_rls_and_policies()

    op.drop_table("shop_photos")
