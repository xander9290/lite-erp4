import "server-only";
import type { PrismaClient } from "@/generated/prisma/client";
import { AccessError } from "../auth/policy";
import type { ModelActor } from "../orm/context";
import { listStateSchema } from "../list/query";
import type { ListPage, ListRecord } from "../list/types";
import { readModuleInventory, resolveCatalogue } from "./inventory";
import { kindLabel, statusLabel, type ManagedModule } from "./types";

/** Trusted server configuration; never accepted from a Server Action payload. */
export type CatalogueContext = { root: string; schema: string; registered: ReadonlySet<string> };

export async function moduleCatalogue(prisma: PrismaClient, actor: ModelActor, context: CatalogueContext): Promise<ManagedModule[]> {
  return prisma.$transaction(async tx => {
    await tx.$executeRaw`SET TRANSACTION READ ONLY`;
    const account = await tx.user.findUnique({ where: { id: actor.id }, select: { active: true, isAdmin: true, sessionVersion: true } });
    if (!account?.active || account.sessionVersion !== actor.sessionVersion) throw new AccessError("UNAUTHENTICATED");
    if (!account.isAdmin) throw new AccessError("FORBIDDEN");
    const inventory = await readModuleInventory(context.root);
    const columns = await tx.$queryRaw<{ table_name: string; column_name: string }[]>`
      SELECT c.table_name, c.column_name FROM information_schema.columns c
      JOIN information_schema.tables t ON t.table_schema = c.table_schema AND t.table_name = c.table_name
      WHERE c.table_schema = ${context.schema} AND t.table_type = 'BASE TABLE'
    `;
    return resolveCatalogue(inventory, context.registered, columns);
  }, { isolationLevel: "RepeatableRead", timeout: 15000 });
}

const fields = ["id", "name", "kind", "status", "version"];
const operators = ["eq", "neq", "contains", "startsWith", "endsWith", "empty", "notEmpty"];
const folded = (text: string) => text.normalize("NFD").replace(/\p{Mn}/gu, "").toLocaleLowerCase("es");

/** Fixed catalogue policy; it cannot expand the legacy ListView model whitelist. */
export function cataloguePage(records: readonly ManagedModule[], input: unknown): ListPage {
  const state = listStateSchema.parse(input);
  if (state.invalidFilters || !fields.includes(state.sort) || state.groupBy?.length || state.groupPath?.length || state.filters.some(filter => !fields.includes(filter.field) || !operators.includes(filter.operator))) throw new Error("Consulta de catálogo inválida.");
  const query = folded(state.query.trim());
  let rows: ListRecord[] = records.map(record => ({ id: record.id, name: record.name, kind: record.kind, status: record.status, version: record.version }));
  rows = rows.filter(row => !query || folded(`${row.name} ${row.id} ${kindLabel(String(row.kind))} ${statusLabel(String(row.status))}`).includes(query));
  for (const filter of state.filters) rows = rows.filter(row => {
    const value = folded(String(row[filter.field] ?? "")), expected = folded(filter.value ?? "");
    switch (filter.operator) {
      case "eq": return value === expected;
      case "neq": return value !== expected;
      case "contains": return value.includes(expected);
      case "startsWith": return value.startsWith(expected);
      case "endsWith": return value.endsWith(expected);
      case "empty": return !value;
      case "notEmpty": return Boolean(value);
      default: return false;
    }
  });
  rows.sort((a, b) => (String(a[state.sort]).localeCompare(String(b[state.sort]), "es", { numeric: true, sensitivity: "base" }) || a.id.localeCompare(b.id)) * (state.direction === "asc" ? 1 : -1));
  const total = rows.length;
  const page = Math.min(state.page, Math.max(1, Math.ceil(total / state.pageSize)));
  return { rows: rows.slice((page - 1) * state.pageSize, page * state.pageSize), total, page, pageSize: state.pageSize };
}
