import { listColumnType, listModels, type ListConfig, type ListDataType, type ListFilter, type ListFilterOperator } from "./types";

export const filterOperators: Record<ListDataType, readonly ListFilterOperator[]> = {
  text: ["contains", "eq", "neq", "startsWith", "endsWith", "empty", "notEmpty"],
  number: ["eq", "neq", "gt", "gte", "lt", "lte", "between"],
  integer: ["eq", "neq", "gt", "gte", "lt", "lte", "between"],
  date: ["eq", "gt", "gte", "lt", "lte", "between", "empty", "notEmpty"],
  datetime: ["eq", "gt", "gte", "lt", "lte", "between", "empty", "notEmpty"],
  boolean: ["eq"],
};
export const filterOperatorLabels: Record<ListFilterOperator, string> = {
  contains: "Contiene", eq: "Es igual a", neq: "Es distinto de", startsWith: "Comienza con", endsWith: "Termina con",
  gt: "Mayor que / después de", gte: "Mayor o igual / desde", lt: "Menor que / antes de", lte: "Menor o igual / hasta",
  between: "Entre", empty: "Está vacío", notEmpty: "Tiene valor",
};

export function columnOperatorLabel(type: ListDataType, operator: ListFilterOperator) {
  const temporal: Partial<Record<ListFilterOperator, string>> = { eq: "En", gt: "Después de", gte: "Desde", lt: "Antes de", lte: "Hasta" };
  const numeric: Partial<Record<ListFilterOperator, string>> = { eq: "Igual (=)", neq: "Distinto (≠)", gt: "Mayor que (>)", gte: "Mayor o igual (≥)", lt: "Menor que (<)", lte: "Menor o igual (≤)" };
  return ((type === "date" || type === "datetime") ? temporal[operator] : (type === "number" || type === "integer") ? numeric[operator] : undefined) ?? filterOperatorLabels[operator];
}

export function isListFilterShape(value: unknown): value is ListFilter {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const filter = value as Record<string, unknown>;
  return typeof filter.field === "string" && filter.field.length > 0 && filter.field.length <= 60 &&
    typeof filter.operator === "string" && Object.hasOwn(filterOperatorLabels, filter.operator) &&
    [filter.value, filter.to].every(value => value === undefined || (typeof value === "string" && value.length <= 120)) &&
    (filter.precision === undefined || filter.precision === "day" || filter.precision === "instant") &&
    Object.keys(filter).every(key => ["field", "operator", "value", "to", "precision"].includes(key));
}

export function filterValueError(type: ListDataType, filter: ListFilter): string | null {
  if (!filterOperators[type].includes(filter.operator)) return "Ese operador no corresponde al tipo de columna.";
  if (filter.operator === "empty" || filter.operator === "notEmpty") return null;
  if (!filter.value?.trim() || filter.value.length > 120) return "Introduce un valor para el filtro.";
  if (type === "text") return null;
  if (type === "boolean") return ["true", "false"].includes(filter.value) ? null : "Selecciona Sí o No.";
  if (type === "number" || type === "integer") {
    const values = filter.operator === "between" ? [filter.value, filter.to] : [filter.value];
    if (values.some(value => !value || !/^-?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(value) || !Number.isFinite(Number(value)) || (type === "integer" && !Number.isSafeInteger(Number(value))))) return type === "integer" ? "Introduce números enteros válidos." : "Introduce números válidos.";
    return filter.operator === "between" && Number(filter.value) > Number(filter.to) ? "El mínimo no puede ser mayor que el máximo." : null;
  }
  const isIso = (value?: string) => Boolean(value && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 19) === value.slice(0, 19));
  if (!isIso(filter.value)) return "La fecha debe incluir su hora UTC.";
  if (type === "date" && filter.precision !== "day") return "Elige un día o un rango de días.";
  if (filter.precision !== "day" && filter.precision !== "instant") return "Selecciona la precisión de la fecha.";
  if ((filter.precision === "day" || filter.operator === "between") && !isIso(filter.to)) return "Completa la fecha final.";
  if (filter.to && (filter.precision === "day" ? Date.parse(filter.to) <= Date.parse(filter.value) : Date.parse(filter.to) < Date.parse(filter.value))) return "La fecha final debe ser posterior a la inicial.";
  return null;
}

