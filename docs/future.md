# future.md

## Deferred Features

These features are intentionally **not part of v1**. The current architecture should leave clean extension points for them without creating speculative database tables now.

---

## 1. Payments

Potential future capabilities:

* Online payment
* Deposit before booking
* Full appointment payment
* Cancellation fees
* Refunds
* Digital receipts
* Payment status
* Shop payouts
* Platform commission

### Architectural direction

Keep payment logic separate from appointments.

A future payment module can associate transactions with an appointment without turning `appointments` into a payment table.

Potential future relationship:

```text
Appointment
    ↓
Payment / Transaction
    ↓
Payout
```

Do not create these entities in v1.

---

## 2. Multi-Branch Shops

A successful barber business may eventually operate:

```text
Business
 ├── Branch A
 ├── Branch B
 └── Branch C
```

V1 treats each shop as one physical location.

Later, introduce a business/organization layer above locations.

This should allow:

* Shared ownership
* Central staff management
* Branch-specific barbers
* Branch-specific services/pricing
* Branch-specific schedules
* Central analytics
* Cross-branch customer relationships where appropriate

Do not add the branch model until the product requirement is clear.

---

## 3. Loyalty

Potential future features:

* Visit-based points
* Spend-based rewards
* Membership tiers
* Discounts
* Free services
* Customer rewards
* Referral rewards

This should remain separate from the current **barber CRM points** system.

The current barber points mechanism is an operational incentive.

Customer loyalty is a separate business domain.

---

## 4. Customer Retention & Marketing

Once sufficient customer history exists, the platform could help shops identify:

* Customers who haven't visited recently
* Customers who regularly book certain services
* Customers due for their usual haircut
* High-frequency customers
* Inactive customers
* Customers who prefer specific barbers

Potential future capabilities:

* WhatsApp reminders
* SMS
* Email
* Automated rebooking reminders
* Campaigns
* Customer segments
* Promotional offers

The CRM data collected in v1 should make these features possible later without requiring a redesign.

---

## 5. Native Mobile Apps

V1 is a mobile-first responsive web application.

If the marketplace gains traction, consider:

### Customer React Native app

Potential benefits:

* Push notifications
* Faster repeat booking
* Better camera/photo experience
* Location features
* Saved preferences
* Mobile-native booking experience

### Barber app

Potential benefits:

* Appointment notifications
* Today's schedule
* Customer profile access
* Quick appointment completion
* Camera workflow for finished-cut photos
* Points tracking

The backend should remain API-first so native applications become another client rather than a new backend.

---

## 6. Advanced Scheduling

V1 supports:

* Working hours
* Time off
* Service-specific durations
* Existing bookings
* Optional buffers

Future scheduling could support:

* Recurring breaks
* Holidays
* Shop-wide closures
* Barber-specific holidays
* Split shifts
* Temporary schedule overrides
* Multiple services in one booking
* Consecutive service combinations
* Walk-in capacity
* Queue management
* Waitlists

The availability engine should remain an isolated domain so it can evolve without rewriting booking APIs.

---

## 7. Walk-Ins

A physical barber shop will often have customers who don't book online.

Future support could include:

> Walk-in arrives → receptionist/barber adds customer → selects service → assigns barber → queue/appointment created.

This would allow the CRM to capture both:

* Online appointments
* Physical walk-ins

That could substantially increase the value of the CRM.

---

## 8. Customer Profiles Becoming More Useful

Future customer profiles could contain:

* Favorite services
* Favorite barber
* Haircut preferences
* Saved reference styles
* Visit frequency
* Typical service duration
* Typical spend
* Rebooking patterns

Potential future experience:

> “You normally book Raj for a haircut every 3–4 weeks. Raj has availability tomorrow at 5:30 PM.”

This should be introduced only after enough usage data exists.

---

## 9. Barber Performance

Current v1 points are intentionally simple.

Future shop analytics could show:

* Appointments completed
* No-show rate
* Customer retention
* Average rating
* Repeat customers
* Revenue
* Services performed
* CRM completion rate
* Average appointment duration

