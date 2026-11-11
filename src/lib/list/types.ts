export const listModels = {
  partner: { fields: ["id", "name", "email", "phone", "user.login"], searchFields: ["name", "email", "phone", "user.login"], defaultSort: "name", fieldTypes: { id: "text", name: "text", email: "text", phone: "text", "user.login": "text" }, nullableFields: ["email", "phone"], optionalRelations: ["user"] },
  user: { fields: ["id", "login", "partner.name", "lastLogin", "active", "isAdmin", "createdAt"], searchFields: ["login", "partner.name"], defaultSort: "login", fieldTypes: { id: "text", login: "text", "partner.name": "text", lastLogin: "datetime", active: "boolean", isAdmin: "boolean", createdAt: "datetime" }, nullableFields: ["lastLogin"], optionalRelations: ["partner"] },
  dentalAppointment: { fields: ["id", "patient.name", "patient.phone", "scheduledAt", "reason", "status"], searchFields: ["patient.name", "patient.phone", "reason"], defaultSort: "scheduledAt", fieldTypes: { id: "text", "patient.name": "text", "patient.phone": "text", scheduledAt: "datetime", reason: "text", status: "text" }, nullableFields: ["patient.phone"], optionalRelations: [] },
} as const;

export type ListModel = keyof typeof listModels;
export type ListDataType = "text" | "number" | "integer" | "date" | "datetime" | "boolean";
export type ListFilterOperator = "contains" | "eq" | "neq" | "startsWith" | "endsWith" | "gt" | "gte" | "lt" | "lte" | "between" | "empty" | "notEmpty";
export type ListFilter = { field: string; operator: ListFilterOperator; value?: string; to?: string; precision?: "day" | "instant" };
export type ListColumn = {
  field: string;
  label: string;
  widget?: "partner" | "image" | "many2one";
  options?: readonly { value: string; label: string }[];
  imageSize?: "sm" | "md" | "lg";
  imageShape?: "rounded" | "squared";
  avatarField?: string;
  sortable?: boolean;
  filterable?: boolean;
  /** Explicit opt-in; the server must also authorize this scalar field. */
  groupable?: boolean;
  type?: ListDataType;
  align?: "left" | "center" | "right";
  format?: "text" | "number" | "currency" | "date" | "datetime" | "boolean";
  currency?: string;
  decimals?: number;
};

/** Presentation options are bounded, and never choose another field or remote resource. */
export function validImageColumnOptions(column: ListColumn): boolean {
  return (column.imageSize === undefined || (column.widget === "image" && ["sm", "md", "lg"].includes(column.imageSize))) &&
    (column.imageShape === undefined || (column.widget === "image" && ["rounded", "squared"].includes(column.imageShape)));
}
export type ListConfig = {
  model: ListModel;
  columns: readonly ListColumn[];
  searchFields: readonly string[];
  defaultSort?: { field: string; direction: "asc" | "desc" };
};
/** Custom sources supply their own authorized server action; this is presentation metadata. */
export type ListViewConfig = Omit<ListConfig, "model"> & { model: string };
export type ListGroupValue = string | number | boolean | null;
export type ListState = { query: string; page: number; pageSize: number; sort: string; direction: "asc" | "desc"; filters: ListFilter[]; invalidFilters?: boolean; groupBy?: string[]; groupPath?: ListGroupValue[] };
export type ListValue = string | number | boolean | null | ListValue[] | { [key: string]: ListValue };
export type ListRecord = { id: string; [key: string]: ListValue };
export type ListGroup = { value: ListGroupValue; count: number; label?: string };
export type ListPage = { rows: ListRecord[]; total: number; page: number; pageSize: number; groups?: ListGroup[]; groupField?: string; hasMoreGroups?: boolean };
export type ListResult = { ok: true; data: ListPage } | { ok: false; error: string };

const partnerWidgets: Record<ListModel, Readonly<Record<string, string>>> = {
  partner: { name: "avatarUrl" },
  user: { "partner.name": "partner.avatarUrl" },
  dentalAppointment: { "patient.name": "patient.avatarUrl" },
};

/** Auxiliary avatar paths are whitelisted separately from searchable/sortable fields. */
export function listPartnerAvatarField(model: string, column: ListColumn): string | null {
  if (column.widget !== "partner") return null;
  const fields = Object.hasOwn(partnerWidgets, model) ? partnerWidgets[model as ListModel] : {};
  const path = Object.hasOwn(fields, column.field) ? fields[column.field] : null;
  return path && (column.avatarField === undefined || column.avatarField === path) ? path : null;
}

export function listColumnType(model: string, column: ListColumn): ListDataType {
  const types = Object.hasOwn(listModels, model) ? listModels[model as ListModel].fieldTypes as Record<string, ListDataType> : {};
  return column.type ?? (Object.hasOwn(types, column.field) ? types[column.field] : "text");
}

export function listDisplayColumn(model: string, column: ListColumn): ListColumn {
  const type = listColumnType(model, column);
  const avatarField = listPartnerAvatarField(model, column);
  return { ...column, ...(avatarField ? { avatarField } : {}), format: column.format ?? (type === "integer" ? "number" : type), ...(type === "integer" && column.decimals === undefined ? { decimals: 0 } : {}) };
}

export function readListValue(record: ListRecord, path: string): ListValue {
  let value: ListValue = record;
  for (const part of path.split(".")) {
    if (!value || typeof value !== "object" || Array.isArray(value) || !Object.hasOwn(value, part)) return null;
    value = value[part];
  }
  return value;
}

/** Presentation only: the stored scalar remains available through readListValue. */
export function readListDisplayValue(record: ListRecord, column: ListColumn): ListValue {
  const value = readListValue(record, column.field);
  if (column.widget !== "many2one" || value === null || value === "") return value;
  const labels = Object.hasOwn(record, "$labels") ? record.$labels : null;
  const label = labels && typeof labels === "object" && !Array.isArray(labels) && Object.hasOwn(labels, column.field) ? labels[column.field] : null;
  return label && typeof label === "object" && !Array.isArray(label) && label.value === value && typeof label.label === "string" ? label.label : "No disponible";
}
