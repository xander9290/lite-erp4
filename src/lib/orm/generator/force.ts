import "server-only";
import type { Client } from "pg";
import type { GenerationProfile } from "./profile";

const identifier = (value: string) => `"${value.replaceAll('"', '""')}"`;
const literal = (value: string) => `'${value.replaceAll("'", "''")}'`;
export type ForceCheck = { table: string; field: string; model: string; maxLength?: number; unique?: boolean; required?: boolean };
/** Trusted declarations only; never accept checks from an action/browser. */
export function forceChecks(profile: GenerationProfile): ForceCheck[] {
  return profile.module.models.flatMap(({model}) => Object.entries(model.metadata).flatMap(([field, metadata]) =>
    metadata.kind === "text" || metadata.kind === "image" || metadata.kind === "many2one" ? [{ table:model.table, field, model:model.name,
      maxLength:metadata.kind === "many2one" ? undefined : metadata.maxLength, unique:metadata.unique, required:metadata.required,
    }] : []));
}

export function checkQueries(check: ForceCheck, table = identifier(check.table)) {
  const field = identifier(check.field), label = `${check.model}.${check.field}`;
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
    const column = columns.rows.find(column => column.table_name === check.table && column.column_name === check.field);
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