The system should avoid turning this into an overly complicated performance-management tool initially.

---

## 10. Reviews & Reputation

Future improvements could include:

* Verified-appointment badges
* Barber-specific ratings
* Shop-specific ratings
* Review responses
* Review moderation
* Report review
* Photo reviews
* Review sorting
* Reputation analytics

The fundamental rule should remain:

> Reviews should be connected to legitimate customer experiences.

---

## 11. Search & Marketplace Improvements

Initial discovery is location-based.

At scale, marketplace search could incorporate:

* Distance
* Rating
* Price
* Service
* Barber
* Availability
* Popularity
* Customer preferences
* Repeat booking history
* Search relevance
* Sponsored listings

Eventually the marketplace could answer:

> “Find me a highly rated barber within 3 km who can do a fade tomorrow evening.”

---

## What Changes at 10× Users?

The architecture should evolve gradually rather than prematurely.

### Database

At 10× usage:

* Review query plans and indexes
* Optimize appointment availability queries
* Introduce PostGIS/geospatial optimization if not already used
* Add appropriate composite indexes
* Monitor slow queries
* Introduce read replicas if actual workload requires them
* Archive/partition very large historical datasets only when justified

Do not introduce database complexity simply because the product *might* grow.

---

### API

At 10× usage:

* Add caching for public shop/search data
* Cache frequently requested availability data carefully
* Add stronger rate limiting
* Introduce background jobs for non-critical work
* Improve API observability
* Add structured metrics

Booking confirmation remains transactional and strongly consistent.

---

### Media

At scale:

* Image resizing
* Multiple image sizes
* CDN delivery
* Compression
* Background processing
* Storage lifecycle policies

Reference images should not unnecessarily consume application-server resources.

---

### Search

If PostgreSQL search becomes insufficient:

```text
V1:
PostgreSQL search
      ↓
10×:
Optimized PostgreSQL/PostGIS
      ↓
Much larger scale:
Dedicated search infrastructure if justified
```

Do not introduce Elasticsearch/OpenSearch/etc. before there is a real need.

---

### Notifications

When messaging is introduced, notifications should move into a background-job architecture.

For example:

```text
Appointment created
        ↓
Event
        ↓
Background job
        ↓
Notification provider
```

This keeps booking confirmation fast and reliable.

---

### Payments

Payments should become an independent module:

```text
Appointment
     ↓
Payment
     ↓
Transaction
     ↓
Payout
```

Payment failures should not corrupt the core appointment record.

---

### Multi-Branch

When needed:

```text
Organization
 ├── Shop / Branch
 │    ├── Staff
 │    ├── Services
 │    └── Appointments
 │
 └── Shop / Branch
```

This is a migration of the ownership model rather than a reason to prematurely add branch tables now.

---

## Product Expansion Path

A sensible evolution is:

### Stage 1 — MVP

**Booking + CRM**

Customer:

> Discover → choose barber → book

Shop:

> Manage → serve → record customer

---

### Stage 2 — Retention

**CRM → repeat business**

Add:

* Rebooking reminders
* Customer insights
* Better history
* Loyalty
* Messaging

---

### Stage 3 — Marketplace

**More shops + more customers**

Add:

* Better discovery
* Search
* Reviews
* Ranking
* Promotions
* Customer recommendations

---

### Stage 4 — Commerce

**Booking → transaction**

Add:

* Deposits
* Payments
* Refunds
* Payouts
* Platform commissions

---

### Stage 5 — Platform

**Single-shop tool → barber business operating platform**

Add:

* Multi-branch
* Advanced analytics
* Staff management
* Marketing
* Loyalty
* Native apps
* Integrations

---

## Guiding Principle

The platform should scale through **modular expansion**, not premature complexity.

The v1 core remains:

```text
Customer
   ↓
Shop discovery
   ↓
Barber
   ↓
Service
   ↓
Availability
   ↓
Appointment
   ↓
Customer relationship
   ↓
Repeat visit
```

Everything else should attach cleanly to this core when the business proves that customers and shops actually need it.

---

