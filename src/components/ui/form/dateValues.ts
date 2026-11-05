import { format as formatDate, type Month } from "date-fns";
import { es } from "date-fns/locale/es";

export type FieldDateType = "date" | "datetime";
export type FieldDateValueFormat = "date" | "iso";
export type FieldDateRange = { start: string | null; end: string | null };
export type FieldDateEndpoint = "start" | "end";
export type FieldDateIssue = { message: string; endpoint?: FieldDateEndpoint };

type DateParts = { year: number; month: number; day: number };
type ClockParts = DateParts & { hour: number; minute: number; second: number; millisecond: number; zone?: string };
type DateOptions = { type?: FieldDateType; valueFormat?: FieldDateValueFormat; min?: string; max?: string };

const pad = (value: number, length = 2) => String(value).padStart(length, "0");

function readCalendar(value: string): DateParts | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const [, y, m, d] = match;
  const year = Number(y), month = Number(m), day = Number(d);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return year >= 1 && year <= 9999 && month >= 1 && month <= 12 && day >= 1 && day <= days[month - 1]
    ? { year, month, day } : null;
}

function readClock(value: string): ClockParts | null {
  const match = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,9}))?)?(Z|[+-]\d{2}:\d{2})?$/.exec(value);
  if (!match) return null;
  const date = readCalendar(match[1]);
  const hour = Number(match[2]), minute = Number(match[3]), second = Number(match[4] ?? 0);
  const millisecond = Number((match[5] ?? "").padEnd(3, "0").slice(0, 3));
  const zone = match[6];
  if (!date || hour > 23 || minute > 59 || second > 59) return null;
  if (zone && zone !== "Z" && (Number(zone.slice(1, 3)) > 23 || Number(zone.slice(4)) > 59)) return null;
  return { ...date, hour, minute, second, millisecond, zone };
}

function localInstant(parts: ClockParts): Date | null {
  const date = new Date(0);
  date.setFullYear(parts.year, parts.month - 1, parts.day);
  date.setHours(parts.hour, parts.minute, parts.second, parts.millisecond);
  // A DST gap must not silently turn 02:30 into 03:30 (or move the calendar day).
  return date.getFullYear() === parts.year && date.getMonth() === parts.month - 1 && date.getDate() === parts.day &&
    date.getHours() === parts.hour && date.getMinutes() === parts.minute && date.getSeconds() === parts.second &&
    date.getMilliseconds() === parts.millisecond ? date : null;
}

function clockString(parts: Omit<ClockParts, "zone">) {
  const date = `${pad(parts.year, 4)}-${pad(parts.month)}-${pad(parts.day)}`;
  const seconds = parts.second || parts.millisecond ? `:${pad(parts.second)}` : "";
  const fraction = parts.millisecond ? `.${pad(parts.millisecond, 3).replace(/0+$/, "")}` : "";
  return `${date}T${pad(parts.hour)}:${pad(parts.minute)}${seconds}${fraction}`;
}

export function readFieldDateRange(value: unknown): FieldDateRange {
  const object = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
  return {
    start: typeof object.start === "string" && object.start ? object.start : null,
    end: typeof object.end === "string" && object.end ? object.end : null,
  };
}

