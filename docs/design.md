# design.md

## Visual Style / Tone

### Product character

The product should feel:

* **Modern**
* **Clean**
* **Trustworthy**
* **Local**
* **Fast**
* **Mobile-first**
* Professional without feeling corporate

The customer experience should feel closer to a polished local-services marketplace than an enterprise CRM.

The shop/barber experience should prioritize **speed and information density** without becoming visually complicated.

### UI principles

* Mobile-first layouts are the default.
* Primary actions should be reachable with one hand.
* Keep booking flows short and obvious.
* Use cards for shops, barbers and appointments.
* Use strong visual hierarchy for service, price, barber and availability.
* Use shadcn/ui components consistently.
* Avoid unnecessary dashboards, charts and decorative UI in v1.
* Use clear status indicators for appointment states.
* Use confirmation states after important actions.
* Photos should be treated as important content, especially barber profiles and haircut references.
* Forms should use progressive disclosure rather than presenting every option at once.

### Main navigation

**Customer mobile navigation**

* Discover
* Bookings
* History
* Profile

**Shop/barber navigation**

* Today
* Appointments
* Customers
* Shop
* More

The exact navigation can adapt based on the authenticated user's RBAC permissions.

---

## Key Screens

### 1. Customer Location / Discovery

Purpose: Quickly find relevant barber shops.

Components:

* Location selector
* Current location detection
* Search location
* Search/filter controls
* Map/list toggle
* Nearby shop cards
* Distance
* Rating
* Starting service price
* Next available appointment
* Shop image

Primary action:

**View shop**

---

### 2. Shop Profile

Purpose: Help the customer decide whether to book.

Components:

* Shop photos
* Shop name
* Rating/review count
* Location
* Opening hours
* Services
* Prices
* Available barbers
* Barber profile photos
* Barber basic information
* Next available time
* Reviews
* Book button

Primary actions:

**Choose service**

**Choose barber**

---

### 3. Barber Profile

Components:

* Barber photo
* Name
* Basic bio
* Services offered
* Service-specific pricing where applicable
* Service duration
* Rating/reviews if enabled
* Available dates/times

Primary action:

**Book with this barber**

---

### 4. Booking Flow

The booking flow should be progressive rather than one large form.

**Step 1 — Service**

Customer chooses:

* Haircut
* Shaving
* Beard trim
* Other shop-defined service

The system uses the selected barber's configured duration for the service.

**Step 2 — Barber**

Customer chooses a specific barber.

Only barbers who provide the selected service should be presented.

**Step 3 — Date**

Customer chooses a date.

**Step 4 — Availability**

The system calculates available slots using:

* Barber working hours
* Breaks
* Time off
* Existing appointments
* Service duration
* Optional buffer

Only valid slots are shown.

**Step 5 — Booking details**

Customer can:

* Add a note
* Attach reference haircut photo(s)
* Confirm contact information

**Step 6 — Confirmation**

Show:

* Shop
* Barber
* Service
* Date/time
* Duration
* Location
* Booking status

---

### 5. Customer Bookings

Shows:

* Upcoming appointments
* Appointment status
* Shop
* Barber
* Service
* Date/time
* Location

Actions:

* View appointment
* Cancel where permitted
* Reschedule where supported
* Open shop
* View booking reference photos

---

### 6. Customer History

Shows the customer's own cross-shop history.

Each history item can include:

* Shop
* Barber
* Date
* Services
* Final price where available
* Appointment status
* Customer notes/reference
* Finished-cut photo where shared with the customer

History should make it easy to answer:

> “Where did I get my haircut last time?”

and:

> “What services have I had at this shop?”

---

### 7. Customer Profile

Components:

* Basic customer information
* Saved preferences
* Saved/reference photos
* Appointment history entry point
* Privacy controls
* Account settings

Customers should be able to distinguish between:

* Photos/preferences saved to their profile
* Photos attached only to a specific booking

---

## Shop Owner Experience

### 8. Shop Dashboard / Today

The dashboard should focus on today's operational work rather than analytics.

Components:

* Today's appointments
* Current/next appointment
* Appointment statuses
* Barber availability
* No-show/completion indicators
* Quick actions

Primary actions:

**View appointment**

**Manage booking**

---

### 9. Appointments

Components:

* Day/date selector
* Barber filter
* Appointment list/calendar
* Status filters
* Appointment details

Appointment statuses should include at minimum:

* Booked
* Completed
* Cancelled
* No-show

The UI should make the current state obvious.

---

### 10. Appointment Detail

For authorized staff:

* Customer name
* Customer profile
* Customer's shop-specific history
* Reference photos
* Booking service
* Barber
* Date/time
* Notes
* Appointment status

After the appointment, the barber can:

**Complete appointment**

Then optionally record:

* Actual service
* Final price
* Notes
* Finished haircut photo

Or:

**Skip details**

Or:

**Customer didn't come**

The detailed completion workflow awards points.

---

### 11. Customer CRM

Shop staff can search customers belonging to their shop.

Customer detail includes:

* Name/contact information
* Number of visits
* Last visit
* Services received
* Preferred barber
* Shop-specific notes/preferences
* Reference photos shared with the shop
* Appointment history
* Spending/service history where recorded

The UI must clearly represent that this is **the shop's customer relationship**, not the customer's global platform history.

---

### 12. Barber Management

Owner/admin can:

* View barbers
* Add barber
* Edit barber
* Upload barber photo
* Set basic information
* Assign services
* Set service duration
* Configure working hours
* Configure breaks/time off
* Activate/deactivate barber
* Manage permissions

---

### 13. Service Management

Shop staff with appropriate permission can:

* Create service
* Edit service
* Set price
* Activate/deactivate service
* Assign service to barbers
* Set barber-specific duration

Example:

**Haircut**

* Raj — ₹300 — 15 min
* Arun — ₹250 — 20 min

---

### 14. Shop Settings

Components:

* Shop profile
* Photos
* Address/location
* Opening hours
* Services
* Staff
* Booking settings
* Permissions

---

### 15. Reviews

Customer:

* Submit rating/review after an eligible completed appointment
* View their submitted reviews

Shop:

* View reviews received
* See rating summary
* Responding to reviews can be deferred if not needed for v1

Reviews should be tied to legitimate appointment history to reduce fake reviews.

---

## Core User Flows

### Customer discovery → booking

**Location → Nearby shops → Shop → Service → Barber → Date → Available slot → Booking details → Confirmed**

### Returning customer

**Open app → Bookings/History → Shop → Service → Preferred barber → Available slot → Confirm**

### New shop onboarding

**Create account → Create shop → Add basic shop information → Add services → Add barbers → Assign services → Configure barber schedules/durations → Start accepting bookings**

### Barber appointment workflow

**Today → Appointment → Customer profile → Reference photo/history → Perform service → Complete / Skip / No-show → Optional service/price/notes/photo → Points if completed**

### Owner management

**Dashboard → Appointments / Customers / Barbers / Services / Shop Settings**

---

## Responsive Strategy

Although the product is web-based, **mobile is the primary design target**.

Customer screens should be designed for approximately **360px+ mobile widths first**, then expanded for tablets and desktop.

Shop management should remain fully usable on mobile, while taking advantage of larger screens through:

* Multi-column layouts
* Calendar views
* Side panels
* Larger customer/service tables

No critical workflow should require desktop.
