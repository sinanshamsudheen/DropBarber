from datetime import datetime, time
from uuid import UUID

from pydantic import BaseModel, Field


class SlotOut(BaseModel):
    time: time
    duration_minutes: int


class AvailabilityOut(BaseModel):
    slots: list[SlotOut]
    duration_minutes: int


class WorkingHoursPeriodIn(BaseModel):
    # 0=Monday..6=Sunday, matching barber_working_hours.day_of_week.
    day_of_week: int = Field(ge=0, le=6)
    start_time: time
    end_time: time
    is_active: bool = True


class WorkingHoursPeriodOut(WorkingHoursPeriodIn):
    id: UUID


class TimeOffCreateIn(BaseModel):
    start_at: datetime
    end_at: datetime
    reason: str | None = None


class TimeOffOut(BaseModel):
    id: UUID
    start_at: datetime
    end_at: datetime
    reason: str | None


class ScheduleOut(BaseModel):
    working_hours: list[WorkingHoursPeriodOut]
    time_off: list[TimeOffOut]
