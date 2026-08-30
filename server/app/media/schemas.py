from uuid import UUID

from pydantic import BaseModel


class MediaUploadIn(BaseModel):
    context: str  # "customer" | "appointment" | "shop"
    context_id: UUID
    file_extension: str
    media_type: str = "image"


class MediaUploadOut(BaseModel):
    media_asset_id: UUID
    storage_path: str
    upload_url: str
    token: str


class AttachAppointmentMediaIn(BaseModel):
    media_asset_id: UUID
    media_type: str  # "customer_reference" | "finished_cut"


class AttachPreferenceMediaIn(BaseModel):
    media_asset_id: UUID
    caption: str | None = None


class AttachShopMediaIn(BaseModel):
    media_asset_id: UUID


class ShopMediaOut(BaseModel):
    id: UUID
    url: str


class AppointmentMediaLinkOut(BaseModel):
    appointment_id: UUID
    media_asset_id: UUID


class PreferenceMediaLinkOut(BaseModel):
    customer_user_id: UUID
    media_asset_id: UUID


class SignedUploadResponse(BaseModel):
    """The subset of Supabase Storage's signed-upload response this backend
    reads. Parsing the raw JSON through this model means a malformed or
    differently-shaped Storage response fails with a clear validation error
    instead of an unhandled KeyError."""

    url: str
    token: str
