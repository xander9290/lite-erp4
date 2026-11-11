import "server-only";
import { createHash } from "node:crypto";
import { open, readdir, readFile, rm } from "node:fs/promises";
import { join, relative } from "node:path";
import { pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
import { Client } from "pg";
import { loadAppGenerationProfile } from "./profile";
import { installModels } from "./install";
import { artifactPlan, assertNoSymlinks, writeArtifacts } from "./write";
import { imageUploadFiles } from "./image-uploads";
import { prepareModuleArtifacts } from "./prepare";
import { bindRepositories } from "./bind";

export type MigrationFile = { name: string; sql: string };
export type AppliedMigration = { migration_name: string; checksum: string; finished_at: unknown; rolled_back_at: unknown };
const checksum = (sql: string) => createHash("sha256").update(sql).digest("hex");

/** Match Prisma's migration identity; tolerate checkout line endings, never content edits. */
export function pendingMigrations(files: readonly MigrationFile[], applied: readonly AppliedMigration[]) {
  for (const row of applied.filter(row => !row.rolled_back_at)) {
    if (!row.finished_at) throw new Error(`La migración ${row.migration_name} falló o sigue en ejecución. Revisa migrate status antes de continuar.`);
    const file = files.find(file => file.name === row.migration_name);
    if (!file) throw new Error(`Falta en el repositorio la migración aplicada ${row.migration_name}.`);
    const lf = file.sql.replace(/\r\n/g, "\n");
    if (![file.sql, lf, lf.replace(/\n/g, "\r\n")].some(sql => checksum(sql) === row.checksum)) throw new Error(`Se modificó la migración aplicada ${file.name}. No se reescribe su historial.`);
  }
  return files.filter(file => !applied.some(row => row.migration_name === file.name && row.finished_at && !row.rolled_back_at));
}

export function assertSyncSQL(sql: string, migrationName?: string) {
  if (/\bDROP\s+(TABLE|COLUMN|TYPE|INDEX|CONSTRAINT)\b|\bTRUNCATE\b|\bDELETE\s+FROM\b/i.test(sql)) throw new Error(`La migración${migrationName ? ` ${migrationName}` : ""} contiene retiradas o borrados: requiere el flujo manual de revisión.`);
}

async function migrationFiles(root: string): Promise<MigrationFile[]> {
  const directory = join(root, "prisma/migrations");
  await assertNoSymlinks(directory);
  const files: MigrationFile[] = [];
  for (const entry of (await readdir(directory, { withFileTypes: true })).sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0)) {
    if (entry.isSymbolicLink()) throw new Error("No se permiten enlaces en migraciones.");
    if (!entry.isDirectory()) continue;
    const path = join(directory, entry.name, "migration.sql");
    await assertNoSymlinks(path);
    files.push({ name: entry.name, sql: await readFile(path, "utf8") });
  }
  return files;
}

async function readApplied(url: string): Promise<AppliedMigration[]> {
  const parsed = new URL(url);
  const schema = parsed.searchParams.get("schema") || "public";
  const table = `"${schema.replaceAll('"', '""')}"."_prisma_migrations"`;
  const client = new Client({ connectionString: url, connectionTimeoutMillis: 10000 });
  try {
    await client.connect();
    const exists = await client.query("SELECT to_regclass($1) AS name", [table]);
    if (!exists.rows[0].name) {
      const tables = await client.query("SELECT 1 FROM information_schema.tables WHERE table_schema=$1 AND table_type='BASE TABLE' LIMIT 1", [schema]);
      if (tables.rowCount) throw new Error("La base contiene tablas sin historial Prisma. Requiere una revisión manual antes de sincronizar.");
      return [];
    }
    return (await client.query(`SELECT migration_name, checksum, finished_at, rolled_back_at FROM ${table}`)).rows;
  } finally { await client.end(); }
}

type SyncOptions = {
  plan?: boolean;
  name?: string;
  log: (message: string) => void;
  confirm: (message: string) => Promise<boolean>;
};

