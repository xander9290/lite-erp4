import type { ListColumn, ListGroup, ListGroupValue, ListPage, ListState } from "./types";

/** No relation paths or temporal buckets in the scalar grouping contract. */
export function scalarGroupingColumn(column: ListColumn) {
  return column.groupable === true && /^[A-Za-z][A-Za-z0-9_]*$/.test(column.field) && !["date", "datetime"].includes(column.type ?? column.format ?? "text");
}

export function groupingPlan(columns: readonly ListColumn[], state: ListState) {
  const fields = state.groupBy ?? [], path = state.groupPath ?? [];
  if (fields.length > 3 || new Set(fields).size !== fields.length || path.length > fields.length) throw new Error("La agrupación no es válida.");
  const selected = fields.map(field => {
    const column = columns.find(column => column.field === field && scalarGroupingColumn(column));
    if (!column) throw new Error("La columna de agrupación no está habilitada.");
    return column;
  });
  const predicates = path.map((value, index) => {
    const column = selected[index], type = column.type ?? "text";
    if (value !== null && (type === "boolean" ? typeof value !== "boolean" : ["integer", "number"].includes(type) ? typeof value !== "number" || !Number.isFinite(value) || (type === "integer" && !Number.isSafeInteger(value)) : typeof value !== "string" || value.length > 1000)) throw new Error("El valor del grupo no corresponde a su columna.");
    // Exact equality, including case and null. Never use case-insensitive text filters here.
    return { [column.field]: value };
  });
  return { field: fields[path.length], predicates };
}

export type GroupQuery = { where: Record<string, unknown>; field: string; skip: number; take: number };
export function groupedPage(state: ListState, total: number, groups: ListGroup[]): ListPage {
  return { rows: [], total, page: state.page, pageSize: state.pageSize, groups: groups.slice(0, state.pageSize), groupField: state.groupBy?.[state.groupPath?.length ?? 0], hasMoreGroups: groups.length > state.pageSize };
}

export function groupValueLabel(value: ListGroupValue) {
  return value === null ? "Sin valor" : value === "" ? "Texto vacío" : typeof value === "boolean" ? value ? "Sí" : "No" : String(value);
}

export function groupDisplayLabel(group: ListGroup, column?: ListColumn) {
  if (group.value === null || group.value === "") return groupValueLabel(group.value);
  if (column?.widget === "many2one") return group.label?.trim() || "No disponible";
  return column?.options?.find(option => option.value === group.value)?.label ?? groupValueLabel(group.value);
}
