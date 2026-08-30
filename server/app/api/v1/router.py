from fastapi import APIRouter

from app.appointments.router import router as appointments_router
from app.auth.router import router as auth_router
from app.availability.router import router as availability_router
from app.customers.router import router as customers_router
from app.media.router import router as media_router
from app.points.router import router as points_router
from app.reviews.router import router as reviews_router
from app.services.router import router as services_router
from app.shops.router import router as shops_router
from app.staff.router import router as staff_router

router = APIRouter(prefix="/v1")
router.include_router(auth_router)
router.include_router(shops_router)
router.include_router(staff_router)
router.include_router(services_router)
router.include_router(availability_router)
router.include_router(appointments_router)
router.include_router(customers_router)
router.include_router(reviews_router)
router.include_router(media_router)
router.include_router(points_router)
