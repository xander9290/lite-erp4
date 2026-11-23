import type { ListColumn } from "../list/types";

/** Read-only presentation metadata. Never merge this object into form values. */
export type RecordAudit = {
  createdAt: string;
  updatedAt: string;
  createBy: { id: string; login: string; name: string; avatarUrl: string | null } | null;
};

export const auditColumnTypes = {
  createdAt: "datetime",
  updatedAt: "datetime",
  createBy: "text",
  "createByUser.login": "text",
  "createByUser.name": "text",
} as const;

export function auditColumnType(field: string) {
  return Object.hasOwn(auditColumnTypes, field) ? auditColumnTypes[field as keyof typeof auditColumnTypes] : undefined;
}

export function auditAvatarField(field: string) {
  return field === "createByUser.login" || field === "createByUser.name" ? "createByUser.avatarUrl" : null;
}

/** Optional columns, shared by the client view and its authorized server service. */
export const recordAuditColumns = [
  { field: "createByUser.login", label: "Creado por", type: "text", widget: "partner", avatarField: "createByUser.avatarUrl", sortable: true },
  { field: "createdAt", label: "Creado el", type: "datetime", sortable: true },
  { field: "updatedAt", label: "Actualizado el", type: "datetime", sortable: true },
] as const satisfies readonly ListColumn[];

/**
 * Audit columns a declarative model publishes to its collections with `audit: true` in the
 * manifest. Readable creator (contact name with avatar) and dates; never the raw User ID or
 * other User fields. The server list policy still decides what is queried.
 */
export const auditCollectionColumns = [
  { field: "createBy", label: "Creado por", type: "text", widget: "many2one" },
  { field: "createByUser.name", label: "Nombre del creador", type: "text", widget: "partner", avatarField: "createByUser.avatarUrl" },
  { field: "createdAt", label: "Creado el", type: "datetime" },
  { field: "updatedAt", label: "Actualizado el", type: "datetime" },
] as const satisfies readonly ListColumn[];
export const auditCollectionFields: readonly string[] = auditCollectionColumns.map(column => column.field);
/** Published by default with `audit: true`; the creator's name column is optional (sort by name, avatar). */
export const defaultAuditFields: readonly string[] = ["createBy", "createdAt", "updatedAt"];
