/**
 * Mock API layer — the stand-in for the real backend.
 *
 * Every screen talks to the product through this module only. Business rules
 * that belong on the server (availability, conflicts, points, appointment
 * state) are computed *here*, never in components, so this file can be swapped
 * for real HTTP calls without touching the UI.
 */
import {
  barbers as seedBarbers,
  customers as seedCustomers,
  pointEntries as seedPoints,
  reviews as seedReviews,
  seedAppointments,
  services as seedServices,
  shopNotes as seedNotes,
  shops as seedShops,
} from "./mock-data";
import type {
  Appointment,
  AppointmentStatus,
  Barber,
  Customer,
  PointEntry,
  Review,
  Service,
  Shop,
  ShopNote,
  Slot,
} from "./types";

const db = {
  shops: structuredClone(seedShops) as Shop[],
  services: structuredClone(seedServices) as Service[],
  barbers: structuredClone(seedBarbers) as Barber[],
  customers: structuredClone(seedCustomers) as Customer[],
  appointments: structuredClone(seedAppointments) as Appointment[],
  reviews: structuredClone(seedReviews) as Review[],
  notes: structuredClone(seedNotes) as ShopNote[],
  points: structuredClone(seedPoints) as PointEntry[],
};

export const CURRENT_CUSTOMER_ID = "cus-you";
const SLOT_GRID_MIN = 15;
const BUFFER_MIN = 5;

