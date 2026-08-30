# db_er.md

## Database Direction

Use **Supabase PostgreSQL** as the database.

Use:

* **SQLAlchemy** for application models
* **Alembic** for migrations
* **PostgreSQL RLS** for tenant/data isolation
* Application-level **RBAC** for permissions
* Supabase Auth identity mapped to application users

The database should be designed around the current barber marketplace + CRM, without creating speculative payment, loyalty, payroll, inventory, or branch tables.

The key boundary is:

> **A customer account can interact with many shops, but each shop has its own isolated customer relationship.**

---

## Core Entities

### 1. `users`

Represents a platform account.

Key fields:

* `id` — UUID, primary key
* `email`
* `phone`
* `display_name`
* `avatar_url`
* `created_at`
* `updated_at`

The authentication identity should integrate with Supabase Auth.

Do not duplicate authentication credentials/passwords in this table.

**Indexes / uniqueness**

* `id` primary key
* `email` unique where applicable
* `phone` indexed/unique according to the final authentication strategy

---

### 2. `shops`

Represents a barber shop/business location in v1.

Key fields:

* `id` — UUID, primary key
* `name`
* `description`
* `phone`
* `email`
* `address_line_1`
* `address_line_2`
* `city`
* `state`
* `postal_code`
* `country`
* `latitude`
* `longitude`
* `timezone`
* `status`
* `created_at`
* `updated_at`

`latitude` and `longitude` support location-based discovery.

**Indexes**

* Geographic index appropriate for PostgreSQL/PostGIS if enabled
* `status`
* Location-related search fields as appropriate

Do not create a separate `branches` table yet.

The current `shops` entity represents a single bookable physical location.

---

### 3. `shop_members`

Associates users with shops and establishes the shop-level RBAC boundary.

Key fields:

* `id`
* `shop_id`
* `user_id`
* `role`
* `status`
* `created_at`
* `updated_at`

Roles should initially support:

* `owner`
* `manager`
* `barber`
* Other limited staff roles only if actually required

A user may belong to multiple shops.

**Constraints**

* Unique `(shop_id, user_id)`

**Indexes**

* `(shop_id, role)`
* `(user_id)`
* `(shop_id, status)`

This is a critical authorization table.

---

### 4. `customer_profiles`

Represents the customer's platform-level profile.

Key fields:

* `id`
* `user_id`
* `display_name`
* `phone`
* `avatar_url`
* `created_at`
* `updated_at`

A customer is still represented by the platform `users` account, while this entity stores customer-specific profile information.

**Constraints**

* Unique `user_id`

This table must **not** contain shop-specific customer history.

---

### 5. `shop_customers`

Represents the relationship between a customer and a specific shop.

This is the core CRM boundary.

Key fields:

* `id`
* `shop_id`
* `customer_user_id`
* `preferred_barber_id` — nullable
* `notes`
* `created_at`
* `updated_at`

Potential derived information such as visit count and last visit should preferably be calculated from appointments rather than duplicated prematurely.

**Constraints**

* Unique `(shop_id, customer_user_id)`

**Indexes**

* `(shop_id, customer_user_id)`
* `(shop_id, preferred_barber_id)`

A customer's relationship with Shop A must be completely separate from their relationship with Shop B.

---

## Staff & Services

### 6. `barber_profiles`

Represents barber-specific information for a shop member.

Key fields:

* `id`
* `shop_member_id`
* `display_name`
* `bio`
* `profile_image_url`
* `status`
* `created_at`
* `updated_at`

A barber is associated with a shop through `shop_members`.

**Constraints**

* One active barber profile per applicable barber membership

---

### 7. `services`

Represents services offered by a shop.

Key fields:

* `id`
* `shop_id`
* `name`
* `description`
* `price`
* `currency`
* `status`
* `created_at`
* `updated_at`

Examples:

* Haircut
* Beard trim
* Shaving
* Haircut + beard

**Indexes**

* `(shop_id, status)`
* `(shop_id, name)`

Do not create a global service catalog in v1. Shops should control their own services.

---

### 8. `barber_services`

Associates a barber with services they provide and stores barber-specific configuration.

Key fields:

* `id`
* `barber_profile_id`
* `service_id`
* `duration_minutes`
* `price_override` — nullable
* `is_active`
* `created_at`
* `updated_at`

This supports the requirement that:

> Raj may take 15 minutes for a haircut while Arun takes 25 minutes.

It also allows future pricing differences without changing the core service model.

**Constraints**

* Unique `(barber_profile_id, service_id)`

**Indexes**

* `(barber_profile_id, is_active)`
* `(service_id, is_active)`

---

## Barber Availability

### 9. `barber_working_hours`

Stores recurring weekly availability.

Key fields:

* `id`
* `barber_profile_id`
* `day_of_week`
* `start_time`
* `end_time`
* `is_active`

A barber can have multiple availability periods on the same day.

Example:

Monday:

* 09:00–13:00
* 14:00–18:00

**Indexes**

* `(barber_profile_id, day_of_week)`

---

### 10. `barber_time_off`

Stores exceptions to recurring availability.

Key fields:

* `id`
* `barber_profile_id`
* `start_at`
* `end_at`
* `reason`
* `created_at`

Used for:

* Leave
* Personal time
* Holidays
* Temporary unavailability

**Indexes**

* `(barber_profile_id, start_at, end_at)`

---

## Appointments

### 11. `appointments`

The central booking entity.

Key fields:

* `id`
* `shop_id`
* `customer_user_id`
* `barber_profile_id`
* `service_id`
* `start_at`
* `end_at`
* `status`
* `booking_note`
* `created_at`
* `updated_at`
* `cancelled_at`
* `completed_at`

Possible initial statuses:

* `booked`
* `completed`
* `cancelled`
* `no_show`

The appointment stores the selected service and barber directly so historical bookings remain understandable even if shop configuration changes later.

**Indexes**

* `(shop_id, start_at)`
* `(barber_profile_id, start_at)`
* `(customer_user_id, start_at)`
* `(shop_id, status, start_at)`

### Booking integrity

The backend must prevent overlapping active appointments for the same barber.

Do not rely solely on frontend availability calculations.

The booking transaction should re-check availability and protect against concurrent booking attempts.

PostgreSQL constraints/locking or an appropriate transactional strategy should be used to ensure two customers cannot successfully book the same barber/time.

---

### 12. `appointment_details`

Stores optional post-appointment information.

Key fields:

* `id`
* `appointment_id`
* `actual_service_id` — nullable
* `final_price` — nullable
* `notes` — nullable
* `completed_by_member_id`
* `created_at`
* `updated_at`

This is deliberately separate from the basic appointment record because booking information and post-service information are different concerns.

`actual_service_id` allows the barber to record what was actually performed if it differs from the originally booked service.

**Constraints**

* Unique `appointment_id`

---

### 13. `barber_points`

Stores points awarded to barbers for completing the CRM workflow.

Key fields:

* `id`
* `barber_profile_id`
* `appointment_id`
* `points`
* `reason`
* `created_at`

For v1, the principal reason can be something like:

`appointment_record_completed`

**Constraints**

* Unique combination preventing the same qualifying appointment from awarding points multiple times.

**Indexes**

* `(barber_profile_id, created_at)`
* `(appointment_id)`

Keep the points model simple. Do not create rewards, badges, levels or redemption tables yet.

---

## Photos & Media

### 14. `media_assets`

Represents uploaded media metadata while actual files live in object storage/Supabase Storage.

Key fields:

* `id`
* `uploaded_by_user_id`
* `storage_path`
* `media_type`
* `created_at`

Do not store image binary data directly in PostgreSQL.

Storage access should be controlled separately from database access.

---

### 15. `appointment_media`

Associates media with a specific appointment.

Key fields:

* `id`
* `appointment_id`
* `media_asset_id`
* `media_type`
* `created_at`

Media types can distinguish:

* `customer_reference`
* `finished_cut`

This allows a customer reference image to remain associated with the booking without incorrectly making it a permanent customer preference.

---

### 16. `customer_preference_media`

Stores customer-level saved preference/reference images.

Key fields:

* `id`
* `customer_user_id`
* `media_asset_id`
* `caption`
* `created_at`

This is distinct from an appointment-specific reference.

---

## Reviews

### 17. `reviews`

