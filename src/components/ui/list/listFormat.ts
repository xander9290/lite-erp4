import type { ListColumn, ListValue } from "../../../lib/list/types";

export function formatListValue(value: ListValue, column: ListColumn): string {
  if (value === null || value === "" || typeof value === "object") return "—";
  const option = column.options?.find(option => option.value === value);
  if (option) return option.label;
  try {
    if (column.format === "boolean") return value === true ? "Sí" : value === false ? "No" : "—";
    if (column.format === "number" || column.format === "currency") {
      const number = typeof value === "number" ? value : Number(value);
      if (!Number.isFinite(number) || typeof value === "boolean") return "—";
      return new Intl.NumberFormat("es-MX", { style: column.format === "currency" ? "currency" : "decimal", currency: column.currency ?? "MXN", minimumFractionDigits: column.decimals ?? 2, maximumFractionDigits: column.decimals ?? 2 }).format(number);
    }
    if (column.format === "date" || column.format === "datetime") {
      if (typeof value !== "string") return "—";
      const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00`) : new Date(value);
      if (Number.isNaN(date.getTime())) return "—";
      return new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short", year: "numeric", ...(column.format === "datetime" ? { hour: "numeric", minute: "2-digit", hour12: true } : {}) }).format(date);
    }
    return String(value);
  } catch { return "—"; }
}

export function columnAlignment(column: ListColumn) {
  return column.align ?? (column.format === "number" || column.format === "currency" ? "right" : "left");
}

export function visibleListPages(page: number, totalPages: number) {
  const start = Math.max(1, Math.min(page - 2, totalPages - 4));
  return Array.from({ length: Math.min(5, totalPages) }, (_, index) => start + index);
}

export function listRecordHref(template: string, id: string, returnTo: string) {
  const href = template.replaceAll("{id}", encodeURIComponent(id));
  const [path, hash] = href.split("#", 2);
  return `${path}${path.includes("?") ? "&" : "?"}returnTo=${encodeURIComponent(returnTo)}${hash ? `#${hash}` : ""}`;
}