export function validateListFilters(config: ListConfig, filters: readonly ListFilter[]): string | null {
  if (filters.length > 12 || new Set(filters.map(filter => filter.field)).size !== filters.length) return "Usa un filtro por columna.";
  for (const filter of filters) {
    const column = config.columns.find(column => column.field === filter.field && column.filterable !== false);
    if (!column || !(listModels[config.model].fields as readonly string[]).includes(filter.field)) return "La columna del filtro no está habilitada.";
    const error = filterValueError(listColumnType(config.model, column), filter);
    if (error) return error;
  }
  return null;
}

function atRelation(parts: string[], predicate: Record<string, unknown>): Record<string, unknown> {
  return parts.reduceRight((inner, part) => ({ [part]: { is: inner } }), predicate);
}

/** Compile a validated scalar predicate; relation paths use Prisma's to-one `is`. */
export function compileColumnFilter(type: ListDataType, filter: ListFilter, nullable = false, optionalRelations: readonly string[] = []): Record<string, unknown> {
  const error = filterValueError(type, filter);
  if (error) throw new Error(error);
  const parts = filter.field.split(".");
  const field = parts.pop()!;
  const nest = (value: unknown) => atRelation(parts, { [field]: value });
  if (filter.operator === "empty" || filter.operator === "notEmpty") {
    const empty = [...(nullable ? [nest(null)] : []), ...(type === "text" ? [nest("")] : [])];
    const absent = parts.flatMap((_part, index) => {
      const prefix = parts.slice(0, index + 1).join(".");
      return optionalRelations.includes(prefix) ? [atRelation(parts.slice(0, index), { [parts[index]]: { is: null } })] : [];
    });
    if (filter.operator === "empty") return { OR: [...empty, ...absent] };
    return { AND: [...(nullable ? [nest({ not: null })] : []), ...(type === "text" ? [nest({ not: "" })] : []), ...(parts.length ? [atRelation(parts, {})] : [])] };
  }
  if (type === "text") {
    const value = ["eq", "neq"].includes(filter.operator) ? filter.value! : filter.value!.replace(/[\\%_]/g, "\\$&");
    const operator = filter.operator === "eq" ? "equals" : filter.operator === "neq" ? "not" : filter.operator;
    return nest({ [operator]: value, mode: "insensitive" });
  }
  if (type === "boolean") return nest(filter.value === "true");
  if (type === "number" || type === "integer") {
    const value = Number(filter.value);
    return nest(filter.operator === "between" ? { gte: value, lte: Number(filter.to) } : { [filter.operator === "eq" ? "equals" : filter.operator === "neq" ? "not" : filter.operator]: value });
  }
  const start = new Date(filter.value!);
  const end = filter.to ? new Date(filter.to) : start;
  if (filter.precision === "day") {
    const predicate = filter.operator === "eq" || filter.operator === "between" ? { gte: start, lt: end }
      : filter.operator === "gt" ? { gte: end } : filter.operator === "lte" ? { lt: end } : { [filter.operator]: start };
    return nest(predicate);
  }
  return nest(filter.operator === "between" ? { gte: start, lte: end } : { [filter.operator === "eq" ? "equals" : filter.operator]: start });
}

export function compileListFilters(config: ListConfig, filters: readonly ListFilter[]) {
  const error = validateListFilters(config, filters);
  if (error) throw new Error(error);
  const model = listModels[config.model];
  return filters.map(filter => compileColumnFilter(listColumnType(config.model, config.columns.find(column => column.field === filter.field)!), filter, (model.nullableFields as readonly string[]).includes(filter.field), model.optionalRelations));
}
