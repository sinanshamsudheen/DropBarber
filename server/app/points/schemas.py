from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class PointEntryOut(BaseModel):
    id: UUID
    points: int
    reason: str
    created_at: datetime


class BarberPointsOut(BaseModel):
    barber_id: UUID
    total_points: int
    history: list[PointEntryOut]


class ShopBarberPointsSummary(BaseModel):
    barber_id: UUID
    display_name: str
    total_points: int
