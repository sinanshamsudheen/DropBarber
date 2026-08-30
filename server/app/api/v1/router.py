from fastapi import APIRouter

# No business routes yet — domain modules (shops, staff, services,
# appointments, etc.) will register their routers here in a later phase.
router = APIRouter(prefix="/v1")
