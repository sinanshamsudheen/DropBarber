# security.md

## Security Approach

This product is a multi-tenant marketplace and CRM, so the most important security property is:

> **One shop must never be able to access another shop's private customer data.**

The security model should use multiple layers rather than relying on FastAPI checks alone:

**Supabase Auth/JWT → FastAPI authentication → RBAC → PostgreSQL RLS → Storage policies**

For v1, this is sufficient without introducing a large enterprise security framework.

---

## Authentication

Use **JWT-based authentication**.

### Access tokens

* Short-lived JWT access tokens
* Sent using the standard `Authorization: Bearer <token>` header
* FastAPI validates signature, expiration and relevant claims
* Never trust user identity information supplied separately in request bodies

The authenticated user ID should come from the verified JWT.

### Refresh tokens

Use secure refresh-token handling appropriate to the chosen Supabase Auth flow.

Requirements:

* Never log refresh tokens
* Never place refresh tokens in URLs
* Revoke/invalidate sessions on logout where supported
* Rotate refresh tokens where supported by the authentication system

### Passwords

Do not store passwords in the FastAPI application database.

Use the Supabase authentication system for credential management.

---

# Authorization

Authentication answers:

> “Who is this?”

RBAC answers:

> “What can this person do?”

RLS answers:

> “Which database rows can this person access?”

All three are required.

---

## Roles

Initial shop roles:

### Owner

Can:

* Manage shop
* Manage staff
* Manage services
* Manage schedules
* Manage appointments
* Manage customer CRM
* View barber points
* Manage shop permissions

### Manager

Can perform operational tasks granted by the shop's permission configuration.

Should generally have access to:

* Appointments
* Customers
* Services
* Barbers
* Scheduling

### Barber

Can:

* View their own appointments
* View relevant customer information
* View permitted shop customer history
* View booking reference photos
* Complete appointments
* Mark no-shows
* Add permitted CRM information
* View their own points
* Manage permitted profile/schedule information

A barber should not automatically receive owner-level shop management capabilities.

### Customer

Can:

* Manage their own profile
* Discover public shops
* Book appointments
* View their own appointments
* View their own cross-shop history
* Manage their own reference/preferences
* Submit eligible reviews

---

# Multi-Tenant Isolation

This is the highest-priority security boundary.

The application must treat each shop as an isolated tenant for private CRM information.

Example:

```text
Customer A
 ├── Shop 1 relationship
 │    ├── appointments
 │    ├── notes
 │    ├── preferences
 │    └── reference photos
 │
 └── Shop 2 relationship
      ├── appointments
      ├── notes
      └── reference photos
```

A Shop 1 barber can access only the Shop 1 branch of this relationship.

They cannot access Shop 2 data.

---

# PostgreSQL RLS

Enable RLS on all tables containing sensitive or tenant-specific data.

Especially:

* `shop_members`
* `shop_customers`
* `appointments`
* `appointment_details`
* `barber_profiles`
* `barber_services`
* `barber_working_hours`
* `barber_time_off`
* `barber_points`
* `media_assets`
* `appointment_media`
* `customer_preference_media`
* `reviews`

Public tables/data should still expose only deliberately public fields through application queries/API responses.

---

## RLS Principles

RLS policies should derive authorization from the authenticated identity rather than trusting a client-supplied `shop_id`.

For example, a request such as:

```text
GET /shops/shop-A/customers
```

must not give a Shop B employee access simply because they know `shop-A`'s ID.

The database policy must verify the user's actual shop membership/authorization.

---

# FastAPI Authorization

FastAPI should perform authorization before executing business operations.

For example:

```text
JWT
 ↓
Authenticated user
 ↓
Shop membership
 ↓
Role
 ↓
Permission
 ↓
Business operation
 ↓
Database/RLS
```

Do not scatter authorization logic throughout individual route handlers.

Use reusable dependencies/services such as:

* authenticated user dependency
* shop membership dependency
* permission dependency

This keeps authorization consistent.

---

# Customer Privacy

Customers have two different data scopes.

### Customer-owned

The customer can see:

* Their own account
* Their own history
* Their own bookings
* Their own saved preferences
* Their own photos
* Their own reviews

### Shop-owned relationship data

A shop can see only the information generated/shared within its relationship with that customer.

For example:

Shop A can see:

> Customer visited Shop A six times.

It cannot see:

> Customer visited Shop B four times.

The customer's global history must never be exposed through shop CRM APIs.

---

# Reference Photos

Photos are potentially sensitive user-generated content.

Use Supabase Storage rather than storing image binaries directly in PostgreSQL.

Storage paths should be logically separated, for example:

```text
customer/
appointment/
shop/
```

Access should be controlled through storage policies and application authorization.

Do not expose unrestricted public bucket URLs for private customer reference images.

