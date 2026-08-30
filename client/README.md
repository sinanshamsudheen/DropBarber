# Barber Connect Hub

Build a production-quality, mobile-first barber marketplace + CRM web application.

IMPORTANT:

- This is a real product, not a landing-page mockup.

- Build the complete frontend experience described below.

- Prioritize mobile usability above desktop.

- Do not ask clarifying questions; make sensible UI decisions based on these requirements.

- Do not invent major features outside this specification.

- Keep the architecture clean enough to connect to a real backend later.

- Use realistic sample data where backend data is not yet connected.

- Keep public customer experiences separate from authenticated shop-management experiences.

- Implement proper loading, empty, error, and success states throughout.

- The visual style should be modern, clean, trustworthy, local, fast, and professional without feeling corporate.

PRODUCT

This product is a location-based barber marketplace combined with a barber-shop-specific CRM and appointment management system.

Customers discover nearby barber shops, browse barbers and services, see ratings/reviews, select a specific barber, choose a service and date, see dynamically calculated availability, and book an appointment.

Barber shops use the product to manage their shop, barbers, services, schedules, appointments, and customer relationships.

The CRM is shop-scoped:

- A shop can only see its relationship/history with a customer.

- A shop must never see that customer's history with other shops.

- Customers themselves can see their own history across shops.

The product is mobile-first. Customers should be able to complete the primary booking flow comfortably with one hand.

CORE CUSTOMER JOURNEY

Location/search

→ nearby shops

→ shop profile

→ choose service

→ choose barber

→ choose date

→ available slots

→ booking details

→ confirmation

CUSTOMER NAVIGATION

Use a mobile-friendly bottom navigation or equivalent:

- Discover

- Bookings

- History

- Profile

Authenticated customer screens should be reachable quickly.

PUBLIC CUSTOMER EXPERIENCE

1. DISCOVERY SCREEN

Create a polished location-based discovery experience.

Top area:

- Current location or selected search location

- Ability to search for another location

- Search field

- Filter controls

Main content:

- Map/list toggle

- Nearby barber shop cards

Each shop card should show:

- Shop image

- Shop name

- Rating

- Review count

- Distance

- Location summary

- Starting/representative service price

- Next available appointment if available

Allow customers to search a different location instead of forcing current-location-only discovery.

Include useful states:

- Requesting location permission

- Location unavailable

- No shops found

- Loading shops

- Search error

Do not make the map the only way to discover shops. A list view must work independently.

2. SHOP PROFILE

Create a visually strong shop profile.

Show:

- Shop photos

- Shop name

- Rating and review count

- Location

- Distance where relevant

- Opening hours

- Services

- Prices

- Available barbers

- Barber photos

- Barber basic information

- Reviews

- Next available time where available

Primary CTA:

- Book

Secondary actions can include:

- View location

- View reviews

- View barber

The shop page should make the booking action obvious without being aggressive.

3. BARBER PROFILE

Show:

- Barber profile photo

- Name

- Short bio

- Services they provide

- Service price where applicable

- Service duration

- Public rating/reviews if available

- Available dates/times

Primary CTA:

- Book with this barber

4. BOOKING FLOW

Make booking a progressive, focused flow rather than a huge form.

STEP 1 — SERVICE

Show services such as:

- Haircut

- Shaving

- Beard trim

- Haircut + beard

- Other shop-defined services

Each service can display:

- Name

- Description

- Price

- Approximate duration

IMPORTANT:

The duration is barber-specific.

Do not assume every barber takes the same amount of time for a service.

STEP 2 — BARBER

Show active barbers who provide the selected service.

Each barber card:

- Photo

- Name

- Basic info

- Service duration

- Price if different

- Rating if available

Allow the customer to select a specific barber.

STEP 3 — DATE

Use a mobile-friendly date selector.

Make the selected date obvious.

STEP 4 — AVAILABLE TIMES

Show only slots that are returned by the availability system.

