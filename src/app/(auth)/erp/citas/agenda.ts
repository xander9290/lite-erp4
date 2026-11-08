import { dentalClinicTimeZone } from "./settings";
import { appointmentStatusOptions } from "./schemas/appointment.schema";

const calendar = new Intl.DateTimeFormat("en", { timeZone: dentalClinicTimeZone, year: "numeric", month: "2-digit", day: "2-digit" });
function clinicDay(date: Date) {
  const parts = calendar.formatToParts(date);
  const part = (type: string) => Number(parts.find(value => value.type === type)!.value);
  return Date.UTC(part("year"), part("month") - 1, part("day"));
}

export function appointmentAgenda(scheduledAt: Date, status: string, now: Date) {
  if (status !== "SCHEDULED") return { text: appointmentStatusOptions.find(option => option.value === status)?.label ?? "—", tone: status === "ATTENDED" ? "success" : "neutral" };
  const days = Math.round((clinicDay(scheduledAt) - clinicDay(now)) / 86400000);
  return days === 0 ? { text: "Hoy", tone: "primary" }
    : days > 0 ? { text: `Falta${days === 1 ? "" : "n"} ${days} día${days === 1 ? "" : "s"}`, tone: "neutral" }
    : { text: `${-days} día${days === -1 ? "" : "s"} de atraso`, tone: "error" };
}

export function formatClinicDate(iso: string) {
  return new Intl.DateTimeFormat("es-MX", { timeZone: dentalClinicTimeZone, day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true }).format(new Date(iso));
}
