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
  "createByUser.partner.name": "text",
} as const;

export function auditColumnType(field: string) {
  return Object.hasOwn(auditColumnTypes, field) ? auditColumnTypes[field as keyof typeof auditColumnTypes] : undefined;
}

export function auditAvatarField(field: string) {
  return field === "createByUser.login" || field === "createByUser.partner.name" ? "createByUser.partner.avatarUrl" : null;
}

/** Optional columns, shared by the client view and its authorized server service. */
export const recordAuditColumns = [
  { field: "createByUser.login", label: "Creado por", type: "text", widget: "partner", avatarField: "createByUser.partner.avatarUrl", sortable: true },
  { field: "createdAt", label: "Creado el", type: "datetime", sortable: true },
  { field: "updatedAt", label: "Actualizado el", type: "datetime", sortable: true },
] as const satisfies readonly ListColumn[];