export function createFieldDateFormat({ type = "date", valueFormat = "date", min, max }: DateOptions = {}) {
  function normalize(value: unknown): string | null {
    if (typeof value !== "string" || !value) return null;
    if (type === "date") {
      const date = value.slice(0, 10);
      if (!readCalendar(date) || (value.length > 10 && !readClock(value))) return null;
      return valueFormat === "iso" ? `${date}T00:00:00.000Z` : date;
    }
    const parts = readClock(value);
    if (!parts) return null;
    const instant = parts.zone ? new Date(value.replace(" ", "T")) : localInstant(parts);
    return instant && Number.isFinite(instant.getTime()) ? instant.toISOString() : null;
  }

  function toInput(value: unknown): string {
    if (type === "date") return normalize(value)?.slice(0, 10) ?? "";
    const parts = typeof value === "string" ? readClock(value) : null;
    if (!parts) return "";
    if (!parts.zone) return clockString(parts);
    const date = new Date(value as string);
    if (!Number.isFinite(date.getTime()) || date.getFullYear() < 1 || date.getFullYear() > 9999) return "";
    return clockString({
      year: date.getFullYear(), month: date.getMonth() + 1, day: date.getDate(),
      hour: date.getHours(), minute: date.getMinutes(), second: date.getSeconds(), millisecond: date.getMilliseconds(),
    });
  }

  function fromInput(value: string, previous?: unknown): { value: string | null; error?: string } {
    if (!value) return { value: null };
    if (type === "date") {
      if (!readCalendar(value)) return { value: null, error: "Selecciona una fecha válida." };
      return { value: valueFormat === "iso" ? `${value}T00:00:00.000Z` : value };
    }
    const parts = readClock(value);
    if (!parts || parts.zone) return { value: null, error: "Selecciona una fecha y hora válidas." };
    // Preserve an existing instant in the repeated hour when DST ends.
    const previousParts = typeof previous === "string" ? readClock(previous) : null;
    if (previousParts?.zone && toInput(previous) === clockString(parts)) return { value: normalize(previous) };
    const date = localInstant(parts);
    return date ? { value: date.toISOString() } : { value: null, error: "La fecha u hora seleccionada no existe en la zona horaria del navegador." };
  }

  function toDisplay(value: unknown): string {
    const normalized = normalize(value);
    if (!normalized) return "";
    if (type === "date") {
      // A calendar date has no timezone, even on days skipped by a timezone change.
      const { day, month } = readCalendar(normalized.slice(0, 10))!;
      return `${day} ${es.localize.month((month - 1) as Month, { width: "abbreviated" })}`;
    }
    const instant = new Date(normalized);
    if (!toInput(normalized)) return "";
    const period = formatDate(instant, "aaaa", { locale: es }).replace(/^([ap])\.m\.$/, "$1. m.");
    return `${formatDate(instant, "d MMM, hh:mm", { locale: es })} ${period}`;
  }

  const lower = min === undefined ? null : normalize(min);
  const upper = max === undefined ? null : normalize(max);
  if (min !== undefined && !lower) throw new RangeError("min debe ser una fecha válida para el tipo de FieldDate.");
  if (max !== undefined && !upper) throw new RangeError("max debe ser una fecha válida para el tipo de FieldDate.");
  if (lower && upper && lower > upper) throw new RangeError("min no puede ser posterior a max.");

  function validate(value: unknown, required = false): FieldDateIssue | null {
    if (value === null || value === undefined || value === "") return required ? { message: "Selecciona una fecha." } : null;
    const normalized = normalize(value);
    if (!normalized) return { message: "La fecha u hora no es válida." };
    if (lower && normalized < lower) return { message: "La fecha es anterior al mínimo permitido." };
    if (upper && normalized > upper) return { message: "La fecha es posterior al máximo permitido." };
    return null;
  }

  function validateRange(value: unknown, required = false): FieldDateIssue | null {
    if (value !== null && value !== undefined &&
      (typeof value !== "object" || Array.isArray(value) || !("start" in value) || !("end" in value))) {
      return { message: "El rango debe contener start y end." };
    }
    const range = readFieldDateRange(value);
    for (const endpoint of ["start", "end"] as const) {
      const raw = value && typeof value === "object" ? (value as Record<string, unknown>)[endpoint] : null;
      const issue = validate(raw, required);
      if (issue) return { ...issue, endpoint };
    }
    const start = normalize(range.start), end = normalize(range.end);
    return start && end && end < start
      ? { message: "La fecha final debe ser igual o posterior a la inicial.", endpoint: "end" }
      : null;
  }

  function inputBounds(endpoint?: FieldDateEndpoint, range?: FieldDateRange) {
    let start = lower, end = upper;
    const rangeStart = normalize(range?.start), rangeEnd = normalize(range?.end);
    if (endpoint === "start" && rangeEnd && (!end || rangeEnd < end)) end = rangeEnd;
    if (endpoint === "end" && rangeStart && (!start || rangeStart > start)) start = rangeStart;
    return { min: toInput(start) || undefined, max: toInput(end) || undefined };
  }

  return { normalize, toInput, fromInput, toDisplay, validate, validateRange, inputBounds };
}