Do not calculate authoritative availability on the frontend.

The UI should conceptually support:

- Barber working hours

- Breaks

- Time off

- Existing appointments

- Barber-specific service duration

- Optional buffer

Show available slots as easy-to-tap buttons/cards.

Unavailable times should not be presented as selectable.

Handle:

- No availability

- Loading availability

- Availability changing

- Slot becoming unavailable

If a slot becomes unavailable during booking, clearly ask the customer to choose another time.

STEP 5 — BOOKING DETAILS

Show a summary:

- Shop

- Barber

- Service

- Date

- Time

- Duration

- Price

Allow:

- Optional booking note

- Reference haircut photo upload

Explain the difference between:

- Reference photo for this appointment

- Saved preference/reference photo

Reference photos should feel like an important but optional part of the booking.

STEP 6 — CONFIRMATION

Show a strong confirmation state.

Include:

- Confirmation/status

- Shop

- Barber

- Service

- Date/time

- Location

- Reference photo indicator

- Appointment details

Primary actions:

- View booking

- Back to discover

5. BOOKINGS SCREEN

Separate:

- Upcoming

- Past

Upcoming appointment cards should show:

- Shop

- Barber

- Service

- Date

- Time

- Status

Actions:

- View appointment

- Cancel where allowed

- Reschedule where supported

- View shop

- View reference photos

Past appointments should allow:

- View details

- Review if eligible

6. CUSTOMER APPOINTMENT DETAIL

Show:

- Shop

- Barber

- Service

- Date/time

- Status

- Location

- Booking notes

- Reference photos

- Relevant completion information when available

For completed appointments:

- Show service performed

- Final price if recorded

- Finished-cut photo if available

- Review action if eligible

7. CUSTOMER HISTORY

This is the customer's global personal history.

Make the distinction very clear:

"This is your personal history across the shops you've visited."

Show:

- Shop

- Date

- Barber

- Services

- Final price where available

- Appointment status

Allow the customer to answer:

- Where did I go last time?

- Which barber did I use?

- What service did I get?

Do NOT show internal shop notes or private shop CRM information.

8. CUSTOMER PROFILE

Show:

- Profile photo

- Name

- Contact details

- Saved preferences

- Saved reference photos

- History entry point

- Account settings

- Privacy controls

Saved photos should be clearly different from appointment-specific reference photos.

Allow customers to add/remove saved reference photos and optional captions.

9. CUSTOMER REVIEWS

After an eligible completed appointment, let the customer:

- Rate the shop

- Optionally rate the barber if supported

- Add written review

Make it clear that reviews are tied to actual appointments.

Show submitted reviews in the customer's history/profile where appropriate.

SHOP/STAFF EXPERIENCE

Authenticated users may belong to shops with different permissions.

The UI must adapt to permissions without exposing unauthorized navigation or actions.

SHOP NAVIGATION

Use a mobile-friendly navigation structure:

- Today

- Appointments

- Customers

- Shop

- More

For larger screens, adapt into a sidebar or equivalent.

10. SHOP TODAY DASHBOARD

This is an operational dashboard, not an analytics-heavy dashboard.

Show:

- Today's date

- Upcoming appointments

- Current/next appointment

- Appointment statuses

- Barber availability

- Quick actions

Prioritize what the shop needs right now.

Example:

"Next appointment — 10:30 AM — Arun — Haircut — John"

Allow authorized users to open appointment details quickly.

11. APPOINTMENTS

Create a practical appointment management screen.

Support:

- Date selection

- Day view

- Barber filtering

- Status filtering

- Appointment list/calendar

Appointment statuses:

- Booked

- Completed

- Cancelled

- No-show

Make statuses visually distinct but avoid excessive visual noise.

Appointments should be easy to open on mobile.

12. APPOINTMENT DETAIL FOR BARBER/STAFF

Show:

Customer:

- Name

- Basic information

- Relevant shop-specific history

