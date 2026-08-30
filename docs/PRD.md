Locked in. I’ll use this stack and structure consistently throughout the project:

* **Frontend:** React + TypeScript
* **UI:** shadcn/ui
* **Priority:** Mobile-first
* **Backend:** Python + FastAPI
* **Database:** Supabase PostgreSQL
* **ORM:** SQLAlchemy
* **Migrations:** Alembic
* **Security:** PostgreSQL RLS + proper RBAC
* **Architecture:** Standard modular monolith
* **Scale principle:** Build clean boundaries for future payments, branches, loyalty, messaging, etc., without creating those unused tables now.

## 1. PRD.md

### Problem

Barber shops often manage appointments and customer relationships through a mixture of WhatsApp, phone calls, paper records, calendars, and memory. This makes it difficult to maintain customer history, understand preferences, manage multiple barbers, and provide a consistent booking experience.

Customers also have limited ways to discover nearby shops, compare barbers, see availability, communicate what service they want, and preserve useful haircut preferences or reference images.

The product combines a **location-based barber marketplace** with a **shop-specific CRM and appointment management system**.

### Target User

**Primary users**

* Independent and small-to-medium barber shops with multiple barbers
* Barber shop owners/managers
* Barbers
* Customers looking for nearby barber services

**Initial market**

* Start with a focused geographic market and expand after validating shop adoption and customer bookings.

### Core Features

#### 1. Location-Based Shop & Barber Discovery

Customers can:

* Discover nearby barber shops using their location
* Search a different location
* Browse shops in map/list views
* View shop ratings and reviews
* View shop details, services, prices, barbers and availability

#### 2. Barber-Specific Booking

Customers can:

* Select a shop
* Select a service/reason such as haircut, shaving or beard trim
* Select a specific barber
* Select a date
* See only available time slots
* Book an appointment
* Add a booking note
* Attach reference haircut photos

Availability is calculated using the selected barber's working schedule, service duration, existing appointments, breaks/time off and optional buffer time.

Service duration can differ between barbers.

#### 3. Shop & Barber Management

Shop owners can:

* Create and manage their shop
* Add and manage multiple barbers
* Add barber profile information and photos
* Configure barber availability
* Configure which services each barber provides
* Configure service duration per barber
* Manage staff access and permissions
* Manage shop information, services and pricing

#### 4. Shop-Specific Customer CRM

Authorized shop staff can see customer information belonging to their shop relationship, including:

* Appointment history with that shop
* Services received
* Preferred barber
* Customer notes/preferences
* Relevant reference photos
* Visit history
* Basic spending/service history

A shop cannot see a customer's relationship/history with other shops.

Customers can see their own broader history across shops.

#### 5. Appointment Completion & Barber Points

After an appointment, a barber can:

* Mark the appointment completed
* Record the actual service
* Record final price
* Add notes
* Optionally upload a finished haircut photo
* Skip the additional record-keeping workflow
* Mark the customer as a no-show

Completing the detailed appointment workflow earns barber points.

Skipping earns no points.

No-shows earn no points.

The points system is intentionally simple in v1 and exists primarily to encourage useful CRM data.

#### 6. Ratings, Reviews & Customer History

Customers can review shops after eligible/completed appointments.

Customers can view their own cross-shop history, including:

* Shops visited
* Appointments
* Services received
* Relevant appointment information

Shop-specific customer data remains isolated to that shop.

### Out of Scope — V1

The following are explicitly deferred:

* Online payments
* Deposits and cancellation fees
* Subscriptions
* Automated WhatsApp/SMS marketing
* Loyalty programs
* Payroll
* Inventory management
* Multi-branch management
* Advanced analytics
* Native mobile applications
* Complex gamification
* Payment/payout infrastructure

The database and modular architecture should allow these to be introduced later without requiring a fundamental redesign, but speculative tables will not be created in v1.

### Success Criteria

The MVP succeeds if:

1. A shop can onboard itself, add barbers/services and configure availability without significant assistance.
2. A customer can discover a nearby shop and barber on a mobile device.
3. A customer can select a service, date and barber and receive valid available slots.
4. A customer can successfully book an appointment.
5. The selected shop/barber can see and manage the appointment.
6. The barber can access relevant customer history and reference photos.
7. A barber can complete an appointment and update the CRM in a short workflow.
8. Customer data remains correctly isolated between shops through RBAC and RLS.
9. Customers can see their own history across multiple shops without exposing that history to individual shops.
10. The system can support adding future capabilities such as payments, branches and loyalty without restructuring the core appointment/shop/customer model.

