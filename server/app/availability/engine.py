"""The authoritative availability engine.

Ports the algorithm the frontend used to fake locally before Phase 3 (15-min
grid, 5-min post-booking buffer, slots must be >=30min from "now" for
today), now running server-side against real working hours / time off /
booked appointments. The frontend never computes authoritative availability
itself — this is the only place slot validity is decided.
"""

from collections.abc import Sequence
from dataclasses import dataclass
from datetime import date as date_
from datetime import datetime, time, timedelta
from zoneinfo import ZoneInfo

SLOT_GRID_MINUTES = 15
BUFFER_MINUTES = 5
MIN_LEAD_MINUTES = 30


@dataclass(frozen=True)
class BlockedInterval:
    start_at: datetime
    end_at: datetime


def compute_slots(
    *,
    target_date: date_,
    duration_minutes: int,
    working_periods: Sequence[tuple[time, time]],
    time_off: Sequence[BlockedInterval],
    existing_appointments: Sequence[BlockedInterval],
    shop_timezone: str,
    now: datetime,
    slot_grid_minutes: int = SLOT_GRID_MINUTES,
    buffer_minutes: int = BUFFER_MINUTES,
    min_lead_minutes: int = MIN_LEAD_MINUTES,
) -> list[time]:
    """Returns sorted, duration-fitting local slot start times for one day.

    `working_periods` must already be filtered to `target_date`'s day of
    week (Python `date.weekday()` convention: Monday=0..Sunday=6, matching
    `barber_working_hours.day_of_week`). `time_off`/`existing_appointments`
    are timezone-aware UTC intervals; `existing_appointments` must already
    exclude cancelled appointments (cancelled appointments never block).
    """
    tz = ZoneInfo(shop_timezone)
    duration = timedelta(minutes=duration_minutes)
    grid = timedelta(minutes=slot_grid_minutes)
    buffer = timedelta(minutes=buffer_minutes)

    is_today = now.astimezone(tz).date() == target_date
    lead_cutoff_utc = now + timedelta(minutes=min_lead_minutes) if is_today else None

    blocked = [
        BlockedInterval(start_at=b.start_at, end_at=b.end_at + buffer) for b in existing_appointments
    ] + list(time_off)

    slots: list[time] = []
    for period_start, period_end in working_periods:
        cursor_local = datetime.combine(target_date, period_start, tzinfo=tz)
        period_end_local = datetime.combine(target_date, period_end, tzinfo=tz)

        while cursor_local + duration <= period_end_local:
            slot_start_utc = cursor_local.astimezone(ZoneInfo("UTC"))
            slot_end_utc = (cursor_local + duration).astimezone(ZoneInfo("UTC"))

            meets_lead_time = lead_cutoff_utc is None or slot_start_utc >= lead_cutoff_utc
            if meets_lead_time and not any(
                slot_start_utc < b.end_at and slot_end_utc > b.start_at for b in blocked
            ):
                slots.append(cursor_local.timetz().replace(tzinfo=None))

            cursor_local += grid

    return sorted(set(slots))