- Preferred barber

- Shop-specific notes

- Relevant reference photos

Appointment:

- Service

- Barber

- Date/time

- Duration

- Booking note

- Status

Make customer reference images prominent enough to be useful during the appointment.

After the service, provide three clear paths:

A. COMPLETE APPOINTMENT

Open a lightweight completion form.

Fields:

- Actual service

- Final price

- Notes

- Optional finished haircut photo

Submitting the detailed completion workflow:

- Marks appointment completed

- Saves the CRM information

- Awards the barber points

B. SKIP DETAILS

Allow the barber to close the appointment without filling in the detailed CRM information.

No points.

C. CUSTOMER DIDN'T COME

Mark appointment as no-show.

No points.

Do not punish the barber visually for skipping. The points system is an incentive, not a mandatory workflow.

13. CUSTOMER CRM

Create a shop-specific customer directory.

Show:

- Search

- Customer list

- Visit count

- Last visit

- Preferred barber where available

- Basic customer information

Customer detail screen:

Header:

- Customer name

- Profile photo if available

- Basic contact information

Summary:

- Visits to this shop

- Last visit

- Preferred barber

- Relevant services

- Spending/history summary if available

Sections:

- Appointment history

- Services

- Notes/preferences

- Reference photos

IMPORTANT PRIVACY RULE:

This screen represents the relationship between this customer and THIS shop.

Never show the customer's visits to other shops.

Do not include a fake "global customer history" section in the shop CRM.

14. BARBER MANAGEMENT

Owner/manager view.

List barbers with:

- Photo

- Name

- Status

- Services

- Today's appointment count

Allow:

- Add barber

- Edit barber

- Activate/deactivate barber

- View barber

- Configure services

- Configure working hours

- Configure time off

BARBER PROFILE FORM

Fields:

- Name

- Profile photo

- Bio

- Services

- Other basic information

Keep onboarding fast.

15. BARBER SERVICE CONFIGURATION

For each barber, show assigned services.

Allow the shop to configure:

Example:

Haircut

- Raj: 15 min

- Arun: 25 min

For each barber/service combination:

- Active/inactive

- Duration

- Optional price override

Make it extremely clear that service duration can differ between barbers.

16. SERVICE MANAGEMENT

Show shop services.

Each service:

- Name

- Description

- Price

- Active/inactive

Allow:

- Add service

- Edit service

- Deactivate service

Do not create a global service marketplace catalog in the frontend.

Services belong to shops.

17. BARBER SCHEDULE

Allow authorized users to configure:

Recurring working hours:

- Day

- Start

- End

Support multiple periods per day.

Example:

Monday

09:00–13:00

14:00–18:00

Also support:

- Time off

- Leave

- Temporary unavailability

The schedule UI should be easy to use on mobile.

18. SHOP SETTINGS

Allow authorized users to manage:

- Shop name

- Description

- Photos

- Address

- Location

- Contact details

- Opening information

- Services

- Staff

- Booking-related settings

- Permissions where applicable

19. REVIEWS FOR SHOP

Show:

- Rating summary

- Reviews

- Rating distribution if useful

- Recent reviews

Only display legitimate customer reviews.

Do not create review moderation workflows beyond what is necessary for v1.

20. BARBER POINTS

For barbers:

- Current points

- Simple point history

For owners/managers:

- Barber points overview

Keep this simple.

The purpose is to encourage completion of useful CRM records.

Do not add:

- Badges

- Levels

- Rewards

- Redemption

- Complex leaderboards

Those are future features.

AUTHENTICATION EXPERIENCE

Provide:

- Sign up

- Log in

- Logout

- Session persistence

- Forgot password/reset flow where the authentication provider supports it

The UI should support different account contexts:

Customer

Shop owner

Manager

Barber

A user may belong to multiple shops.

If a user has multiple shop memberships, provide a clear shop selector/context switcher in the management experience.

Do not mix customer marketplace navigation with shop management navigation in confusing ways.

