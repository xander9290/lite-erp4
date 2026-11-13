import "server-only";
import { randomBytes, createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { Client } from "pg";
import { assertNoSymlinks } from "../orm/generator/write";

const quote = (value: string) => `"${value.replaceAll('"', '""')}"`;
async function counts(client: Client, schema: string) {
  const tables = await client.query<{ table_name: string }>("SELECT table_name FROM information_schema.tables WHERE table_schema=$1 AND table_type='BASE TABLE' ORDER BY table_name", [schema]);
  const result: Record<string, string> = {};
  for (const { table_name } of tables.rows) result[table_name] = (await client.query(`SELECT COUNT(*)::text AS count FROM ${quote(schema)}.${quote(table_name)}`)).rows[0].count;
  return result;
}

/** Back up the complete configured schema, restore it in an exclusive temporary
 * database and compare its table counts before authorizing any destructive DDL.
 * PG credentials travel in environment variables, never command-line arguments.
 */
export async function verifyDatabaseBackup(root: string, id: string, connection: string) {
  if (!/^[a-f0-9]{32}$/.test(id)) throw new Error("Identidad de respaldo inválida.");
  const url = new URL(connection), schema = url.searchParams.get("schema") ?? "public";
  const databaseName = decodeURIComponent(url.pathname.slice(1));
  const temporary = `module_backup_verify_${randomBytes(10).toString("hex")}`;
  const directory = join(root, ".module-operations", `backup-${id}`);
  await assertNoSymlinks(directory); await mkdir(directory, { mode: 0o700 });
  const backup = join(directory, "database.dump");
  const executable = (name: string) => process.env.MODULE_MANAGER_PG_BIN ? join(process.env.MODULE_MANAGER_PG_BIN, name + (process.platform === "win32" ? ".exe" : "")) : name;
  const env = { ...process.env, PGHOST: url.hostname, PGPORT: url.port || "5432", PGUSER: decodeURIComponent(url.username), PGPASSWORD: decodeURIComponent(url.password), PGSSLMODE: url.searchParams.get("sslmode") ?? "prefer" };
  const run = (name: string, args: string[]) => {
    const result = spawnSync(executable(name), args, { cwd: root, env, encoding: "utf8", timeout: 180000, windowsHide: true });
    if (result.error || result.status !== 0) throw new Error(`No se pudo verificar el respaldo con ${name}. Configura las herramientas PostgreSQL y permisos de respaldo/restauración. No se ha eliminado ningún dato.`);
  };
  const source = new Client({ connectionString: connection, connectionTimeoutMillis: 10000 });
  let created = false;
  try {
    await source.connect();
    // A backup scoped to one schema cannot restore dependencies in another schema.
    const cross = await source.query(`SELECT 1 FROM pg_constraint c JOIN pg_class own ON own.oid=c.conrelid JOIN pg_namespace a ON a.oid=own.relnamespace JOIN pg_class ref ON ref.oid=c.confrelid JOIN pg_namespace b ON b.oid=ref.relnamespace WHERE c.contype='f' AND (a.nspname=$1 OR b.nspname=$1) AND a.nspname<>b.nspname LIMIT 1`, [schema]);
    if (cross.rowCount) throw new Error("Hay referencias entre schemas. Esta retirada requiere un respaldo y procedimiento específicos.");
    const before = await counts(source, schema);
    run("pg_dump", ["--dbname", databaseName, "--format=custom", "--no-owner", "--no-privileges", "--schema", schema, "--file", backup]);
    await source.query(`CREATE DATABASE ${quote(temporary)} TEMPLATE template0`); created = true;
    const targetURL = new URL(connection); targetURL.pathname = `/${temporary}`;
    const target = new Client({ connectionString: targetURL.toString(), connectionTimeoutMillis: 10000 });
    try {
      await target.connect();
      if (schema === "public") await target.query('DROP SCHEMA "public"');
      run("pg_restore", ["--dbname", temporary, "--no-owner", "--no-privileges", "--exit-on-error", backup]);
      if (JSON.stringify(await counts(target, schema)) !== JSON.stringify(before) || JSON.stringify(await counts(source, schema)) !== JSON.stringify(before)) throw new Error("El respaldo no coincide con el origen o hubo escrituras durante la verificación. No se aplicará la retirada.");
    } finally { await target.end(); }
    await writeFile(join(directory, "verified.json"), JSON.stringify({ schema, environment: createHash("sha256").update(connection).digest("hex"), tables: before, verifiedAt: new Date().toISOString() }), { mode: 0o600 });
  } finally {
    // Only our recorded, successfully-created database may be removed.
    if (created && /^module_backup_verify_[a-f0-9]{20}$/.test(temporary) && temporary !== databaseName) await source.query(`DROP DATABASE ${quote(temporary)} WITH (FORCE)`);
    await source.end();
  }
}
