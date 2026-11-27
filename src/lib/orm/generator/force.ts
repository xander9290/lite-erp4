import "server-only";
import type { Client } from "pg";
import type { GenerationProfile } from "./profile";
import { prismaColumnName, type ModuleGeneration } from "./generate";

const identifier = (value: string) => `"${value.replaceAll('"', '""')}"`;
const literal = (value: string) => `'${value.replaceAll("'", "''")}'`;
/** `columns` marks a compound uniqueTogether key: only its duplicate check applies. */
export type ForceCheck = { table: string; field: string; column?: string; columns?: readonly string[]; model: string; maxLength?: number; unique?: boolean; required?: boolean };
/** Trusted declarations only; never accept checks from an action/browser. */
export function forceChecks(profile: GenerationProfile): ForceCheck[] {
  return profile.module.models.flatMap(({model}) => [
    ...Object.entries(model.metadata).flatMap(([field, metadata]) =>
      metadata.kind === "text" || metadata.kind === "image" || metadata.kind === "many2one" ? [{ table:model.table, field, column:prismaColumnName(field), model:model.name,
        maxLength:metadata.kind === "many2one" ? undefined : metadata.maxLength, unique:metadata.unique, required:metadata.required,
      }] : []),
    ...(model.uniqueTogether ?? []).map(keys => ({ table:model.table, field:keys.join(", "), columns:keys.map(prismaColumnName), model:model.name, unique:true })),
  ]);
}

/**
 * Prisma's default names for the single-column unique indexes that the trusted declarations
 * no longer request. A reviewed force migration may drop only these (data is never touched).
 */
export function retirableUniqueIndexes(module: Pick<ModuleGeneration, "models">): Set<string> {
  return new Set(module.models.flatMap(({model}) => Object.entries(model.metadata)
    .filter(([, metadata]) => !metadata.unique).map(([field]) => `${model.table}_${prismaColumnName(field)}_key`)));
}

/** Removes whole `DROP INDEX "<name>";` statements for those exact retirable unique indexes. */
export function withoutRetirableDrops(sql: string, retirable?: ReadonlySet<string>) {
  if (!retirable?.size) return sql;
  return sql.replace(/^\s*DROP\s+INDEX\s+"((?:[^"]|"")+)"\s*;\s*$/gim, (statement, name: string) => retirable.has(name.replaceAll('""', '"')) ? "" : statement);
}

export function checkQueries(check: ForceCheck, table = identifier(check.table)) {
  if (check.columns) {
    const columns = check.columns.map(identifier);
    return [{ sql:`SELECT 1 FROM ${table} WHERE ${columns.map(column => `${column} IS NOT NULL`).join(" AND ")} GROUP BY ${columns.join(", ")} HAVING count(*) > 1 LIMIT 1`,
      error:`${check.model} (${check.field}): existen combinaciones duplicadas. Corrígelas antes de añadir uniqueTogether.` }];
  }
  const field = identifier(check.column ?? check.field), label = `${check.model}.${check.field}`;
  const queries: { sql: string; error: string }[] = [];
  if (check.maxLength !== undefined) queries.push({ sql:`SELECT 1 FROM ${table} WHERE char_length(${field}) > ${check.maxLength} LIMIT 1`, error:`${label}: existen valores mayores de ${check.maxLength} caracteres. Corrígelos antes de sincronizar; no se truncarán.` });
  if (check.unique) queries.push({ sql:`SELECT 1 FROM ${table} WHERE ${field} IS NOT NULL GROUP BY ${field} HAVING count(*) > 1 LIMIT 1`, error:`${label}: existen valores duplicados. Corrígelos antes de añadir unique.` });
  if (check.required) queries.push({ sql:`SELECT 1 FROM ${table} WHERE ${field} IS NULL LIMIT 1`, error:`${label}: existen valores nulos. Complétalos antes de hacerlo obligatorio.` });
  return queries;
}

/** Check existing columns only. New fields/models remain governed by additive installation. */
export async function validateForceData(client: Client, schema: string, checks: readonly ForceCheck[]) {
  const columns = await client.query<{table_name:string;column_name:string;data_type:string}>(
    "SELECT table_name,column_name,data_type FROM information_schema.columns WHERE table_schema=$1", [schema]);
  const existing: ForceCheck[] = [];
  for (const check of checks) {
    if (check.columns) {
      // A compound key over a new column/table is created by the same migration: nothing to check yet.
      if (!check.columns.every(name => columns.rows.some(column => column.table_name === check.table && column.column_name === name))) continue;
      for (const query of checkQueries(check, `${identifier(schema)}.${identifier(check.table)}`)) {
        if ((await client.query(query.sql)).rows.length) throw new Error(query.error);
      }
      existing.push(check);
      continue;
    }
    const column = columns.rows.find(column => column.table_name === check.table && column.column_name === (check.column ?? check.field));
    if (!column) continue;
    if (!["text", "character varying"].includes(column.data_type)) throw new Error(`${check.model}.${check.field}: el tipo instalado requiere una migración manual.`);
    for (const query of checkQueries(check, `${identifier(schema)}.${identifier(check.table)}`)) {
      if ((await client.query(query.sql)).rows.length) throw new Error(query.error);
    }
    existing.push(check);
  }
  return existing;
}

/** Protect the interval after human review: block writes, recheck, then execute DDL atomically. */
export function forcedMigrationSQL(sql: string, checks: readonly ForceCheck[]) {
  const tables = [...new Set(checks.map(check => check.table))].sort();
  const locks = tables.map(table => `LOCK TABLE ${identifier(table)} IN SHARE ROW EXCLUSIVE MODE;`).join("\n");
  const guards = checks.flatMap(check => checkQueries(check).map(query => `  IF EXISTS (${query.sql}) THEN RAISE EXCEPTION USING MESSAGE = ${literal(query.error)}; END IF;`));
  return `-- lite-erp: reviewed force migration\nBEGIN;\nSET LOCAL lock_timeout = '10s';\n${locks}\n${guards.length ? `DO $lite_erp_force$\nBEGIN\n${guards.join("\n")}\nEND;\n$lite_erp_force$;\n` : ""}${sql.trim()}\nCOMMIT;\n`;
}