PERMISSIONS

The frontend should hide actions the user does not have permission to perform, but this is only a UX layer.

Never treat frontend permissions as the security boundary.

Expected roles:

OWNER:

- Full shop management

MANAGER:

- Operational management based on assigned permissions

BARBER:

- Own/assigned appointments

- Relevant customer information

- Appointment completion

- Own points

- Permitted profile/schedule actions

CUSTOMER:

- Own account

- Own bookings

- Own history

- Own preferences/photos

- Reviews

GLOBAL CUSTOMER HISTORY

Customers can see their own cross-shop history.

Shop staff cannot.

This distinction should be reflected clearly in navigation and UI language.

MEDIA/PHOTO UX

Reference photos are important.

Support:

- Upload from camera on mobile where supported

- Upload from device

- Preview

- Remove before submission

- Multiple reference photos where appropriate

- Captions for saved preference images

Distinguish:

"Reference for this appointment"

from:

"Saved style/preference"

Finished haircut photos should appear as part of the completed appointment record.

Do not automatically make finished haircut photos public.

STATES

Every data-driven screen must have:

Loading:

- Use skeletons where appropriate

- Avoid blocking the entire app unnecessarily

Empty:

- Explain what is empty

- Give a useful next action

Error:

- Clear human-readable message

- Retry action where appropriate

Success:

- Confirm the operation

- Make the next action obvious

Examples:

No appointments:

"You don't have any upcoming appointments."

No customers:

"Customers will appear here after they book or visit your shop."

No availability:

"No available times for this barber and service on this date."

No shops:

"No barber shops found near this location."

BOOKING UX REQUIREMENTS

Booking is the most important customer workflow.

Make it:

- Fast

- Obvious

- Mobile-first

- Low friction

Keep the booking summary visible before confirmation.

Do not ask for unnecessary information.

The customer should not need to create a complicated profile before browsing shops.

If authentication is required at booking time, preserve the selected shop/service/barber/date/time so the customer does not have to restart.

AVAILABILITY UX

The frontend receives available slots from the backend.

Do not hardcode service duration.

Do not calculate booking conflicts in the frontend.

The backend is authoritative.

If a selected slot becomes unavailable:

- Explain that availability changed

- Refresh availability

- Let the customer choose another slot

- Preserve their selected service/barber/date

RESPONSIVE DESIGN

Design mobile first.

Primary target:

- Approximately 360px and above

Then adapt to:

- Larger phones

- Tablets

- Desktop

Customer booking should feel excellent on mobile.

Shop management should also work on mobile, but desktop can introduce:

- Sidebar navigation

- Multi-column dashboards

- Larger appointment/calendar layouts

- Customer tables

Do not create a desktop-only workflow.

COMPONENT SYSTEM

Use a consistent component system.

Reusable components should include concepts such as:

- ShopCard

- BarberCard

- ServiceCard

- AppointmentCard

- Rating

- ReviewCard

- TimeSlotPicker

- DatePicker

- CustomerCard

- CustomerHistory

- ReferencePhotoUploader

- BarberSchedule

- StatusBadge

- EmptyState

- ErrorState

- LoadingSkeleton

- ConfirmationDialog

- MobileBottomNav

- ManagementSidebar

Keep components reusable but do not over-abstract every small element.

STATE MANAGEMENT

Keep state management proportional to the application.

Use:

- Local component state for simple UI state

- URL/query state for search/filter/date where useful

- Server-state/data-fetching layer for API data

- Small shared authentication/session state

- Avoid introducing a large global state architecture for data that belongs to individual screens

The main sources of truth should be:

- Backend API

- Auth/session

- Local UI state

Do not duplicate server data unnecessarily in global client state.

ROUTING

Structure routes around product domains.

Conceptually:

Public:

- /discover

- /shops/:shopId

- /shops/:shopId/barbers/:barberId

- /shops/:shopId/book

Customer:

