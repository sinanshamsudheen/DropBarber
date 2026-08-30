from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class ShopMemberOut(BaseModel):
    id: UUID
    user_id: UUID
    role: str
    status: str
    created_at: datetime


class BarberCreateIn(BaseModel):
    # The barber must already have a platform account; inviting a brand-new
    # user by email is out of scope for Phase 3.
    user_id: UUID
    display_name: str = Field(min_length=1, max_length=200)
    bio: str | None = None
    profile_image_url: str | None = None


class BarberLookupOut(BaseModel):
    user_id: UUID
    email: str
    display_name: str | None


class BarberManageOut(BaseModel):
    id: UUID
    shop_member_id: UUID
    user_id: UUID
    display_name: str
    bio: str | None
    profile_image_url: str | None
    status: str


class BarberUpdateIn(BaseModel):
    """Fields a barber may edit on their own profile, or staff with
    staff.update may edit on anyone's."""

    display_name: str | None = Field(default=None, min_length=1, max_length=200)
    bio: str | None = None
    profile_image_url: str | None = None
