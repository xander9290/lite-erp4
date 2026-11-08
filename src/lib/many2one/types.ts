/** Public lookup contract. Never expose complete Prisma records here. */
export const lookupModels = {
  user: { fields: ["id", "login", "partner.name"], searchFields: ["login", "partner.name"], displayName: "[{login}] {partner.name}" },
  partner: { fields: ["id", "name", "email", "phone", "user.login"], searchFields: ["name", "user.login"], displayName: "{name}" },
} as const;

export type Many2OneModel = keyof typeof lookupModels;
export type Many2OneRecord = {
  id: string;
  login?: string;
  name?: string;
  email?: string | null;
  phone?: string | null;
  partner?: { id: string; name: string } | null;
  user?: { id: string; login: string } | null;
};
export type Many2OneOption = { value: string; label: string; record: Many2OneRecord };
export type Many2OneRequest = {
  model: Many2OneModel;
  searchFields: readonly string[];
  displayName: string;
  query?: string;
  page?: number;
  pageSize?: number;
  id?: string;
  ids?: readonly string[];
};
export type Many2OneResult =
  | { ok: true; items: Many2OneOption[]; total: number; page: number; pageSize: number }
  | { ok: false; error: string };

export function readLookupPath(record: Many2OneRecord, path: string): string {
  let value: unknown = record;
  for (const key of path.split(".")) {
    if (!value || typeof value !== "object" || !Object.hasOwn(value, key)) return "";
    value = (value as Record<string, unknown>)[key];
  }
  return typeof value === "string" ? value : "";
}

export function formatLookupName(record: Many2OneRecord, template: string): string {
  return template.replace(/\{([\w.]+)\}/g, (_, path: string) => readLookupPath(record, path))
    .replace(/\[\s*\]|\(\s*\)/g, "").replace(/\s+/g, " ").trim() || record.id;
}
