from datetime import UTC, datetime, time, timedelta
from datetime import date as date_
from uuid import UUID
from zoneinfo import ZoneInfo

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.appointments.models import Appointment
from app.availability.engine import BlockedInterval, compute_slots
from app.availability.models import BarberTimeOff, BarberWorkingHours


async def get_available_slots(
    db: AsyncSession,
    *,
    barber_profile_id: UUID,
    shop_timezone: str,
    duration_minutes: int,
    target_date: date_,
    now: datetime | None = None,
) -> list[time]:
    """Fetches the real working hours / time off / booked appointments for
    one barber on one local day, then runs them through the availability
    engine. The single source of truth for "is this slot bookable" — used
    both by the public availability endpoint and by the booking transaction's
    server-side recheck.
    """
    tz = ZoneInfo(shop_timezone)
    day_start_utc = datetime.combine(target_date, time.min, tzinfo=tz).astimezone(UTC)
    day_end_utc = datetime.combine(target_date, time.max, tzinfo=tz).astimezone(UTC) + timedelta(
        microseconds=1
    )

    working_hours_result = await db.execute(
        select(BarberWorkingHours.start_time, BarberWorkingHours.end_time).where(
            BarberWorkingHours.barber_profile_id == barber_profile_id,
            BarberWorkingHours.day_of_week == target_date.weekday(),
            BarberWorkingHours.is_active.is_(True),
        )
    )
    working_periods = [(row.start_time, row.end_time) for row in working_hours_result]

    time_off_result = await db.execute(
        select(BarberTimeOff.start_at, BarberTimeOff.end_at).where(
            BarberTimeOff.barber_profile_id == barber_profile_id,
            BarberTimeOff.start_at < day_end_utc,
            BarberTimeOff.end_at > day_start_utc,
        )
    )
    time_off = [BlockedInterval(start_at=row.start_at, end_at=row.end_at) for row in time_off_result]

    appointments_result = await db.execute(
        select(Appointment.start_at, Appointment.end_at).where(
            Appointment.barber_profile_id == barber_profile_id,
            Appointment.status != "cancelled",
            Appointment.start_at < day_end_utc,
            Appointment.end_at > day_start_utc,
        )
    )
    existing_appointments = [
        BlockedInterval(start_at=row.start_at, end_at=row.end_at) for row in appointments_result
    ]

    return compute_slots(
        target_date=target_date,
        duration_minutes=duration_minutes,
        working_periods=working_periods,
        time_off=time_off,
        existing_appointments=existing_appointments,
        shop_timezone=shop_timezone,
        now=now or datetime.now(UTC),
    )
