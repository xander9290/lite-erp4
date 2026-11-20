import "server-only";
import type { Client } from "pg";

export type UniqueIndex = { name: string; table: string; columns: readonly string[] };
const quoted = String.raw`"((?:[^"]|"")+)"`;
const statement = new RegExp(String.raw`^CREATE UNIQUE INDEX ${quoted} ON ${quoted}\((${quoted}(?:,\s*${quoted})*)\);$`);
const identifier = (value: string) => `"${value.replaceAll('"', '""')}"`;
const unquote = (value: string) => value.replaceAll('""', '"');

/**
 * Prisma's `migrate dev --create-only` stops on the duplicate-values warning of every
 * new unique index when stdin is closed. Recognize a diff made ONLY of such indexes
 * (simple or compound) so sync can prepare it itself; anything else returns null and
 * keeps Prisma's own flow.
 */
export function uniqueIndexMigration(sql: string): UniqueIndex[] | null {
  const lines = sql.replace(/\r\n/g, "\n").split("\n").map(line => line.trim()).filter(line => line && !line.startsWith("--"));
  if (!lines.length) return null;
  const indexes: UniqueIndex[] = [];
  for (const line of lines) {
    const match = statement.exec(line);
    if (!match) return null;
    const columns = [...match[3].matchAll(new RegExp(quoted, "g"))].map(column => unquote(column[1]));
    indexes.push({ name: unquote(match[1]), table: unquote(match[2]), columns });
  }
  return indexes;
}

/** PostgreSQL unique indexes accept repeated NULLs: only complete groups can collide. */
export function duplicateQuery(schema: string, index: UniqueIndex) {
  const columns = index.columns.map(identifier);
  return `SELECT 1 FROM ${identifier(schema)}.${identifier(index.table)} WHERE ${columns.map(column => `${column} IS NOT NULL`).join(" AND ")} GROUP BY ${columns.join(", ")} HAVING count(*) > 1 LIMIT 1`;
}

/** Read-only checks before preparing the file; index creation still rejects later races. */
export async function assertNoUniqueDuplicates(client: Client, schema: string, indexes: readonly UniqueIndex[]) {
  for (const index of indexes) {
    if ((await client.query(duplicateQuery(schema, index))).rows.length) throw new Error(`${index.table}(${index.columns.join(", ")}): existen valores duplicados. Corrígelos antes de añadir la restricción única; no se modifican datos.`);
  }
}

export function uniqueIndexMigrationSQL(sql: string, indexes: readonly UniqueIndex[]) {
  return `-- lite-erp: unique indexes prepared by orm:sync (Prisma cannot answer its duplicate warning without a terminal).\n-- Checked before preparing: no duplicate complete groups in ${indexes.map(index => `${index.table}(${index.columns.join(", ")})`).join(", ")}.\n${sql.replace(/\r\n/g, "\n").trim()}\n`;
}
