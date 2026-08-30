export type Role = "customer" | "owner" | "manager" | "barber";

export type AppointmentStatus = "booked" | "completed" | "cancelled" | "no_show";

export interface OpeningHours {
  /** 0 = Sunday */
  day: number;
  open: string | null;
  close: string | null;
}

export interface Shop {
  id: string;
  name: string;
  tagline: string;
  description: string;
  photos: string[];
  rating: number;
  reviewCount: number;
  distanceKm: number;
  area: string;
  address: string;
  phone: string;
  hours: OpeningHours[];
}

export interface Service {
  id: string;
  shopId: string;
  name: string;
  description: string;
  price: number;
  active: boolean;
}

export interface BarberService {
  serviceId: string;
  durationMin: number;
  priceOverride?: number | undefined;
  active: boolean;
}

export interface WorkPeriod {
  start: string;
  end: string;
}

export interface Barber {
  id: string;
  shopId: string;
  name: string;
  bio: string;
  photo?: string | undefined;
  active: boolean;
  rating: number;
  reviewCount: number;
  points: number;
  services: BarberService[];
  /** index 0 = Sunday */
  schedule: WorkPeriod[][];
  timeOff: { id: string; date: string; reason: string }[];
}

export interface Photo {
  id: string;
  url: string;
  caption?: string | undefined;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email: string;
  photo?: string | undefined;
  preferences: string;
  savedPhotos: Photo[];
}

export interface Appointment {
  id: string;
  shopId: string;
  barberId: string;
  serviceId: string;
  customerId: string;
  /** yyyy-MM-dd */
  date: string;
  /** HH:mm */
  time: string;
  durationMin: number;
  price: number;
  status: AppointmentStatus;
  note?: string | undefined;
  referencePhotos: Photo[];
  completion?: {
    actualService: string | undefined;
    finalPrice: number;
    notes?: string | undefined;
    finishedPhoto?: string | undefined;
    pointsAwarded: number;
  };
  createdAt: string;
}

export interface Review {
  id: string;
  shopId: string;
  barberId?: string | undefined;
  appointmentId: string;
  customerId: string;
  customerName: string;
  shopRating: number;
  barberRating?: number | undefined;
  text: string;
  date: string;
}

export interface ShopNote {
  id: string;
  shopId: string;
  customerId: string;
  text: string;
  date: string;
  author: string;
}

export interface PointEntry {
  id: string;
  barberId: string;
  points: number;
  reason: string;
  date: string;
}

export interface Membership {
  shopId: string;
  role: Exclude<Role, "customer">;
  barberId?: string | undefined;
}

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  photo?: string | undefined;
  memberships: Membership[];
}

export interface Slot {
  time: string;
  durationMin: number;
}