const wait = (ms = 320) => new Promise((r) => setTimeout(r, ms));
const clone = <T,>(v: T): T => structuredClone(v);
const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
const toTime = (m: number) =>
  `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

export class ApiError extends Error {}

/* ------------------------------------------------------------------ discovery */

export async function listShops(params: { query?: string; location?: string } = {}) {
  await wait();
  if (params.query?.trim().toLowerCase() === "error") {
    throw new ApiError("We couldn't reach the search service. Check your connection and retry.");
  }
  const q = params.query?.trim().toLowerCase() ?? "";
  const loc = params.location?.trim().toLowerCase() ?? "";
  return clone(
    db.shops
      .filter((s) => {
        const matchQ =
          !q ||
          s.name.toLowerCase().includes(q) ||
          s.area.toLowerCase().includes(q) ||
          s.tagline.toLowerCase().includes(q);
        const matchLoc = !loc || s.area.toLowerCase().includes(loc) || s.address.toLowerCase().includes(loc);
        return matchQ && matchLoc;
      })
      .sort((a, b) => a.distanceKm - b.distanceKm),
  );
}

export async function getShop(shopId: string) {
  await wait();
  const shop = db.shops.find((s) => s.id === shopId);
  if (!shop) throw new ApiError("That shop doesn't exist or is no longer listed.");
  return {
    shop: clone(shop),
    services: clone(db.services.filter((s) => s.shopId === shopId)),
    barbers: clone(db.barbers.filter((b) => b.shopId === shopId)),
    reviews: clone(db.reviews.filter((r) => r.shopId === shopId)),
  };
}

export async function getBarber(shopId: string, barberId: string) {
  await wait();
  const barber = db.barbers.find((b) => b.id === barberId && b.shopId === shopId);
  const shop = db.shops.find((s) => s.id === shopId);
  if (!barber || !shop) throw new ApiError("This barber profile isn't available.");
  return {
    barber: clone(barber),
    shop: clone(shop),
    services: clone(db.services.filter((s) => s.shopId === shopId)),
    reviews: clone(db.reviews.filter((r) => r.barberId === barberId)),
  };
}

/** Cheapest active service price, used for "from ₹X" on discovery cards. */
export function startingPrice(shopId: string) {
  const prices = db.services.filter((s) => s.shopId === shopId && s.active).map((s) => s.price);
  return prices.length ? Math.min(...prices) : null;
}

export async function nextAvailable(shopId: string) {
  const barberIds = db.barbers.filter((b) => b.shopId === shopId && b.active);
  for (let offset = 0; offset < 7; offset++) {
    const date = addDays(offset);
    for (const b of barberIds) {
      const svc = b.services.find((s) => s.active);
      if (!svc) continue;
      const slots = computeSlots(b, svc.durationMin, date);
      const first = slots[0];
      if (first) return { date, time: first.time };
    }
  }
  return null;
}

/* --------------------------------------------------------------- availability */

function addDays(offset: number) {
  const dt = new Date();
  dt.setDate(dt.getDate() + offset);
  return dt.toISOString().slice(0, 10);
}

function computeSlots(barber: Barber, durationMin: number, date: string): Slot[] {
  const day = new Date(`${date}T12:00:00`).getDay();
  const periods = barber.schedule[day] ?? [];
  if (!periods.length) return [];
  if (barber.timeOff.some((t) => t.date === date)) return [];

  const booked = db.appointments
    .filter((a) => a.barberId === barber.id && a.date === date && a.status === "booked")
    .map((a) => ({ start: toMin(a.time), end: toMin(a.time) + a.durationMin + BUFFER_MIN }));

  const today = new Date().toISOString().slice(0, 10);
  const nowMin = new Date().getHours() * 60 + new Date().getMinutes();

  const slots: Slot[] = [];
  for (const p of periods) {
    for (let t = toMin(p.start); t + durationMin <= toMin(p.end); t += SLOT_GRID_MIN) {
      if (date === today && t < nowMin + 30) continue;
      const overlaps = booked.some((b) => t < b.end && t + durationMin > b.start);
      if (!overlaps) slots.push({ time: toTime(t), durationMin });
    }
  }
  return slots;
}

export async function getAvailability(params: {
  shopId: string;
  barberId: string;
  serviceId: string;
  date: string;
}) {
  await wait(420);
  const barber = db.barbers.find((b) => b.id === params.barberId);
  if (!barber) throw new ApiError("Availability is unavailable for this barber right now.");
  const bs = barber.services.find((s) => s.serviceId === params.serviceId && s.active);
  if (!bs) throw new ApiError("This barber no longer offers that service.");
  return { slots: computeSlots(barber, bs.durationMin, params.date), durationMin: bs.durationMin };
}

export function priceFor(barber: Barber, service: Service) {
  const bs = barber.services.find((s) => s.serviceId === service.id);
  return bs?.priceOverride ?? service.price;
}

export function durationFor(barber: Barber, serviceId: string) {
  return barber.services.find((s) => s.serviceId === serviceId)?.durationMin ?? null;
}

/* ---------------------------------------------------------------- appointments */

export async function createAppointment(input: {
  shopId: string;
  barberId: string;
  serviceId: string;
  date: string;
  time: string;
  note?: string | undefined;
  referencePhotos: { id: string; url: string; caption?: string | undefined }[];
  customerId?: string | undefined;
}) {
  await wait(600);
  const barber = db.barbers.find((b) => b.id === input.barberId)!;
  const service = db.services.find((s) => s.id === input.serviceId)!;
  const bs = barber.services.find((s) => s.serviceId === input.serviceId);
  if (!bs) throw new ApiError("This barber no longer offers that service.");
  const stillFree = computeSlots(barber, bs.durationMin, input.date).some((s) => s.time === input.time);
  if (!stillFree) {
    throw new ApiError("SLOT_TAKEN");
  }
  const appointment: Appointment = {
    id: `apt-${Math.random().toString(36).slice(2, 8)}`,
    shopId: input.shopId,
    barberId: input.barberId,
    serviceId: input.serviceId,
    customerId: input.customerId ?? CURRENT_CUSTOMER_ID,
    date: input.date,
    time: input.time,
    durationMin: bs.durationMin,
    price: bs.priceOverride ?? service.price,
    status: "booked",
    note: input.note,
    referencePhotos: input.referencePhotos,
    createdAt: new Date().toISOString().slice(0, 10),
  };
  db.appointments.push(appointment);
  return clone(appointment);
}

function hydrate(a: Appointment) {
  return {
    ...clone(a),
    shop: clone(db.shops.find((s) => s.id === a.shopId)!),
    barber: clone(db.barbers.find((b) => b.id === a.barberId)!),
    service: clone(db.services.find((s) => s.id === a.serviceId)!),
    customer: clone(db.customers.find((c) => c.id === a.customerId)!),
    review: clone(db.reviews.find((r) => r.appointmentId === a.id) ?? null),
  };
}

export type HydratedAppointment = ReturnType<typeof hydrate>;

const startsAt = (a: Appointment) => new Date(`${a.date}T${a.time}:00`).getTime();

export async function listCustomerAppointments(customerId = CURRENT_CUSTOMER_ID) {
  await wait();
  const all = db.appointments.filter((a) => a.customerId === customerId).map(hydrate);
  const now = Date.now();
  return {
    upcoming: all
      .filter((a) => a.status === "booked" && startsAt(a) >= now - 3600_000)
      .sort((a, b) => startsAt(a) - startsAt(b)),
    past: all
      .filter((a) => !(a.status === "booked" && startsAt(a) >= now - 3600_000))
      .sort((a, b) => startsAt(b) - startsAt(a)),
  };
}

export async function getAppointment(id: string) {
  await wait();
  const a = db.appointments.find((x) => x.id === id);
  if (!a) throw new ApiError("We couldn't find that appointment.");
  return hydrate(a);
}

export async function cancelAppointment(id: string) {
  await wait(400);
  const a = db.appointments.find((x) => x.id === id);
  if (!a) throw new ApiError("We couldn't find that appointment.");
  if (a.status !== "booked") throw new ApiError("This appointment can no longer be cancelled.");
  a.status = "cancelled";
  return hydrate(a);
}

export async function rescheduleAppointment(id: string, date: string, time: string) {
  await wait(500);
  const a = db.appointments.find((x) => x.id === id);
  if (!a) throw new ApiError("We couldn't find that appointment.");
  const barber = db.barbers.find((b) => b.id === a.barberId)!;
  const free = computeSlots(barber, a.durationMin, date).some((s) => s.time === time);
  if (!free) throw new ApiError("SLOT_TAKEN");
  a.date = date;
  a.time = time;
  return hydrate(a);
}

/* ------------------------------------------------------------------ management */

export async function listShopAppointments(shopId: string, date: string) {
  await wait();
  return db.appointments
    .filter((a) => a.shopId === shopId && a.date === date)
    .map(hydrate)
    .sort((a, b) => a.time.localeCompare(b.time));
}

export async function getShopDay(shopId: string) {
  await wait();
  const date = new Date().toISOString().slice(0, 10);
  const appointments = db.appointments
    .filter((a) => a.shopId === shopId && a.date === date)
    .map(hydrate)
    .sort((a, b) => a.time.localeCompare(b.time));
  const shopBarbers = db.barbers.filter((b) => b.shopId === shopId);
  const day = new Date(`${date}T12:00:00`).getDay();
  return {
    date,
    appointments,
    barbers: shopBarbers.map((b) => ({
      id: b.id,
      name: b.name,
      active: b.active,
      working: (b.schedule[day] ?? []).length > 0 && !b.timeOff.some((t) => t.date === date),
      periods: b.schedule[day] ?? [],
      todayCount: appointments.filter((a) => a.barberId === b.id).length,
    })),
  };
}

export async function completeAppointment(
  id: string,
  data: { actualService: string; finalPrice: number; notes?: string; finishedPhoto?: string },
) {
  await wait(500);
  const a = db.appointments.find((x) => x.id === id);
  if (!a) throw new ApiError("We couldn't find that appointment.");
  a.status = "completed";
  a.completion = { ...data, pointsAwarded: 10 };
  const barber = db.barbers.find((b) => b.id === a.barberId);
  if (barber) {
    barber.points += 10;
    db.points.unshift({
      id: `pt-${Math.random().toString(36).slice(2, 7)}`,
      barberId: barber.id,
      points: 10,
      reason: `Completed record — ${db.customers.find((c) => c.id === a.customerId)?.name ?? "Customer"}`,
      date: new Date().toISOString().slice(0, 10),
    });
  }
  if (data.notes) {
    db.notes.unshift({
      id: `note-${Math.random().toString(36).slice(2, 7)}`,
      shopId: a.shopId,
      customerId: a.customerId,
      text: data.notes,
      date: new Date().toISOString().slice(0, 10),
      author: barber?.name ?? "Staff",
    });
  }
  return hydrate(a);
}

export async function closeAppointmentWithoutDetails(id: string) {
  await wait(350);
  const a = db.appointments.find((x) => x.id === id);
  if (!a) throw new ApiError("We couldn't find that appointment.");
  a.status = "completed";
  return hydrate(a);
}

export async function markNoShow(id: string) {
  await wait(350);
  const a = db.appointments.find((x) => x.id === id);
  if (!a) throw new ApiError("We couldn't find that appointment.");
  a.status = "no_show";
  return hydrate(a);
}

/* ------------------------------------------------------------------------- CRM */

export async function listShopCustomers(shopId: string, query = "") {
  await wait();
  const q = query.trim().toLowerCase();
  const ids = [...new Set(db.appointments.filter((a) => a.shopId === shopId).map((a) => a.customerId))];
  return ids
    .map((id) => {
      const customer = db.customers.find((c) => c.id === id)!;
      // shop-scoped only: appointments at *this* shop
      const visits = db.appointments.filter(
        (a) => a.customerId === id && a.shopId === shopId && a.status === "completed",
      );
      const all = db.appointments
        .filter((a) => a.customerId === id && a.shopId === shopId)
        .sort((x, y) => startsAt(y) - startsAt(x));
      const counts = new Map<string, number>();
      all.forEach((a) => counts.set(a.barberId, (counts.get(a.barberId) ?? 0) + 1));
      const preferredId = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
      return {
        customer: clone(customer),
        visits: visits.length,
        lastVisit: visits[0]?.date ?? all.find((a) => a.status === "completed")?.date ?? null,
        lastAppointmentDate: all[0]?.date ?? null,
        preferredBarber: preferredId
          ? clone(db.barbers.find((b) => b.id === preferredId)!)
          : null,
        spend: visits.reduce((sum, a) => sum + (a.completion?.finalPrice ?? a.price), 0),
      };
    })
    .filter(
      (row) =>
        !q ||
        row.customer.name.toLowerCase().includes(q) ||
        row.customer.phone.includes(q) ||
        row.customer.email.toLowerCase().includes(q),
    )
    .sort((a, b) => (b.lastAppointmentDate ?? "").localeCompare(a.lastAppointmentDate ?? ""));
}

export async function getShopCustomer(shopId: string, customerId: string) {
  await wait();
  const customer = db.customers.find((c) => c.id === customerId);
  if (!customer) throw new ApiError("We couldn't find that customer.");
  /** PRIVACY: only appointments belonging to this shop are ever returned. */
  const appointments = db.appointments
    .filter((a) => a.customerId === customerId && a.shopId === shopId)
    .map(hydrate)
    .sort((a, b) => startsAt(b) - startsAt(a));
  const completed = appointments.filter((a) => a.status === "completed");
  const counts = new Map<string, number>();
  appointments.forEach((a) => counts.set(a.barberId, (counts.get(a.barberId) ?? 0) + 1));
  const preferredId = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  return {
    customer: clone(customer),
    appointments,
    visits: completed.length,
    lastVisit: completed[0]?.date ?? null,
    spend: completed.reduce((s, a) => s + (a.completion?.finalPrice ?? a.price), 0),
    preferredBarber: preferredId ? clone(db.barbers.find((b) => b.id === preferredId)!) : null,
    notes: clone(db.notes.filter((n) => n.shopId === shopId && n.customerId === customerId)),
    referencePhotos: appointments.flatMap((a) => a.referencePhotos),
  };
}

export async function addShopNote(shopId: string, customerId: string, text: string, author: string) {
  await wait(300);
  const note: ShopNote = {
    id: `note-${Math.random().toString(36).slice(2, 7)}`,
    shopId,
    customerId,
    text,
    author,
    date: new Date().toISOString().slice(0, 10),
  };
  db.notes.unshift(note);
  return clone(note);
}

/* -------------------------------------------------------------- shop resources */

export async function listBarbers(shopId: string) {
  await wait();
  const today = new Date().toISOString().slice(0, 10);
  return db.barbers
    .filter((b) => b.shopId === shopId)
    .map((b) => ({
      barber: clone(b),
      todayCount: db.appointments.filter(
        (a) => a.barberId === b.id && a.date === today && a.status !== "cancelled",
      ).length,
    }));
}

export async function getManagedBarber(shopId: string, barberId: string) {
  await wait();
  const barber = db.barbers.find((b) => b.id === barberId && b.shopId === shopId);
  if (!barber) throw new ApiError("We couldn't find that barber.");
  return { barber: clone(barber), services: clone(db.services.filter((s) => s.shopId === shopId)) };
}

export async function saveBarber(shopId: string, input: Partial<Barber> & { id?: string }) {
  await wait(450);
  if (input.id) {
    const b = db.barbers.find((x) => x.id === input.id)!;
    Object.assign(b, input);
    return clone(b);
  }
  const barber: Barber = {
    id: `brb-${Math.random().toString(36).slice(2, 7)}`,
    shopId,
    name: input.name ?? "New barber",
    bio: input.bio ?? "",
    active: true,
    rating: 0,
    reviewCount: 0,
    points: 0,
    services: input.services ?? [],
    schedule: input.schedule ?? [[], [], [], [], [], [], []],
    timeOff: [],
  };
  db.barbers.push(barber);
  return clone(barber);
}

export async function setBarberActive(barberId: string, active: boolean) {
  await wait(250);
  const b = db.barbers.find((x) => x.id === barberId)!;
  b.active = active;
  return clone(b);
}

export async function setBarberService(
  barberId: string,
  serviceId: string,
  patch: Partial<BarberServicePatch>,
) {
  await wait(250);
  const b = db.barbers.find((x) => x.id === barberId)!;
  const existing = b.services.find((s) => s.serviceId === serviceId);
  if (existing) Object.assign(existing, patch);
  else
    b.services.push({
      serviceId,
      durationMin: patch.durationMin ?? 20,
      active: patch.active ?? true,
      priceOverride: patch.priceOverride,
    });
  return clone(b);
}
/** `priceOverride: undefined` clears an override back to the shop price. */
type BarberServicePatch = { durationMin: number; priceOverride: number | undefined; active: boolean };

export async function setBarberSchedule(barberId: string, schedule: Barber["schedule"]) {
  await wait(350);
  const b = db.barbers.find((x) => x.id === barberId)!;
  b.schedule = schedule;
  return clone(b);
}

export async function addTimeOff(barberId: string, date: string, reason: string) {
  await wait(300);
  const b = db.barbers.find((x) => x.id === barberId)!;
  b.timeOff.push({ id: `to-${Math.random().toString(36).slice(2, 7)}`, date, reason });
  return clone(b);
}

export async function removeTimeOff(barberId: string, id: string) {
  await wait(250);
  const b = db.barbers.find((x) => x.id === barberId)!;
  b.timeOff = b.timeOff.filter((t) => t.id !== id);
  return clone(b);
}

export async function listServices(shopId: string) {
  await wait();
  return clone(db.services.filter((s) => s.shopId === shopId));
}

export async function saveService(shopId: string, input: Partial<Service> & { id?: string }) {
  await wait(400);
  if (input.id) {
    const s = db.services.find((x) => x.id === input.id)!;
    Object.assign(s, input);
    return clone(s);
  }
  const service: Service = {
    id: `svc-${Math.random().toString(36).slice(2, 7)}`,
    shopId,
    name: input.name ?? "New service",
    description: input.description ?? "",
    price: input.price ?? 0,
    active: true,
  };
  db.services.push(service);
  return clone(service);
}

export async function listShopReviews(shopId: string) {
  await wait();
  const list = db.reviews.filter((r) => r.shopId === shopId);
  const distribution = [5, 4, 3, 2, 1].map((star) => ({
    star,
    count: list.filter((r) => Math.round(r.shopRating) === star).length,
  }));
  const average = list.length ? list.reduce((s, r) => s + r.shopRating, 0) / list.length : 0;
  return { reviews: clone(list), distribution, average, total: list.length };
}

export async function submitReview(input: {
  appointmentId: string;
  shopRating: number;
  barberRating?: number;
  text: string;
}) {
  await wait(500);
  const a = db.appointments.find((x) => x.id === input.appointmentId);
  if (!a) throw new ApiError("We couldn't find that appointment.");
  if (a.status !== "completed") throw new ApiError("You can only review completed appointments.");
  const customer = db.customers.find((c) => c.id === a.customerId)!;
  const review: Review = {
    id: `rev-${Math.random().toString(36).slice(2, 7)}`,
    shopId: a.shopId,
    barberId: a.barberId,
    appointmentId: a.id,
    customerId: a.customerId,
    customerName: `${customer.name.split(" ")[0]} ${customer.name.split(" ")[1]?.[0] ?? ""}.`,
    shopRating: input.shopRating,
    barberRating: input.barberRating,
    text: input.text,
    date: new Date().toISOString().slice(0, 10),
  };
  db.reviews.unshift(review);
  return clone(review);
}

export async function getBarberPoints(shopId: string) {
  await wait();
  return db.barbers
    .filter((b) => b.shopId === shopId)
    .map((b) => ({
      barber: clone(b),
      history: clone(db.points.filter((p) => p.barberId === b.id)),
    }))
    .sort((a, b) => b.barber.points - a.barber.points);
}

export async function getCustomerProfile(customerId = CURRENT_CUSTOMER_ID) {
  await wait();
  const customer = db.customers.find((c) => c.id === customerId)!;
  return clone(customer);
}

export async function saveCustomerProfile(customerId: string, patch: Partial<Customer>) {
  await wait(350);
  const c = db.customers.find((x) => x.id === customerId)!;
  Object.assign(c, patch);
  return clone(c);
}

export async function getCustomerHistory(customerId = CURRENT_CUSTOMER_ID) {
  await wait();
  /** The customer's own cross-shop history. Shops never receive this view. */
  return db.appointments
    .filter((a) => a.customerId === customerId && a.status !== "booked")
    .map(hydrate)
    .sort((a, b) => startsAt(b) - startsAt(a));
}

export async function updateShopSettings(shopId: string, patch: Partial<Shop>) {
  await wait(450);
  const s = db.shops.find((x) => x.id === shopId)!;
  Object.assign(s, patch);
  return clone(s);
}

export type { AppointmentStatus };