Represents customer reviews for eligible completed experiences.

Key fields:

* `id`
* `appointment_id`
* `shop_id`
* `customer_user_id`
* `barber_profile_id` — nullable if barber rating is not provided
* `rating`
* `review_text`
* `created_at`
* `updated_at`

Reviews should only be accepted for eligible appointments, normally completed appointments.

**Constraints**

* One review per appointment per review type
* Rating constrained to the chosen range, e.g. 1–5

**Indexes**

* `(shop_id, created_at)`
* `(barber_profile_id, created_at)`
* `(customer_user_id, created_at)`

The review should retain its relevant shop/barber relationship even if later configuration changes.

---

## Relationships

Plain-text relationship model:

```text
users
 ├── customer_profiles
 ├── shop_members
 │    └── barber_profiles
 │
 └── media_assets

shops
 ├── shop_members
 ├── services
 ├── shop_customers
 ├── appointments
 └── reviews

shop_customers
 ├── customer (users)
 └── preferred_barber (barber_profiles)

barber_profiles
 ├── shop_member
 ├── barber_services
 ├── barber_working_hours
 ├── barber_time_off
 ├── appointments
 ├── barber_points
 └── reviews

services
 ├── barber_services
 └── appointments

appointments
 ├── customer (users)
 ├── barber (barber_profiles)
 ├── service
 ├── appointment_details
 ├── appointment_media
 ├── barber_points
 └── review

media_assets
 ├── appointment_media
 └── customer_preference_media
```

---

## Important Data Boundaries

### Global customer data

Visible to the customer themselves:

* Platform profile
* Their own cross-shop appointment history
* Their own saved preferences
* Their own photos

### Shop-scoped customer data

Visible only to authorized staff of that shop:

* `shop_customers`
* Shop-specific notes
* Shop-specific visit history
* Shop-specific preferred barber
* Shop-specific appointment information
* Reference media shared with that shop
* Shop-specific spending/service history

### Cross-shop isolation

Shop A must not be able to query or infer:

* Shop B appointments
* Shop B notes
* Shop B customer relationship records
* Shop B spending/history
* Shop B reference media

This isolation should be enforced at the **database RLS layer**, not only by FastAPI application logic.

---

## RLS / RBAC Direction

RLS should enforce the primary data ownership boundaries.

Conceptually:

### Customer

Can access:

* Their own `users`/profile data
* Their own appointments
* Their own history
* Their own preference media
* Their own reviews

### Barber

Can access:

* Shop data they are authorized to access
* Appointments assigned to them
* Customer information permitted by their shop role
* Relevant customer/reference media
* Their own barber profile
* Their own points

### Manager

Can access:

* Shop operational data
* Authorized customer CRM information
* Appointments
* Barbers
* Services
* Scheduling data

### Owner

Can manage:

* Shop
* Staff
* Permissions
* Services
* Customer CRM
* Appointments
* Shop configuration

Exact permissions belong in the RBAC implementation rather than being duplicated as dozens of database roles.

---

## Future Extension Boundaries

Do **not** create these tables in v1:

* `payments`
* `payment_transactions`
* `subscriptions`
* `payouts`
* `branches`
* `loyalty_accounts`
* `loyalty_transactions`
* `marketing_campaigns`
* `messages`
* `payroll`
* `inventory`

The current model should instead provide clean extension points:

```text
Shop
 └── future branches

Appointment
 └── future payment/order relationship

Customer
 └── future loyalty relationship

Shop
 └── future subscription relationship
```

These should be added when the corresponding product features are actually defined.

---

## Migration / Naming Conventions

Use:

* UUID primary keys
* `snake_case` database naming
* Explicit foreign keys
* Explicit indexes
* Explicit unique constraints
* UTC timestamps for stored timestamps
* Shop/barber timezone for availability calculations
* Alembic migrations for schema changes

SQLAlchemy models should remain modular by business domain rather than creating one enormous models file.

Suggested backend modules:

```text
app/
├── auth/
├── users/
├── shops/
├── staff/
├── services/
├── customers/
├── appointments/
├── availability/
├── media/
├── reviews/
└── points/
```

The exact implementation structure will be specified later in the backend prompt; this document defines the data model rather than the complete application architecture.

