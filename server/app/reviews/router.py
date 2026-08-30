from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.appointments.models import Appointment
from app.auth.dependencies import get_current_user
from app.auth.schemas import AuthenticatedUser
from app.core.errors import ConflictError, NotFoundError
from app.core.pagination import PageParams, page_params
from app.core.responses import Envelope, Page, Pagination, envelope
from app.db.session import get_rls_db
from app.reviews.models import Review
from app.reviews.schemas import ReviewCreateIn, ReviewOut

router = APIRouter(tags=["reviews"])


@router.post("/appointments/{appointment_id}/review", status_code=201, response_model=Envelope[ReviewOut])
async def create_review(
    appointment_id: UUID,
    payload: ReviewCreateIn,
    user: AuthenticatedUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_rls_db),
) -> Envelope[ReviewOut]:
    appointment = await db.get(Appointment, appointment_id)
    if appointment is None or appointment.customer_user_id != user.id:
        raise NotFoundError("Appointment not found.")
    if appointment.status != "completed":
        raise ConflictError(
            code="REVIEW_NOT_ELIGIBLE", message="Only completed appointments can be reviewed."
        )

    existing = await db.execute(select(Review).where(Review.appointment_id == appointment_id))
    if existing.scalar_one_or_none() is not None:
        raise ConflictError(code="REVIEW_NOT_ELIGIBLE", message="This appointment has already been reviewed.")

    review = Review(
        appointment_id=appointment_id,
        shop_id=appointment.shop_id,
        customer_user_id=user.id,
        barber_profile_id=payload.barber_id,
        rating=payload.rating,
        review_text=payload.review_text,
    )
    db.add(review)
    await db.flush()
    return envelope(ReviewOut.model_validate(review, from_attributes=True))


@router.get("/shops/{shop_id}/reviews", response_model=Page[ReviewOut])
async def list_shop_reviews(
    shop_id: UUID, page_params: PageParams = Depends(page_params), db: AsyncSession = Depends(get_rls_db)
) -> Page[ReviewOut]:
    return await _paginated_reviews(db, Review.shop_id == shop_id, page_params)


@router.get("/barbers/{barber_id}/reviews", response_model=Page[ReviewOut])
async def list_barber_reviews(
    barber_id: UUID, page_params: PageParams = Depends(page_params), db: AsyncSession = Depends(get_rls_db)
) -> Page[ReviewOut]:
    return await _paginated_reviews(db, Review.barber_profile_id == barber_id, page_params)


async def _paginated_reviews(db: AsyncSession, filter_clause, page_params: PageParams) -> Page[ReviewOut]:
    count_result = await db.execute(
        select(func.count()).select_from(select(Review).where(filter_clause).subquery())
    )
    total = count_result.scalar_one()

    result = await db.execute(
        select(Review)
        .where(filter_clause)
        .order_by(Review.created_at.desc())
        .limit(page_params.page_size)
        .offset(page_params.offset)
    )
    data = [ReviewOut.model_validate(r, from_attributes=True) for r in result.scalars()]
    return Page[ReviewOut](
        data=data,
        pagination=Pagination(page=page_params.page, page_size=page_params.page_size, total=total),
    )
