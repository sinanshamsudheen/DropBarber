from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class ReviewCreateIn(BaseModel):
    rating: int = Field(ge=1, le=5)
    review_text: str | None = None
    barber_id: UUID | None = None


class ReviewOut(BaseModel):
    id: UUID
    appointment_id: UUID
    shop_id: UUID
    customer_user_id: UUID
    barber_profile_id: UUID | None
    rating: int
    review_text: str | None
    created_at: datetime