/** Development orchestration only. Never exposed as an action, never executes reset/push. */
export async function syncApplication(root: string, id: string, options: SyncOptions) {
  if (!/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(id) || (options.name !== undefined && !/^[a-z][a-z0-9_]{0,59}$/.test(options.name))) throw new Error("Identificador o nombre de migración inválido.");
  if (process.env.NODE_ENV === "production") throw new Error("orm:sync es sólo para desarrollo. Usa el flujo de despliegue en producción.");
  const profile = await loadAppGenerationProfile(root, id);
  if (!profile) throw new Error("No existe un orm.config.ts para esta aplicación.");
  if (options.plan) {
    const plan = await installModels(root, profile, false, true);
    const uploadDirectory = join(root, "src/generated/orm/uploads", id);
    const uploads = await artifactPlan(uploadDirectory, `uploads-${id}`, imageUploadFiles(profile.module));
    options.log(`Plan de fuentes de ${id} (sin consultar la base):`);
    for (const change of plan.changes) options.log(relative(root, change.path));
    for (const change of uploads.changes.filter(change => change.action !== "unchanged")) options.log(`${change.action}: ${relative(root, join(uploadDirectory, change.name))}`);
    options.log(plan.sql);
    options.log("Sin escrituras ni SQL aplicado. El enlace se comprueba en la sincronización completa.");
    return;
  }
  const lock = join(root, "prisma/.orm-sync.lock");
  await assertNoSymlinks(lock);
  const handle = await open(lock, "wx").catch(error => { throw new Error((error as NodeJS.ErrnoException).code === "EEXIST" ? "Ya hay una sincronización abierta. Si se interrumpió, verifica que terminó antes de retirar prisma/.orm-sync.lock." : "No se pudo reservar la sincronización."); });
  let step = "Inicio", databaseUrl = "";
  const stage = (name: string) => { step = name; options.log(`\n→ ${name}`); };
  const redact = (text: string) => databaseUrl ? text.replaceAll(databaseUrl, "[database]") : text;
  const run = (args: string[], codes = [0], cli = "prisma/build/index.js") => {
    const result = spawnSync(process.execPath, [join(root, "node_modules", cli), ...args], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 120000 });
    if (result.stdout) options.log(redact(result.stdout.trimEnd()));
    if (result.stderr) options.log(redact(result.stderr.trimEnd()));
    if (result.error) throw result.error;
    if (result.signal || result.status === null || !codes.includes(result.status)) throw new Error(`El comando terminó con ${result.signal ?? result.status}. No se ejecutarán los pasos siguientes.`);
    return result.status;
  };
  const prisma = (args: string[], codes?: number[]) => run([...args, "--config", join(root, "prisma7.config.ts")], codes);
  const generate = async () => {
    const files = await prepareModuleArtifacts(root, profile.module, profile.externalOwners);
    const directory = join(root, "src/generated/orm/apps", id);
    const uploadDirectory = join(root, "src/generated/orm/uploads", id);
    const uploads = imageUploadFiles(profile.module);
    await artifactPlan(directory, id, files);
    await artifactPlan(uploadDirectory, `uploads-${id}`, uploads);
    await writeArtifacts(directory, id, files);
    await writeArtifacts(uploadDirectory, `uploads-${id}`, uploads);
  };
  const pending = async () => pendingMigrations(await migrationFiles(root), await readApplied(databaseUrl));
  const applyPending = async () => {
    const files = await pending();
    if (!files.length) return;
    stage("Revisar migraciones pendientes del proyecto");
    for (const file of files) { options.log(`\n${file.name}/migration.sql\n${file.sql}`); assertSyncSQL(file.sql, file.name); }
    if (!await options.confirm(`¿Aplicar estas ${files.length} migraciones a la base de desarrollo indicada? Escribe aplicar`)) throw new Error("Cancelado: las migraciones mostradas no se aplicaron. Los archivos preparados se conservan.");
    if (JSON.stringify(await pending()) !== JSON.stringify(files)) throw new Error("Las migraciones cambiaron durante la revisión. Vuelve a ejecutar orm:sync.");
    stage("Aplicar SQL aprobado");
    prisma(["migrate", "deploy"]);
  };
  try {
    // Use the same trusted configuration as all the existing Prisma commands.
    const configuration = (await import(pathToFileURL(join(root, "prisma7.config.ts")).href)).default;
    databaseUrl = configuration.datasource?.url;
    if (typeof databaseUrl !== "string" || !databaseUrl) throw new Error("La configuración no contiene una URL de base de datos.");
    const target = new URL(databaseUrl);
    options.log(`Base de desarrollo: ${target.hostname}:${target.port || "5432"}${target.pathname}, schema=${target.searchParams.get("schema") || "public"}`);
    stage("Generar contratos y validar propuesta");
    await generate();
    stage("Incorporar esquema (instalación o actualización aditiva)");
    const installation = await installModels(root, profile, true, true);
    for (const change of installation.changes) options.log(relative(root, change.path));
    // migrate dev --create-only can apply older pending migrations: review them first.
    await applyPending();
    stage("Comparar base de datos con el esquema");
    if (prisma(["migrate", "diff", "--from-config-datasource", "--to-schema", join(root, "prisma/models"), "--exit-code"], [0, 2]) === 2) {
      stage("Preparar nueva migración sin aplicar");
      // Closed stdin: Prisma must fail rather than accept a reset or a data-loss prompt.
      prisma(["migrate", "dev", "--name", options.name ?? `sync_${id.replaceAll("-", "_")}`, "--create-only"]);
      if (!(await pending()).length) throw new Error("No se creó una migración pendiente. Revisa el estado manualmente.");
      await applyPending();
    }
    stage("Verificar esquema aplicado");
    prisma(["migrate", "diff", "--from-config-datasource", "--to-schema", join(root, "prisma/models"), "--exit-code"]);
    stage("Generar Prisma Client");
    prisma(["generate"]);
    stage("Sincronizar contratos y compilar adaptadores");
    await generate();
    await bindRepositories(root, profile, true);
    stage("Comprobar TypeScript");
    run(["--noEmit"], [0], "typescript/bin/tsc");
    options.log(`\n✓ ${id} sincronizada. Revisa los cambios en Git y reinicia dev si estaba abierto.`);
  } catch (error) {
    throw new Error(redact(`Detenido en «${step}»: ${error instanceof Error ? error.message : "Error desconocido"}\nCorrige el problema y repite npm run orm:sync -- ${id}. Los pasos completados no se revierten automáticamente.`));
  } finally {
    await handle.close();
    await rm(lock, { force: true });
  }
}
