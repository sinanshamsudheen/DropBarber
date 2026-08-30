# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository layout

This repo currently contains only the **frontend** (`client/`) and planning **docs** (`docs/`). There is no backend yet (see commit `checkpoint: before backend`) — the app runs entirely against an in-memory mock API.

- `client/` — TanStack Start (React) app, all product code
- `docs/` — locked-in product/backend/db specifications for the eventual FastAPI backend: `PRD.md`, `api.md`, `db_er.md`, `design.md`, `security.md`, `future.md`. Read these before doing work that touches API shape, data model, or auth — they define contracts the frontend is already built to expect.

All commands below run from `client/`.

## Commands

Package manager is **bun** (`bun.lock`, `bunfig.toml`).

```sh
cd client
bun install
bun run dev       # vite dev server
bun run build     # production build
bun run build:dev # dev-mode build
bun run preview   # preview a build
bun run lint      # eslint .
bun run format    # prettier --write .
```

There is no test suite/runner configured — do not assume `bun test` or similar exists unless you add one.

## Architecture
Rule: Always try to prioritize maintaining a strong, proper Modular Monolith architecture where there is strong DRY in place.
Ensure Typesafety at all times, use dataclasses and pydantic effectively.

### Stack

React 19 + TanStack Start (file-based routing via `@tanstack/react-router`) + TanStack Query + Tailwind v4 + shadcn/ui (`components.json`: style `new-york`, alias `@/*` → `src/*`).

### Routing

File-based routing in `client/src/routes/` — see `client/src/routes/README.md` for naming conventions (`$param`, `{-$optional}`, `$.tsx` splat, `_layout.tsx`, `__root.tsx`). `routeTree.gen.ts` is auto-generated; never hand-edit it. `__root.tsx` is the only app shell (`QueryClientProvider` + `SessionProvider` + `Outlet` + `Toaster`) — do not create a competing root layout.

Route naming reflects the product's two domains, joined by shared dynamic segments:
- Public/customer: `index`, `shops.$shopId.index`, `shops.$shopId.barbers.$barberId`, `shops.$shopId.book`, `bookings.index`, `bookings.$appointmentId`, `history`, `profile`, `auth`
- Shop management: `manage.index` (shop picker) and `manage.$shopId.*` (dashboard, appointments, customers, barbers, services, schedule, reviews, settings) — nested under `manage.$shopId.tsx` as a layout route.

### The mock API is the architectural seam

`client/src/lib/api.ts` is the **single point of contact** between UI and data. Every screen calls into this module (never `mock-data.ts` directly). It intentionally behaves like a real backend:
- Simulates latency (`wait()`), throws `ApiError` for user-facing failures
- Computes availability server-side-style (`computeSlots`): reads barber schedule + time off + existing booked appointments + barber-specific service duration + a buffer, on a 15-min grid — the frontend never invents availability itself
- Enforces shop-scoped CRM privacy in-code (e.g. `getShopCustomer` / `listShopCustomers` filter appointments to the requesting shop only — this mirrors the Postgres RLS boundary described in `docs/db_er.md`)
- Owns "business rule" outcomes like points awarded on appointment completion

When wiring a real backend, this file is what gets replaced with HTTP calls — components should keep calling the same exported functions. Don't move business logic (availability, pricing, points, privacy filtering) into components or route loaders; put it here.

`client/src/lib/mock-data.ts` holds the seed dataset (`db` in `api.ts` is a `structuredClone` of it, mutated in-memory for the session).

`client/src/lib/types.ts` defines the domain model (`Shop`, `Barber`, `Service`, `Appointment`, `Customer`, `Review`, etc.) — these types are the frontend's expectation of the future API/DB shape and should stay aligned with `docs/db_er.md` / `docs/api.md` when those are implemented.

### Auth/session (also mocked)

`client/src/lib/session.tsx` provides `SessionProvider`/`useSession()` — a `localStorage`-backed mock of JWT/session auth against `DEMO_USERS`. It also implements client-side RBAC (`Permission`, `ROLE_PERMISSIONS` for `owner`/`manager`/`barber`) used purely for UI gating. Per `docs/api.md` and `docs/security.md`, real authorization must be enforced server-side (RBAC + Postgres RLS) — frontend permission checks here are UX only, never a security boundary.

A user can hold multiple shop memberships (`SessionUser.memberships`), each with a `role` and, for barbers, a `barberId` — management routes/UI must key off the active shop context (`$shopId` param), not assume a single shop.

### Privacy boundary (load-bearing product rule)

Shop-side CRM screens (`manage.$shopId.customers.*`) must only ever show a customer's history **at that shop**. Customer-side screens (`history`, `profile`) show the customer's own cross-shop history. This split is enforced in `api.ts` today and must be enforced server-side (RLS) later — don't add a "global history" view inside shop management.

### Styling

Tailwind v4 (config-less, via `@tailwindcss/vite`) + `src/styles.css` + shadcn `ui/` primitives in `client/src/components/ui/`. Domain components live under `components/{booking,cards,common,layout,manage,search}/`. `client/DESIGN.md` documents the design-language reference (color/type tokens) driving the visual system.

### Server entry points

`client/src/server.ts` / `client/src/start.ts` are TanStack Start's server entry files (SSR/server functions), distinct from routes — routing and data logic still lives in `src/routes` and `src/lib`.
