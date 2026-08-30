import { format, isToday, isTomorrow, parseISO } from "date-fns";

export const money = (v: number) => `₹${v.toLocaleString("en-IN")}`;

export const duration = (min: number) =>
  min >= 60 ? `${Math.floor(min / 60)}h${min % 60 ? ` ${min % 60}m` : ""}` : `${min} min`;

export function dayLabel(date: string) {
  const d = parseISO(date);
  if (isToday(d)) return "Today";
  if (isTomorrow(d)) return "Tomorrow";
  return format(d, "EEE d MMM");
}

export function longDate(date: string) {
  return format(parseISO(date), "EEEE d MMMM yyyy");
}

export function timeLabel(time: string) {
  const [h = 0, m = 0] = time.split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, "0")} ${suffix}`;
}

export const todayISO = () => new Date().toISOString().slice(0, 10);

export function addDaysISO(offset: number, from = new Date()) {
  const d = new Date(from);
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}

export const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
