import { z } from "zod";
import { filterValueError } from "@/lib/list/filters";
import { normalizeListState } from "@/lib/list/state";
import { listStateSchema } from "@/lib/list/query";
import type { ListFilter, ListRecord, ListResult, ListState, ListViewConfig } from "@/lib/list/types";
import type { CollectionField } from "@/components/ui/collection/types";

export const demoGroups = [{ value: "todo", label: "Por hacer", tone: "neutral" }, { value: "progress", label: "En curso", tone: "info" }, { value: "done", label: "Finalizado", tone: "success" }] as const;
export const demoColumns = [
  { field: "name", label: "Proyecto", type: "text", sortable: true },
  { field: "client", label: "Cliente", type: "text", sortable: true },
  { field: "amount", label: "Presupuesto", type: "number", format: "currency", currency: "MXN", sortable: true },
  { field: "deadline", label: "Entrega", type: "datetime", sortable: true },
  { field: "status", label: "Estado", type: "text", sortable: true, options: demoGroups },
] as const satisfies readonly CollectionField[];
const config: ListViewConfig = { model: "ProjectDemo", columns: demoColumns, searchFields: ["name", "client"] };
const names = ["Diseñar la bienvenida", "Conectar catálogo", "Validar permisos", "Preparar reportes", "Revisar inventario", "Actualizar contratos", "Organizar agenda", "Publicar documentación", "Configurar notificaciones", "Revisar contactos", "Preparar capacitación", "Importar productos", "Ajustar facturación", "Probar respaldos", "Diseñar indicadores", "Cerrar revisión", "Verificar accesibilidad", "Documentar entregables"];
export function createDemoRecords(): ListRecord[] {
  return names.map((name, index) => ({ id: `project-${index + 1}`, name, client: ["Estudio Norte", "Clínica Central", "Comercial del Sur"][index % 3], amount: (index + 1) * 1250, deadline: `2026-11-${String(10 + index).padStart(2, "0")}T18:00:00.000Z`, status: index < 8 ? "todo" : index < 14 ? "progress" : "done", revision: "2026-11-08T00:00:00.000Z", locked: index === 2 }));
}
export const demoMoveSchema = z.strictObject({ id: z.string().min(1).max(100), revision: z.iso.datetime({ precision: 3 }), from: z.enum(["todo", "progress", "done"]), to: z.enum(["todo", "progress", "done"]) });

function matches(record: ListRecord, filter: ListFilter) {
  const column = demoColumns.find(column => column.field === filter.field)!;
  const raw = record[filter.field], empty = raw === null || raw === "";
  if (filter.operator === "empty") return empty;
  if (filter.operator === "notEmpty") return !empty;
  if (column.type === "text") {
    const text = String(raw ?? "").toLocaleLowerCase("es-MX"), value = filter.value!.toLocaleLowerCase("es-MX");
    return filter.operator === "eq" ? text === value : filter.operator === "neq" ? text !== value : filter.operator === "startsWith" ? text.startsWith(value) : filter.operator === "endsWith" ? text.endsWith(value) : text.includes(value);
  }
  const temporal = column.type === "datetime";
  const value = temporal ? Date.parse(String(raw)) : Number(raw), from = temporal ? Date.parse(filter.value!) : Number(filter.value), to = temporal ? Date.parse(filter.to ?? filter.value!) : Number(filter.to);
  if (temporal && filter.precision === "day") return filter.operator === "eq" || filter.operator === "between" ? value >= from && value < to : filter.operator === "gt" ? value >= to : filter.operator === "lte" ? value < to : filter.operator === "gte" ? value >= from : value < from;
  return filter.operator === "eq" ? value === from : filter.operator === "neq" ? value !== from : filter.operator === "gt" ? value > from : filter.operator === "gte" ? value >= from : filter.operator === "lt" ? value < from : filter.operator === "lte" ? value <= from : value >= from && value <= to;
}
/** Public, local-only sample adapter. Production providers use the authorized model service. */
export function demoPage(records: readonly ListRecord[], input: ListState, group?: string): ListResult {
  const parsed = listStateSchema.safeParse(input);
  if (!parsed.success || parsed.data.invalidFilters || (group !== undefined && !demoGroups.some(item => item.value === group))) return { ok: false, error: "Revisa los parámetros y filtros." };
  const state = normalizeListState(config, parsed.data);
  for (const filter of state.filters) {
    const column = demoColumns.find(column => column.field === filter.field);
    if (!column || filterValueError(column.type, filter) || (column.field === "status" && !["eq", "neq", "empty", "notEmpty"].includes(filter.operator))) return { ok: false, error: "El filtro no corresponde a un campo permitido." };
  }
  const query = state.query.toLocaleLowerCase("es-MX");
  const rows = records.filter(record => (group === undefined || record.status === group) && (!query || [record.name, record.client].some(value => String(value).toLocaleLowerCase("es-MX").includes(query))) && state.filters.every(filter => matches(record, filter)));
  rows.sort((a, b) => { const left = a[state.sort], right = b[state.sort]; const comparison = typeof left === "number" && typeof right === "number" ? left - right : String(left).localeCompare(String(right), "es-MX", { numeric: true }); return (state.direction === "asc" ? comparison : -comparison) || a.id.localeCompare(b.id); });
  const page = Math.min(state.page, Math.max(1, Math.ceil(rows.length / state.pageSize))), start = (page - 1) * state.pageSize;
  return { ok: true, data: { rows: rows.slice(start, start + state.pageSize), total: rows.length, page, pageSize: state.pageSize } };
}
