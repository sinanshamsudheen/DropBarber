from enum import StrEnum


class Role(StrEnum):
    CUSTOMER = "customer"
    OWNER = "owner"
    MANAGER = "manager"
    BARBER = "barber"


class Permission(StrEnum):
    SHOP_READ = "shop.read"
    SHOP_UPDATE = "shop.update"
    SHOP_MEDIA_MANAGE = "shop.media.manage"

    STAFF_READ = "staff.read"
    STAFF_CREATE = "staff.create"
    STAFF_UPDATE = "staff.update"
    STAFF_MANAGE = "staff.manage"

    SERVICES_READ = "services.read"
    SERVICES_CREATE = "services.create"
    SERVICES_UPDATE = "services.update"
    SERVICES_MANAGE = "services.manage"

    APPOINTMENTS_READ = "appointments.read"
    APPOINTMENTS_CREATE = "appointments.create"
    APPOINTMENTS_UPDATE = "appointments.update"
    APPOINTMENTS_COMPLETE = "appointments.complete"

    CUSTOMERS_READ = "customers.read"
    CUSTOMERS_UPDATE = "customers.update"

    SCHEDULE_READ = "schedule.read"
    SCHEDULE_UPDATE = "schedule.update"

    REVIEWS_READ = "reviews.read"

    POINTS_READ = "points.read"


# Reusable RBAC foundation: what each shop role is permitted to do.
# Shop membership (which role a user holds at which shop) is resolved in the
# business phase once `shop_members` exists — this mapping only defines the
# static role -> permission relationship.
ROLE_PERMISSIONS: dict[Role, set[Permission]] = {
    Role.OWNER: {
        Permission.SHOP_READ,
        Permission.SHOP_UPDATE,
        Permission.SHOP_MEDIA_MANAGE,
        Permission.STAFF_READ,
        Permission.STAFF_CREATE,
        Permission.STAFF_UPDATE,
        Permission.STAFF_MANAGE,
        Permission.SERVICES_READ,
        Permission.SERVICES_CREATE,
        Permission.SERVICES_UPDATE,
        Permission.SERVICES_MANAGE,
        Permission.APPOINTMENTS_READ,
        Permission.APPOINTMENTS_CREATE,
        Permission.APPOINTMENTS_UPDATE,
        Permission.APPOINTMENTS_COMPLETE,
        Permission.CUSTOMERS_READ,
        Permission.CUSTOMERS_UPDATE,
        Permission.SCHEDULE_READ,
        Permission.SCHEDULE_UPDATE,
        Permission.REVIEWS_READ,
        Permission.POINTS_READ,
    },
    Role.MANAGER: {
        Permission.SHOP_READ,
        Permission.SHOP_MEDIA_MANAGE,
        Permission.STAFF_READ,
        Permission.STAFF_MANAGE,
        Permission.SERVICES_READ,
        Permission.SERVICES_CREATE,
        Permission.SERVICES_UPDATE,
        Permission.SERVICES_MANAGE,
        Permission.APPOINTMENTS_READ,
        Permission.APPOINTMENTS_CREATE,
        Permission.APPOINTMENTS_UPDATE,
        Permission.APPOINTMENTS_COMPLETE,
        Permission.CUSTOMERS_READ,
        Permission.CUSTOMERS_UPDATE,
        Permission.SCHEDULE_READ,
        Permission.SCHEDULE_UPDATE,
        Permission.REVIEWS_READ,
        Permission.POINTS_READ,
    },
    Role.BARBER: {
        Permission.SHOP_READ,
        Permission.APPOINTMENTS_READ,
        Permission.APPOINTMENTS_COMPLETE,
        Permission.CUSTOMERS_READ,
        Permission.SCHEDULE_READ,
        Permission.SCHEDULE_UPDATE,
        Permission.REVIEWS_READ,
        Permission.POINTS_READ,
    },
    Role.CUSTOMER: set(),
}