- /bookings

- /bookings/:appointmentId

- /history

- /profile

Shop management:

- /manage/:shopId

- /manage/:shopId/appointments

- /manage/:shopId/appointments/:appointmentId

- /manage/:shopId/customers

- /manage/:shopId/customers/:customerId

- /manage/:shopId/barbers

- /manage/:shopId/services

- /manage/:shopId/schedule

- /manage/:shopId/reviews

- /manage/:shopId/settings

Adapt exact routing conventions to the generated application.

Do not expose management routes to unauthorized users.

DESIGN LANGUAGE

Use:

- Clean cards

- Generous but efficient spacing

- Strong typography hierarchy

- Clear primary CTAs

- Rounded controls where appropriate

- Subtle borders and elevation

- High-quality image presentation

- Accessible contrast

- Touch-friendly controls

Avoid:

- Excessive gradients

- Excessive animations

- Overloaded dashboards

- Tiny touch targets

- Giant hero sections that push useful content below the fold

- Enterprise-looking tables on mobile

- Unnecessary charts in v1

ANIMATION

Use subtle transitions:

- Page transitions where helpful

- Card interactions

- Loading states

- Modal/sheet transitions

- Booking confirmation

Do not animate critical workflows excessively.

ACCESSIBILITY

Implement:

- Keyboard navigation

- Focus states

- Semantic HTML

- Accessible labels

- Accessible dialogs

- Sufficient contrast

- Touch targets appropriate for mobile

- Screen-reader-friendly form errors

PHOTO/IMAGE HANDLING

Use proper image previews.

Do not assume images are always landscape.

Support portrait mobile photos.

Use cropping/compression strategies where appropriate.

Never expose private customer media simply because the image URL exists.

BACKEND INTEGRATION BOUNDARY

Build the frontend so the backend can later provide:

Authentication:

- JWT/session information

Public discovery:

- Shops

- Services

- Barbers

- Reviews

Availability:

- Service-specific

- Barber-specific

- Date-specific available slots

Appointments:

- Create

- Read

- Cancel

- Reschedule

- Complete

- No-show

CRM:

- Shop customers

- Customer history

- Notes

- Preferences

Media:

- Reference photos

- Finished haircut photos

Shop management:

- Staff

- Services

- Schedules

- Settings

Do not hardcode business rules that belong on the backend.

In particular:

- Do not trust frontend availability

- Do not determine authorization solely in frontend

- Do not award points solely in frontend

- Do not calculate final appointment state solely in frontend

- Do not assume a service has a universal duration

SEED/DEMO EXPERIENCE

If a backend is not connected yet, create realistic mock data sufficient to demonstrate the full UX.

Include:

- Several nearby shops

- Multiple barbers per shop

- Different services

- Different barber-specific durations

- Reviews

- Example appointments

- Example customer histories

- Example reference photos

- Example completed appointment

- Example barber points

The demo should make the product feel real without pretending mock data is production data.

DO NOT BUILD YET

Do not implement:

- Payments

- Payment methods

- Subscriptions

- Loyalty programs

- Payroll

- Inventory

- Multi-branch management

- Automated WhatsApp/SMS marketing

- Advanced analytics

- Complex gamification

- Native mobile apps

Do not add UI for these simply because they may exist in the future.

The architecture should leave room for them, but v1 should remain focused.

QUALITY BAR

The finished frontend should feel like a credible startup product that could be shown to:

- A barber shop owner

- A barber

- A real customer

The most important workflow is:

Customer:

Discover nearby shop

→ choose shop

→ choose service

→ choose barber

→ choose date

→ see available slots

→ attach optional reference

→ book

Then:

Barber:

Today

→ appointment

→ customer history/reference

→ perform service

→ complete record

→ earn points

And:

Customer:

History

→ see shop/service/barber

→ book again

Make those three loops exceptionally clear and polished.

Build the frontend as a coherent product, not as disconnected screens.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
