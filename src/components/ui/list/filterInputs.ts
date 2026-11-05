import type { ListDataType, ListFilter, ListFilterOperator } from "../../../lib/list/types";
import { columnOperatorLabel } from "../../../lib/list/filters";

function localDate(value: string, instant: boolean) {
  const pattern = instant ? /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?$/ : /^\d{4}-\d{2}-\d{2}$/;
  if (!pattern.test(value)) throw new Error("Introduce una fecha válida.");
  const date = new Date(instant ? value : `${value}T00:00:00`);
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  if (!Number.isFinite(date.getTime()) || date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) throw new Error("La fecha no existe en el calendario.");
  if (instant) {
    const [hours, minutes, seconds = "0"] = value.slice(11).split(":");
    const [wholeSeconds, fraction = ""] = seconds.split(".");
    if (date.getHours() !== Number(hours) || date.getMinutes() !== Number(minutes) || date.getSeconds() !== Number(wholeSeconds) || date.getMilliseconds() !== Number(fraction.padEnd(3, "0"))) throw new Error("Esa hora no existe en la zona horaria del navegador.");
  }
  return date;
}

/** Local calendar boundaries -> UTC. Next midnight is constructed, never +24h (DST). */
export function temporalFilter(field: string, operator: ListFilterOperator, from: string, to: string, precision: "day" | "instant"): ListFilter {
  const start = localDate(from, precision === "instant");
  const last = operator === "between" ? localDate(to, precision === "instant") : start;
  if (last < start) throw new Error("La fecha final no puede ser anterior a la inicial.");
  const end = new Date(last);
  if (precision === "day") end.setDate(end.getDate() + 1);
  return { field, operator, value: start.toISOString(), ...(precision === "day" || operator === "between" ? { to: end.toISOString() } : {}), precision };
}

export function filterInputValue(value?: string, precision: "day" | "instant" = "day", exclusiveEnd = false) {
  if (!value) return "";
  const date = new Date(Date.parse(value) - (exclusiveEnd ? 1 : 0));
  if (!Number.isFinite(date.getTime())) return "";
  const pad = (part: number) => String(part).padStart(2, "0");
  const day = `${String(date.getFullYear()).padStart(4, "0")}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  return precision === "day" ? day : `${day}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.${String(date.getMilliseconds()).padStart(3, "0")}`;
}

export function filterDescription(type: ListDataType, filter: ListFilter) {
  const label = columnOperatorLabel(type, filter.operator);
  if (filter.operator === "empty" || filter.operator === "notEmpty") return label;
  if (type === "boolean") return filter.value === "true" ? "Sí" : "No";
  if (type === "date" || type === "datetime") {
    const format = (value?: string, end = false) => {
      const date = new Date(Date.parse(value ?? "") - (end && filter.precision === "day" ? 1 : 0));
      return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short", year: "numeric", ...(filter.precision === "instant" ? { hour: "numeric", minute: "2-digit" } : {}) }).format(date) : "Fecha inválida";
    };
    return `${label}: ${format(filter.value)}${filter.operator === "between" ? ` – ${format(filter.to, true)}` : ""}`;
  }
  return `${label}: ${filter.value ?? ""}${filter.operator === "between" ? ` – ${filter.to ?? ""}` : ""}`;
}