Use controlled access/signed URLs where appropriate.

---

# Photo Upload Security

Uploads should have:

* Maximum file size
* Allowed MIME types
* Image format validation
* Server-side validation
* Safe/generated storage names
* No trust in client-provided filenames

The system should not execute or serve uploaded files as executable content.

---

# Sensitive Customer Data

Treat the following as private:

* Phone number
* Email
* Customer notes
* Shop-specific preferences
* Appointment history
* Spending/service history
* Reference photos
* Finished haircut photos when not public
* Internal barber notes

Only expose the minimum necessary data for each UI.

For example, a public shop profile does not need access to customer phone numbers.

---

# Booking Security

The booking endpoint is security-sensitive because availability can change between display and confirmation.

The backend must:

1. Authenticate customer.
2. Verify shop is active/bookable.
3. Verify barber belongs to shop.
4. Verify service belongs to shop.
5. Verify barber provides service.
6. Verify requested date/time is valid.
7. Recalculate availability.
8. Prevent overlapping appointments transactionally.
9. Create appointment only after all checks succeed.

Never trust the frontend's claimed availability.

---

# Appointment State Security

Only authorized roles should be able to transition appointment states.

Example:

```text
Customer
  → can request cancellation where allowed

Barber
  → complete
  → no-show
  → add permitted completion details

Manager/Owner
  → broader appointment management
```

Customers should never be able to submit:

```text
status = "completed"
```

or award points to themselves.

The backend determines state transitions.

---

# Barber Points

Points are derived from authorized actions.

Never accept:

```json
{
  "points": 100
}
```

from a client.

Instead:

```text
Authorized appointment completion
        ↓
Backend determines eligibility
        ↓
Backend awards configured points
```

Point awarding must be **idempotent** so retries cannot award duplicate points.

---

# Reviews

Only eligible customers should be able to create reviews.

The backend verifies:

* User owns appointment
* Appointment belongs to the relevant shop
* Appointment was completed
* Review has not already been submitted
* Rating is valid

This prevents arbitrary users from creating reviews.

---

# Input Validation

FastAPI/Pydantic validation should be used for all incoming API data.

Validate:

* UUIDs
* Dates/times
* Numeric prices
* Rating ranges
* Service durations
* File metadata
* Text lengths
* Enum/status values

Never trust client-side validation alone.

---

# SQL Injection

Use SQLAlchemy parameterized queries and ORM/query APIs.

Do not construct SQL from raw user strings.

Raw SQL should only be used when genuinely necessary and parameterized correctly.

---

# Rate Limiting

For v1, apply rate limiting particularly to:

* Login
* Registration
* Refresh
* Public shop search
* Availability queries
* Booking creation
* Review creation
* Media uploads

A basic API rate-limiting layer is sufficient initially.

More sophisticated abuse prevention can be deferred until traffic warrants it.

---

# CORS

Allow requests only from known frontend origins.

Do not use:

```text
Access-Control-Allow-Origin: *
```

for authenticated production API access.

Development and production origins should be separately configured through environment variables.

---

# Secrets

Never commit:

* JWT secrets
* Supabase service-role keys
* Database passwords
* Storage credentials
* API keys

Use environment variables/secrets management.

The Supabase **service-role key must never be exposed to the browser**.

---

# Logging

Logs should help diagnose problems without becoming a source of customer-data leakage.

Do not log:

* Passwords
* Access tokens
* Refresh tokens
* Full customer notes
* Private reference-photo URLs
* Sensitive personal information unnecessarily

Useful logs include:

* Request ID
* User ID where appropriate
* Shop ID
* Endpoint
* Response status
* Error code
* Timing

---

# Database Security

Production database access should follow least privilege.

The application should not use a database credential with unnecessary administrative capabilities.

Migrations should use appropriate privileged credentials separately from normal runtime access where practical.

Backups should be enabled through the managed database infrastructure.

---

# Deferred for V1

For the initial product, we can reasonably defer:

* Advanced fraud detection
* Device fingerprinting
* Enterprise SSO
* SOC 2 program
* Detailed security information/event management
* Advanced anomaly detection
* Dedicated WAF configuration
* Complex bot mitigation
* Full penetration-testing program
* Data-loss-prevention tooling
* Enterprise audit/compliance workflows

These become more relevant as the platform grows.

---

# Security Principles for Future Expansion

When payments, branches, loyalty, messaging or other modules are introduced, each should have:

1. Its own domain/module boundary.
2. Explicit authorization rules.
3. Appropriate RLS policies.
4. Minimal access to customer data.
5. Clear ownership relationships.
6. Its own migration changes rather than modifying unrelated data structures unnecessarily.

The existing architecture should therefore scale by **adding secured modules**, not by turning the core appointment/customer tables into a giant shared system.
