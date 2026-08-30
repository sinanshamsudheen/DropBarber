"""Supabase Storage integration.

Every call here is made **with the caller's own verified access token**,
never a service-role credential — Storage enforces its own RLS on
`storage.objects` (see the Phase 3 migration) exactly the way Postgres RLS
guards our own tables, so normal requests never bypass authorization.
"""

import uuid

import httpx

from app.core.config import Settings
from app.core.errors import BadRequestError
from app.media.schemas import SignedUploadResponse

BUCKET = "media"
# Shop photos need to be viewable by anonymous customers browsing shops, so
# they live in their own bucket with `public=true` (see the shop_photos
# migration) rather than the private `media` bucket used for customer/
# appointment reference photos.
SHOP_MEDIA_BUCKET = "shop-media"
MAX_UPLOAD_SIZE_BYTES = 10 * 1024 * 1024
ALLOWED_EXTENSIONS = {"jpg", "jpeg", "png", "webp"}
ALLOWED_CONTEXTS = {"customer", "appointment", "shop"}


def bucket_for_context(context: str) -> str:
    return SHOP_MEDIA_BUCKET if context == "shop" else BUCKET


def build_storage_path(*, context: str, context_id: uuid.UUID, extension: str) -> str:
    if context not in ALLOWED_CONTEXTS:
        raise BadRequestError(message=f"Unsupported media context '{context}'.")
    extension = extension.lower().lstrip(".")
    if extension not in ALLOWED_EXTENSIONS:
        raise BadRequestError(message=f"Unsupported file extension '{extension}'.")
    # A random filename, never a client-supplied one, per docs/security.md.
    return f"{context}/{context_id}/{uuid.uuid4()}.{extension}"


async def create_signed_upload_url(
    *, access_token: str, path: str, bucket: str, settings: Settings
) -> SignedUploadResponse:
    """Requests a one-time signed upload URL for `path` in `bucket`,
    authenticated as the caller (not service-role). Storage's own
    `storage.objects` RLS policy decides whether this is actually allowed.
    """
    url = f"{settings.supabase_url}/storage/v1/object/upload/sign/{bucket}/{path}"
    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.post(
            url,
            headers={"Authorization": f"Bearer {access_token}", "apikey": settings.supabase_anon_key},
            json={},
        )
    if response.status_code >= 400:
        raise BadRequestError(message="Could not create an upload URL for that media.")
    signed = SignedUploadResponse.model_validate(response.json())
    # This URL is returned to the browser, which PUTs the file bytes to it
    # directly — unlike the request above (server-to-server), it must use a
    # hostname the browser can actually resolve.
    public_base = settings.supabase_public_url_or_default
    return SignedUploadResponse(url=f"{public_base}/storage/v1{signed.url}", token=signed.token)


def build_public_shop_media_url(storage_path: str, settings: Settings) -> str:
    public_base = settings.supabase_public_url_or_default
    return f"{public_base}/storage/v1/object/public/{SHOP_MEDIA_BUCKET}/{storage_path}"
