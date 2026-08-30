from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.appointments.models import Appointment
from app.auth.dependencies import get_bearer_token, get_current_user
from app.auth.schemas import AuthenticatedUser
from app.core.config import Settings, get_settings
from app.core.errors import AuthorizationError, NotFoundError
from app.core.responses import Envelope, StatusOut, envelope
from app.db.session import get_rls_db
from app.media.models import AppointmentMedia, CustomerPreferenceMedia, MediaAsset, ShopPhoto
from app.media.schemas import (
    AppointmentMediaLinkOut,
    AttachAppointmentMediaIn,
    AttachPreferenceMediaIn,
    AttachShopMediaIn,
    MediaUploadIn,
    MediaUploadOut,
    PreferenceMediaLinkOut,
    ShopMediaOut,
)
from app.media.storage import (
    bucket_for_context,
    build_public_shop_media_url,
    build_storage_path,
    create_signed_upload_url,
)
from app.permissions.dependencies import get_shop_membership, require_shop_permission
from app.permissions.roles import Permission
from app.staff.models import ShopMember

router = APIRouter(tags=["media"])


async def _authorize_appointment_access(
    db: AsyncSession, user: AuthenticatedUser, appointment_id: UUID
) -> Appointment:
    appointment = await db.get(Appointment, appointment_id)
    if appointment is None:
        raise NotFoundError("Appointment not found.")
    is_owner = appointment.customer_user_id == user.id
    membership = await get_shop_membership(shop_id=appointment.shop_id, user=user, db=db)
    if not (is_owner or membership is not None):
        raise AuthorizationError()
    return appointment


async def _authorize_upload_context(
    db: AsyncSession, user: AuthenticatedUser, payload: MediaUploadIn
) -> None:
    if payload.context == "customer":
        if payload.context_id != user.id:
            raise AuthorizationError()
    elif payload.context == "appointment":
        await _authorize_appointment_access(db, user, payload.context_id)
    elif payload.context == "shop":
        membership = await get_shop_membership(shop_id=payload.context_id, user=user, db=db)
        if membership is None or membership.role not in ("owner", "manager"):
            raise AuthorizationError()


@router.post("/media/upload", status_code=201, response_model=Envelope[MediaUploadOut])
async def create_upload(
    payload: MediaUploadIn,
    user: AuthenticatedUser = Depends(get_current_user),
    access_token: str = Depends(get_bearer_token),
    settings: Settings = Depends(get_settings),
    db: AsyncSession = Depends(get_rls_db),
) -> Envelope[MediaUploadOut]:
    await _authorize_upload_context(db, user, payload)

    path = build_storage_path(
        context=payload.context, context_id=payload.context_id, extension=payload.file_extension
    )
    signed = await create_signed_upload_url(
        access_token=access_token,
        path=path,
        bucket=bucket_for_context(payload.context),
        settings=settings,
    )

    media_asset = MediaAsset(uploaded_by_user_id=user.id, storage_path=path, media_type=payload.media_type)
    db.add(media_asset)
    await db.flush()

    return envelope(
        MediaUploadOut(
            media_asset_id=media_asset.id,
            storage_path=path,
            upload_url=signed.url,
            token=signed.token,
        )
    )


@router.post(
    "/appointments/{appointment_id}/media",
    status_code=201,
    response_model=Envelope[AppointmentMediaLinkOut],
)
async def attach_appointment_media(
    appointment_id: UUID,
    payload: AttachAppointmentMediaIn,
    user: AuthenticatedUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_rls_db),
) -> Envelope[AppointmentMediaLinkOut]:
    await _authorize_appointment_access(db, user, appointment_id)
    media = await db.get(MediaAsset, payload.media_asset_id)
    if media is None:
        raise NotFoundError("Media asset not found.")

    link = AppointmentMedia(
        appointment_id=appointment_id, media_asset_id=payload.media_asset_id, media_type=payload.media_type
    )
    db.add(link)
    await db.flush()
    return envelope(
        AppointmentMediaLinkOut(appointment_id=appointment_id, media_asset_id=payload.media_asset_id)
    )


@router.post("/me/preferences/media", status_code=201, response_model=Envelope[PreferenceMediaLinkOut])
async def attach_preference_media(
    payload: AttachPreferenceMediaIn,
    user: AuthenticatedUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_rls_db),
) -> Envelope[PreferenceMediaLinkOut]:
    media = await db.get(MediaAsset, payload.media_asset_id)
    if media is None or media.uploaded_by_user_id != user.id:
        raise NotFoundError("Media asset not found.")

    link = CustomerPreferenceMedia(
        customer_user_id=user.id, media_asset_id=payload.media_asset_id, caption=payload.caption
    )
    db.add(link)
    await db.flush()
    return envelope(PreferenceMediaLinkOut(customer_user_id=user.id, media_asset_id=payload.media_asset_id))


@router.post("/shops/{shop_id}/media", status_code=201, response_model=Envelope[ShopMediaOut])
async def attach_shop_media(
    shop_id: UUID,
    payload: AttachShopMediaIn,
    user: AuthenticatedUser = Depends(get_current_user),
    settings: Settings = Depends(get_settings),
    db: AsyncSession = Depends(get_rls_db),
    _membership: ShopMember = Depends(require_shop_permission(Permission.SHOP_MEDIA_MANAGE)),
) -> Envelope[ShopMediaOut]:
    media = await db.get(MediaAsset, payload.media_asset_id)
    if media is None or media.uploaded_by_user_id != user.id:
        raise NotFoundError("Media asset not found.")

    photo = ShopPhoto(shop_id=shop_id, media_asset_id=payload.media_asset_id)
    db.add(photo)
    await db.flush()
    return envelope(ShopMediaOut(id=photo.id, url=build_public_shop_media_url(media.storage_path, settings)))


@router.get("/shops/{shop_id}/media", response_model=Envelope[list[ShopMediaOut]])
async def list_shop_media(
    shop_id: UUID,
    settings: Settings = Depends(get_settings),
    db: AsyncSession = Depends(get_rls_db),
    _membership: ShopMember = Depends(require_shop_permission(Permission.SHOP_MEDIA_MANAGE)),
) -> Envelope[list[ShopMediaOut]]:
    result = await db.execute(
        select(ShopPhoto, MediaAsset)
        .join(MediaAsset, MediaAsset.id == ShopPhoto.media_asset_id)
        .where(ShopPhoto.shop_id == shop_id)
        .order_by(ShopPhoto.created_at.asc())
    )
    return envelope(
        [
            ShopMediaOut(id=photo.id, url=build_public_shop_media_url(asset.storage_path, settings))
            for photo, asset in result.all()
        ]
    )


@router.delete("/shops/{shop_id}/media/{photo_id}", response_model=Envelope[StatusOut])
async def remove_shop_media(
    shop_id: UUID,
    photo_id: UUID,
    db: AsyncSession = Depends(get_rls_db),
    _membership: ShopMember = Depends(require_shop_permission(Permission.SHOP_MEDIA_MANAGE)),
) -> Envelope[StatusOut]:
    photo = await db.get(ShopPhoto, photo_id)
    if photo is None or photo.shop_id != shop_id:
        raise NotFoundError("Photo not found for this shop.")
    await db.delete(photo)
    await db.flush()
    return envelope(StatusOut(id=photo_id, status="removed"))
