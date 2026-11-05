export const listModels = {
  partner: { fields: ["id", "name", "user.login"], searchFields: ["name", "user.login"], defaultSort: "name", fieldTypes: { id: "text", name: "text", "user.login": "text" }, nullableFields: [], optionalRelations: ["user"] },
  user: { fields: ["id", "login", "partner.name", "lastLogin", "active", "isAdmin", "createdAt"], searchFields: ["login", "partner.name"], defaultSort: "login", fieldTypes: { id: "text", login: "text", "partner.name": "text", lastLogin: "datetime", active: "boolean", isAdmin: "boolean", createdAt: "datetime" }, nullableFields: ["lastLogin"], optionalRelations: ["partner"] },
} as const;

export type ListModel = keyof typeof listModels;
export type ListDataType = "text" | "number" | "integer" | "date" | "datetime" | "boolean";
export type ListFilterOperator = "contains" | "eq" | "neq" | "startsWith" | "endsWith" | "gt" | "gte" | "lt" | "lte" | "between" | "empty" | "notEmpty";
export type ListFilter = { field: string; operator: ListFilterOperator; value?: string; to?: string; precision?: "day" | "instant" };
export type ListColumn = {
  field: string;
  label: string;
  widget?: "partner";
  avatarField?: string;
  sortable?: boolean;
  filterable?: boolean;
  type?: ListDataType;
  align?: "left" | "center" | "right";
  format?: "text" | "number" | "currency" | "date" | "datetime" | "boolean";
  currency?: string;
  decimals?: number;
};
export type ListConfig = {
  model: ListModel;
  columns: readonly ListColumn[];
  searchFields: readonly string[];
  defaultSort?: { field: string; direction: "asc" | "desc" };
};
export type ListState = { query: string; page: number; pageSize: number; sort: string; direction: "asc" | "desc"; filters: ListFilter[]; invalidFilters?: boolean };
export type ListValue = string | number | boolean | null | ListValue[] | { [key: string]: ListValue };
export type ListRecord = { id: string; [key: string]: ListValue };
export type ListPage = { rows: ListRecord[]; total: number; page: number; pageSize: number };
export type ListResult = { ok: true; data: ListPage } | { ok: false; error: string };

const partnerWidgets: Record<ListModel, Readonly<Record<string, string>>> = {
  partner: { name: "avatarUrl" },
  user: { "partner.name": "partner.avatarUrl" },
};

/** Auxiliary avatar paths are whitelisted separately from searchable/sortable fields. */
export function listPartnerAvatarField(model: ListModel, column: ListColumn): string | null {
  if (column.widget !== "partner") return null;
  const fields = partnerWidgets[model];
  const path = Object.hasOwn(fields, column.field) ? fields[column.field] : null;
  return path && (column.avatarField === undefined || column.avatarField === path) ? path : null;
}

export function listColumnType(model: ListModel, column: ListColumn): ListDataType {
  const types = listModels[model].fieldTypes as Record<string, ListDataType>;
  return column.type ?? (Object.hasOwn(types, column.field) ? types[column.field] : "text");
}

export function listDisplayColumn(model: ListModel, column: ListColumn): ListColumn {
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
