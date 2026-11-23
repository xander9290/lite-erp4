import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { access, cp, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { watch } from "node:fs";
import { parse } from "dotenv";
import { Client } from "pg";

// Disposable project + PostgreSQL schema for declarative modules. Never touches the ERP data.
const project = process.cwd();
const variables = parse(await readFile(join(project, ".env.local")));
const connection = process.env.DATABASE_URL ?? variables.DATABASE_URL;
if (!connection) throw new Error("Configura DATABASE_URL para la prueba aislada.");
const schema = `modules_test_${randomBytes(8).toString("hex")}`;
const url = new URL(connection); url.searchParams.set("schema", schema);
const root = await mkdtemp(join(project, ".modules-test-"));
const database = new Client({ connectionString: connection });
let created = false;
const sanitize = (text: string) => text.replaceAll(url.toString(), "[test database]").replaceAll(connection, "[database]");
function command(binary: string, args: string[], name: string, expected = 0) {
  const cli = { prisma: "prisma/build/index.js", tsc: "typescript/bin/tsc", next: "next/dist/bin/next" };
  const executable = Object.entries(cli).find(([name]) => binary === name);
  if (executable) { args = [join(root, "node_modules", executable[1]), ...args]; binary = process.execPath; }
  const result = spawnSync(binary, args, { cwd: root, env: { ...process.env, DATABASE_URL: url.toString() }, encoding: "utf8", timeout: name === "module lifecycle operations" ? 900000 : name === "extension service check" ? 600000 : 180000 });
  if (result.error) throw result.error;
  assert.equal(result.status, expected, sanitize(`${name}: ${result.stderr}\n${result.stdout}`));
  return result.stdout;
}
const tsx = (file: string, args: string[] = [], name = file) => command(process.execPath, ["--conditions=react-server", "--import", "tsx", file, ...args], name);
const prisma = (args: string[]) => command("prisma", [...args, "--config", join(root, "prisma7.config.ts")], `prisma ${args[0]}`);
const exists = (path: string) => access(path).then(() => true, () => false);
/**
 * Hand-written applications (e.g. Contactos) may depend on declarative modules of the
 * project (e.g. ubicaciones). Modes that replace src/modules/index.ts and render ERP pages
 * keep those modules registered; otherwise every page fails with an unregistered dependency.
 * Their tables already exist: the temporary schema deploys every project migration.
 */
async function applicationModules() {
  const { readdir } = await import("node:fs/promises");
  const dependsOf = async (file: string) => {
    const text = await readFile(file, "utf8").catch(() => "");
    const list = /\bdepends:\s*\[([^\]]*)\]/.exec(text)?.[1] ?? "";
    return [...list.matchAll(/"([a-z][a-z0-9_-]*)"/g)].map(match => match[1]);
  };
  const required = new Set<string>();
  const visit = async (id: string) => {
    if (required.has(id) || !await exists(join(project, "src/modules", id, "manifest.ts"))) return;
    required.add(id);
    for (const next of await dependsOf(join(project, "src/modules", id, "manifest.ts"))) await visit(next);
  };
  const erp = join(project, "src/app/(auth)/erp");
  for (const entry of await readdir(erp, { withFileTypes: true })) if (entry.isDirectory()) for (const id of await dependsOf(join(erp, entry.name, "manifest.ts"))) await visit(id);
  return [...required];
}
/** Module index of a rendering mode: fixture modules plus the application dependencies. */
async function renderIndex(ids: readonly string[]) {
  const all = [...new Set([...await applicationModules(), ...ids])];
  const name = (id: string) => `module_${id.replace(/[^a-z0-9]/g, "_")}`;
  const lines = [`import "server-only";`, `import type { ModuleDefinition } from "@/lib/modules/define";`, ...all.map(id => `import ${name(id)} from "./${id}/manifest";`), `export const modules: readonly ModuleDefinition[] = [${all.map(name).join(", ")}];`, ""];
  await writeFile(join(root, "src/modules/index.ts"), lines.join("\n"));
}

try {
  await database.connect();
  await database.query(`CREATE SCHEMA "${schema}"`); created = true;
  for (const directory of ["src", "scripts", "public", "docs", "prisma/models", "prisma/migrations"]) await cp(join(project, directory), join(root, directory), { recursive: true });
  for (const file of ["package.json", "package-lock.json", "tsconfig.json", "next-env.d.ts", "prisma7.config.ts", "prisma/.orm-installations.json", ".gitignore"]) await cp(join(project, file), join(root, file));
  await symlink(join(project, "node_modules"), join(root, "node_modules"), process.platform === "win32" ? "junction" : "dir");
  await writeFile(join(root, ".env.local"), `DATABASE_URL=${JSON.stringify(url.toString())}\nAUTH_SECRET=${randomBytes(32).toString("hex")}\nAUTH_TRUST_HOST=true\nAUTH_URL=http://127.0.0.1:3032\n`, { mode: 0o600 });
  const authPath = join(root, "src/auth.config.ts");
  const fixtureCookies = Object.fromEntries(["sessionToken", "csrfToken", "callbackUrl"].map(name => [name, { name: `${schema}.${name}`, options: { httpOnly: true, sameSite: "lax", path: "/", secure: false } }]));
  const auth = await readFile(authPath, "utf8");
  assert.ok(auth.includes("providers: [],"));
  await writeFile(authPath, auth.replace("providers: [],", `providers: [],\n  cookies: ${JSON.stringify(fixtureCookies)},`));
  const next = await readFile(join(project, "next.config.ts"), "utf8");
  // Tailwind must scan this fixture's application sources, not generated test projects,
  // operation backups or dependency junctions while Next is writing its build output.
  await writeFile(join(root, "next.config.ts"), next.replace("turbopack: {", `turbopack: {\n    root: ${JSON.stringify(project)},`)
    .replace('"@tailwindcss/turbopack"', `{ loader: "@tailwindcss/turbopack", options: { base: ${JSON.stringify(join(root, "src"))} } }`));
  prisma(["migrate", "deploy"]);

  if (process.argv.includes("--transfer-only")) {
    const target = join(root, "src/modules/transferencia");
    await mkdir(target, { recursive: true });
    await cp(join(project, "scripts/fixtures/modules-transfer/manifest.fixture"), join(target, "manifest.ts"));
    tsx(join(root, "scripts/orm-install.ts"), ["transferencia", "--write"], "orm:install transfer fixture");
    const sql = command("prisma", ["migrate", "diff", "--from-config-datasource", "--to-schema", join(root, "prisma/models"), "--script", "--config", join(root, "prisma7.config.ts")], "transfer migration diff");
    assert.match(sql, /CREATE TABLE "transferencia_documento"/);
    assert.doesNotMatch(sql, /\bDROP\s+(TABLE|COLUMN|TYPE)\b|\bTRUNCATE\b/i);
    await mkdir(join(root, "prisma/migrations/20990208000000_transfer"));
    await writeFile(join(root, "prisma/migrations/20990208000000_transfer/migration.sql"), sql);
    prisma(["migrate", "deploy"]); prisma(["generate"]);
    await renderIndex(["transferencia"]);
    await cp(join(project, "scripts/fixtures/transfer-check.fixture"), join(root, "transfer-check.ts"));
    console.log(tsx(join(root, "transfer-check.ts"), [], "transfer service check").trim());
    command("next", ["typegen"], "Next route types");
    command("tsc", ["--noEmit", "--incremental", "false"], "transfer fixture types");
  } else if (process.argv.includes("--domains-only")) {
    const target = join(root, "src/modules/dominios");
    await mkdir(target, { recursive: true });
    await cp(join(project, "scripts/fixtures/modules-domains/manifest.fixture"), join(target, "manifest.ts"));
    tsx(join(root, "scripts/orm-install.ts"), ["dominios", "--write"], "orm:install domains fixture");
    const sql = command("prisma", ["migrate", "diff", "--from-config-datasource", "--to-schema", join(root, "prisma/models"), "--script", "--config", join(root, "prisma7.config.ts")], "domains migration diff");
    assert.doesNotMatch(sql, /\bDROP\s+(TABLE|COLUMN|TYPE)\b|\bTRUNCATE\b/i);
    await mkdir(join(root, "prisma/migrations/20990207000000_domains"));
    await writeFile(join(root, "prisma/migrations/20990207000000_domains/migration.sql"), sql);
    prisma(["migrate", "deploy"]); prisma(["generate"]);
    await writeFile(join(root, "src/modules/index.ts"), `import "server-only";\nimport dominios from "./dominios/manifest";\nexport const modules = [dominios];\n`);
    await cp(join(project, "scripts/fixtures/domains-check.fixture"), join(root, "domains-check.ts"));
    console.log(tsx(join(root, "domains-check.ts"), [], "domain service check").trim());
    command("next", ["typegen"], "Next route types");
    command("tsc", ["--noEmit", "--incremental", "false"], "domains fixture types");
  } else if (process.argv.includes("--parameters-only")) {
    const target = join(root, "src/modules/parametros");
    await mkdir(join(target, "models"), { recursive: true });
    await cp(join(project, "scripts/fixtures/modules-parameters/models.fixture"), join(target, "models/ticket.ts"));
    await cp(join(project, "scripts/fixtures/modules-parameters/manifest.fixture"), join(target, "manifest.ts"));
    tsx(join(root, "scripts/orm-install.ts"), ["parametros", "--write"], "orm:install parameter fixture");
    const sql = command("prisma", ["migrate", "diff", "--from-config-datasource", "--to-schema", join(root, "prisma/models"), "--script", "--config", join(root, "prisma7.config.ts")], "parameter migration diff");
    assert.doesNotMatch(sql, /\bDROP\s+(TABLE|COLUMN|TYPE)\b|\bTRUNCATE\b/i);
    await mkdir(join(root, "prisma/migrations/20990206000000_parameters"));
    await writeFile(join(root, "prisma/migrations/20990206000000_parameters/migration.sql"), sql);
    prisma(["migrate", "deploy"]); prisma(["generate"]);
    await writeFile(join(root, "src/modules/index.ts"), `import "server-only";\nimport parametros from "./parametros/manifest";\nexport const modules = [parametros];\n`);
    tsx(join(root, "scripts/orm-generate.ts"), ["parametros", "--actions-only", "--write"], "typed parameter action contracts");
    await cp(join(project, "scripts/fixtures/action-parameters-check.fixture"), join(root, "action-parameters-check.ts"));
    console.log(tsx(join(root, "action-parameters-check.ts"), [], "action parameter service check").trim());
    command("next", ["typegen"], "Next route types");
    command("tsc", ["--noEmit", "--incremental", "false"], "parameter fixture types");
  } else if (process.argv.includes("--sequences-only")) {
    const target = join(root, "src/modules/series");
    await mkdir(join(target, "models"), { recursive: true });
    await cp(join(project, "scripts/fixtures/modules-sequence/models.fixture"), join(target, "models/ticket.ts"));
    await cp(join(project, "scripts/fixtures/modules-sequence/manifest.fixture"), join(target, "manifest.ts"));
    tsx(join(root, "scripts/orm-install.ts"), ["series", "--write"], "orm:install sequence fixture");
    const sql = command("prisma", ["migrate", "diff", "--from-config-datasource", "--to-schema", join(root, "prisma/models"), "--script", "--config", join(root, "prisma7.config.ts")], "sequence migration diff");
    assert.match(sql, /CREATE UNIQUE INDEX "series_ticket_name_key"/);
    assert.doesNotMatch(sql, /\bDROP\s+(TABLE|COLUMN|TYPE)\b|\bTRUNCATE\b/i);
    await mkdir(join(root, "prisma/migrations/20990205000000_sequences"));
    await writeFile(join(root, "prisma/migrations/20990205000000_sequences/migration.sql"), sql);
    prisma(["migrate", "deploy"]); prisma(["generate"]);
    await writeFile(join(root, "src/modules/index.ts"), `import "server-only";\nimport series from "./series/manifest";\nexport const modules = [series];\n`);
    await cp(join(project, "scripts/fixtures/sequence-check.fixture"), join(root, "sequence-check.ts"));
    console.log(tsx(join(root, "sequence-check.ts"), [], "sequence service check").trim());
    tsx(join(root, "scripts/eject-view.ts"), ["series", "ticket", "form"], "eject sequence form");
    command("next", ["typegen"], "Next route types");
    command("tsc", ["--noEmit", "--incremental", "false"], "sequence fixture types");
  } else if (process.argv.includes("--many2many-only")) {
    const target = join(root, "src/modules/vinculos");
    await mkdir(join(target, "models"), { recursive: true });
    await cp(join(project, "scripts/fixtures/modules-many2many/models.fixture"), join(target, "models/ticket.ts"));
    await cp(join(project, "scripts/fixtures/modules-many2many/manifest.fixture"), join(target, "manifest.ts"));
    tsx(join(root, "scripts/orm-install.ts"), ["vinculos", "--write"], "orm:install Many2many fixture");
    const sql = command("prisma", ["migrate", "diff", "--from-config-datasource", "--to-schema", join(root, "prisma/models"), "--script", "--config", join(root, "prisma7.config.ts")], "Many2many migration diff");
    assert.match(sql, /CREATE TABLE "vinculos_ticket_etiquetas_rel"/);
    assert.doesNotMatch(sql, /\bDROP\s+(TABLE|COLUMN|TYPE)\b|\bTRUNCATE\b/i);
    await mkdir(join(root, "prisma/migrations/20990204000000_many2many"));
    await writeFile(join(root, "prisma/migrations/20990204000000_many2many/migration.sql"), sql);
    prisma(["migrate", "deploy"]); prisma(["generate"]);
    await writeFile(join(root, "src/modules/index.ts"), `import "server-only";\nimport vinculos from "./vinculos/manifest";\nexport const modules = [vinculos];\n`);
    await cp(join(project, "scripts/fixtures/many2many-check.fixture"), join(root, "many2many-check.ts"));
    console.log(tsx(join(root, "many2many-check.ts"), [], "Many2many service check").trim());
    tsx(join(root, "scripts/eject-view.ts"), ["vinculos", "ticket", "form"], "eject Many2many form");
    assert.match(await readFile(join(target, "views/TicketForm.tsx"), "utf8"), /FieldRelationTag<Values> name="etiquetas"/);
    command("next", ["typegen"], "Next route types");
    command("tsc", ["--noEmit", "--incremental", "false"], "Many2many fixture types");
  } else if (process.argv.includes("--one2many-only")) {
    const target = join(root, "src/modules/lineas");
    await mkdir(target, { recursive: true });
    await cp(join(project, "scripts/fixtures/modules-lineas/manifest.fixture"), join(target, "manifest.ts"));
    tsx(join(root, "scripts/orm-install.ts"), ["lineas", "--write"], "orm:install lines fixture");
    const sql = command("prisma", ["migrate", "diff", "--from-config-datasource", "--to-schema", join(root, "prisma/models"), "--script", "--config", join(root, "prisma7.config.ts")], "lines migration diff");
    assert.match(sql, /CREATE TABLE "lineas_detalle"/);
    assert.doesNotMatch(sql, /\bDROP\s+(TABLE|COLUMN|TYPE)\b|\bTRUNCATE\b/i);
    await mkdir(join(root, "prisma/migrations/20990202000000_lines"));
    await writeFile(join(root, "prisma/migrations/20990202000000_lines/migration.sql"), sql);
    prisma(["migrate", "deploy"]); prisma(["generate"]);
    await writeFile(join(root, "src/modules/index.ts"), `import "server-only";\nimport lineas from "./lineas/manifest";\nexport const modules = [lineas];\n`);
    await cp(join(project, "scripts/fixtures/one2many-check.fixture"), join(root, "one2many-check.ts"));
    console.log(tsx(join(root, "one2many-check.ts"), [], "One2many service check").trim());
    command("next", ["typegen"], "Next route types");
    command("tsc", ["--noEmit", "--incremental", "false"], "One2many fixture types");
  } else if (process.argv.includes("--nested-only")) {
    // Nested One2many (document → line → sub-line) on an independent fixture module.
    const target = join(root, "src/modules/anidados");
    await mkdir(target, { recursive: true });
    await cp(join(project, "scripts/fixtures/modules-anidados/manifest.fixture"), join(target, "manifest.ts"));
    tsx(join(root, "scripts/orm-install.ts"), ["anidados", "--write"], "orm:install nested fixture");
    const sql = command("prisma", ["migrate", "diff", "--from-config-datasource", "--to-schema", join(root, "prisma/models"), "--script", "--config", join(root, "prisma7.config.ts")], "nested migration diff");
    assert.match(sql, /CREATE TABLE "anidados_entrega"/);
    assert.doesNotMatch(sql, /\bDROP\s+(TABLE|COLUMN|TYPE)\b|\bTRUNCATE\b/i);
    await mkdir(join(root, "prisma/migrations/20990205000000_nested"));
    await writeFile(join(root, "prisma/migrations/20990205000000_nested/migration.sql"), sql);
    prisma(["migrate", "deploy"]); prisma(["generate"]);
    await writeFile(join(root, "src/modules/index.ts"), `import "server-only";\nimport type { ModuleDefinition } from "@/lib/modules/define";\nimport anidados from "./anidados/manifest";\nexport const modules: readonly ModuleDefinition[] = [anidados];\n`);
    command("next", ["typegen"], "Next route types");
    command("tsc", ["--noEmit", "--incremental", "false"], "nested fixture types");
    await cp(join(project, "scripts/fixtures/anidados-check.fixture"), join(root, "anidados-check.ts"));
    console.log(tsx(join(root, "anidados-check.ts"), [], "nested lines check").trim());
  } else if (process.argv.includes("--core-only")) {
    // Only User is native; modules may relate to and extend it.
    const fixture = join(project, "scripts/fixtures/modules-core");
    for (const id of ["ventas", "crm"]) {
      await mkdir(join(root, "src/modules", id), { recursive: true });
      await cp(join(fixture, `${id}.manifest.fixture`), join(root, "src/modules", id, "manifest.ts"));
      tsx(join(root, "scripts/orm-install.ts"), [id, "--write"], `orm:install ${id}`);
    }
    const sql = command("prisma", ["migrate", "diff", "--from-config-datasource", "--to-schema", join(root, "prisma/models"), "--script", "--config", join(root, "prisma7.config.ts")], "core migration diff");
    assert.match(sql, /CREATE TABLE "ventas_cliente"/);
    assert.match(sql, /CREATE TABLE "crm_core_user"/);
    assert.match(sql, /REFERENCES "users"\("id"\) ON DELETE CASCADE/);
    assert.doesNotMatch(sql, /ALTER TABLE "partners"|ALTER TABLE "users"|\bDROP\b|\bTRUNCATE\b/i);
    await mkdir(join(root, "prisma/migrations/20990204000000_core_fixture"));
    await writeFile(join(root, "prisma/migrations/20990204000000_core_fixture/migration.sql"), sql);
    prisma(["migrate", "deploy"]); prisma(["generate"]);
    await writeFile(join(root, "src/modules/index.ts"), `import "server-only";\nimport type { ModuleDefinition } from "@/lib/modules/define";\nimport ventas from "./ventas/manifest";\nimport crm from "./crm/manifest";\nexport const modules: readonly ModuleDefinition[] = [ventas, crm];\n`);
    console.log("✓ Módulos sobre core instalados: sólo tablas propias; users sin ALTER y con inversas marcadas.");
    command("next", ["typegen"], "Next route types");
    command("tsc", ["--noEmit", "--incremental", "false"], "core fixture types");
    await cp(join(project, "scripts/fixtures/core-check.fixture"), join(root, "core-check.ts"));
    console.log(tsx(join(root, "core-check.ts"), [], "core service check").trim());
  } else if (process.argv.includes("--extensions-only")) {
    // Model inheritance: soporte extends taller.equipo through a companion table it owns.
    const fixture = join(project, "scripts/fixtures/modules-extension");
    const migrate = async (name: string) => {
      const sql = command("prisma", ["migrate", "diff", "--from-config-datasource", "--to-schema", join(root, "prisma/models"), "--script", "--config", join(root, "prisma7.config.ts")], `${name} migration diff`);
      assert.doesNotMatch(sql, /\bDROP\s+(TABLE|COLUMN|TYPE)\b|\bTRUNCATE\b/i);
      await mkdir(join(root, "prisma/migrations", name));
      await writeFile(join(root, "prisma/migrations", name, "migration.sql"), sql);
      prisma(["migrate", "deploy"]); prisma(["generate"]);
      return sql;
    };
    const index = (ids: string[]) => renderIndex(ids);
    await mkdir(join(root, "src/modules/taller/models"), { recursive: true });
    await cp(join(fixture, "taller.manifest.fixture"), join(root, "src/modules/taller/manifest.ts"));
    await cp(join(fixture, "equipo.fixture"), join(root, "src/modules/taller/models/equipo.ts"));
    tsx(join(root, "scripts/orm-install.ts"), ["taller", "--write"], "orm:install taller");
    assert.match(await migrate("20990203000000_taller"), /CREATE TABLE "taller_equipo"/);
    await index(["taller"]);
    await writeFile(join(root, "seed-legacy.ts"), `import { config } from "dotenv"; config({ path: ".env.local", quiet: true });\nconst { prisma } = await import("./src/lib/prisma");\nconst row = await prisma.tallerEquipo.create({ data: { name: "PREVIO" } });\nconsole.log(row.id);\nawait prisma.$disconnect();\n`);
    const legacy = tsx(join(root, "seed-legacy.ts"), [], "record before the extension").trim();
    await mkdir(join(root, "src/modules/soporte/models"), { recursive: true });
    await cp(join(fixture, "soporte.manifest.fixture"), join(root, "src/modules/soporte/manifest.ts"));
    await cp(join(fixture, "equipo-soporte.fixture"), join(root, "src/modules/soporte/models/equipo.ts"));
    await cp(join(fixture, "marca.fixture"), join(root, "src/modules/soporte/models/marca.ts"));
    await mkdir(join(root, "src/modules/soporte/views"), { recursive: true });
    await cp(join(fixture, "equipo-form.fixture"), join(root, "src/modules/soporte/views/EquipoSoporte.tsx"));
    const baseSchema = await readFile(join(root, "prisma/models/orm-taller.prisma"), "utf8");
    tsx(join(root, "scripts/orm-install.ts"), ["soporte", "--write"], "orm:install soporte");
    const extended = await readFile(join(root, "prisma/models/orm-taller.prisma"), "utf8");
    assert.match(extended, /BEGIN lite-erp:soporte:TallerEquipo[\s\S]*soporteTallerEquipoRecordIdRecords SoporteTallerEquipo\?/);
    assert.equal(extended.replace(/\n  \/\/ BEGIN lite-erp:soporte:TallerEquipo[\s\S]*?\/\/ END lite-erp:soporte:TallerEquipo\n/, ""), baseSchema, "el esquema del base sólo recibe la inversa propiedad de la extensión");
    const sql = await migrate("20990203000001_soporte");
    assert.match(sql, /CREATE TABLE "soporte_taller_equipo"/);
    assert.match(sql, /CREATE UNIQUE INDEX "soporte_taller_equipo_record_id_key"/);
    assert.match(sql, /REFERENCES "taller_equipo"\("id"\) ON DELETE CASCADE/);
    assert.doesNotMatch(sql, /ALTER TABLE "taller_equipo"/);
    // Many2many of the extension: link table owned by soporte, hanging from the companion row.
    assert.match(sql, /CREATE TABLE "soporte_taller_equipo_marcas_rel"/);
    assert.ok(sql.includes('"soporte_taller_equipo_marcas_rel_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "soporte_taller_equipo"("id") ON DELETE CASCADE'), sql);
    assert.ok(sql.includes('"soporte_taller_equipo_marcas_rel_target_id_fkey" FOREIGN KEY ("target_id") REFERENCES "soporte_marca"("id") ON DELETE RESTRICT'), sql);
    await index(["taller", "soporte"]);
    console.log("✓ Extensión instalada: tabla compañera 1:1 con Cascade; el esquema del base sólo recibe la inversa de la extensión.");
    command("next", ["typegen"], "Next route types");
    command("tsc", ["--noEmit", "--incremental", "false"], "extension fixture types");
    console.log("✓ El mixin con decoradores y super compila con TypeScript.");
    await cp(join(project, "scripts/fixtures/extension-check.fixture"), join(root, "extension-check.ts"));
    await cp(join(project, "scripts/fixtures/extension-render.fixture"), join(root, "extension-render.ts"));
    console.log(tsx(join(root, "extension-check.ts"), [legacy], "extension service check").trim());
  } else {
  // Exercise the public creation commands and automatic sync registration on an
  // independent module; no tutorial sources or ERP data are modified.
  const indexBefore = await readFile(join(root, "src/modules/index.ts"), "utf8");
  tsx(join(root, "scripts/create-module.ts"), ["andamio", "--dry-run"]);
  assert.equal(await exists(join(root, "src/modules/andamio")), false);
  assert.equal(await readFile(join(root, "src/modules/index.ts"), "utf8"), indexBefore);
  tsx(join(root, "scripts/create-module.ts"), ["andamio"]);
  tsx(join(root, "scripts/create-model.ts"), ["andamio", "Categoria", "--dry-run"]);
  assert.equal(await exists(join(root, "src/modules/andamio/models/categoria.ts")), false);
  tsx(join(root, "scripts/create-model.ts"), ["andamio", "Categoria"]);
  command("next", ["typegen"], "Next route types before sync");
  await cp(join(project, "scripts/fixtures/module-scaffold-check.fixture"), join(root, "module-scaffold-check.ts"));
  tsx(join(root, "module-scaffold-check.ts"), [], "module scaffold, sync registration and persistence");
  console.log("✓ create:module → create:model → orm:sync: dry-run, registro automático/idempotente, SQL aprobado sólo en fixture y guardado/reapertura.");

  // Own fixture module, independent of demo/tutorial modules in the repository.
  const fixture = join(project, "scripts/fixtures/modules-ensayo"), target = join(root, "src/modules/ensayo");
  await mkdir(join(target, "models"), { recursive: true }); await mkdir(join(target, "views"), { recursive: true });
  for (const [from, to] of [["manifest", "manifest.ts"], ["tarea", "models/tarea.ts"], ["categoria", "models/categoria.ts"], ["TareaForm", "views/TareaForm.tsx"], ["TareaList", "views/TareaList.tsx"]]) await cp(join(fixture, `${from}.fixture`), join(target, to));
  // Install only the schema: declarative modules need no generated contracts or bindings.
  tsx(join(root, "scripts/orm-install.ts"), ["ensayo", "--write"], "orm:install ensayo");
  const sql = command("prisma", ["migrate", "diff", "--from-config-datasource", "--to-schema", join(root, "prisma/models"), "--script", "--config", join(root, "prisma7.config.ts")], "migration diff");
  assert.match(sql, /CREATE TABLE "ensayo_tarea"/);
  assert.doesNotMatch(sql, /\bDROP\s+(TABLE|COLUMN|TYPE)\b|\bTRUNCATE\b/i);
  await mkdir(join(root, "prisma/migrations/20990201000000_ensayo_module"));
  await writeFile(join(root, "prisma/migrations/20990201000000_ensayo_module/migration.sql"), sql);
  prisma(["migrate", "deploy"]); prisma(["generate"]);
  for (const generated of ["src/generated/orm/apps/ensayo", "src/generated/orm/bindings/ensayo", "src/generated/orm/uploads/ensayo"]) assert.equal(await exists(join(root, generated)), false, `${generated} no debe generarse`);
  await renderIndex(["ensayo"]);
  console.log("✓ Módulo ensayo instalado: sólo esquema y migración; sin contratos, bindings ni uploads generados.");

  await cp(join(project, "scripts/fixtures/modules-check.fixture"), join(root, "modules-check.ts"));
  await mkdir(join(root, "src/modules/disponible"));
  await writeFile(join(root, "src/modules/disponible/manifest.ts"), `import "server-only";\nimport { Fields, Model } from "@/lib/orm";\nimport { defineModule } from "@/lib/modules/define";\nclass Item extends Model { name = Fields.Text({required:true}); }\nexport default defineModule({id:"disponible",name:"Disponible",icon:"boxes",models:{item:Item}});\n`);
  tsx(join(root, "modules-check.ts"), [], "modules check");
  await cp(join(project, "scripts/fixtures/capabilities-check.fixture"), join(root, "capabilities-check.ts"));
  tsx(join(root, "capabilities-check.ts"), [], "capabilities check");
  console.log("✓ Capacidades por actor: overrides/herencia, menús, acciones/grafo, sesión y rechazos de escrituras falsificadas.");
  if (!process.argv.includes("--capabilities-only")) {
  await cp(join(project, "scripts/fixtures/module-operations-check.fixture"), join(root, "module-operations-check.ts"));
  tsx(join(root, "module-operations-check.ts"), process.argv.includes("--legacy-only") ? ["--legacy-only"] : [], "module lifecycle operations");
  console.log(process.argv.includes("--legacy-only") ? "✓ Adaptador de scaffold: instalar, retirar y reactivar conservando registros." : "✓ Ciclo de módulos: instalar, actualizar, conservar/restaurar datos, purgar con respaldo restaurado, planes obsoletos, recuperación previa a cambios y scaffold anterior.");
  } else console.log("✓ Alcance focalizado: servicios/capacidades; no ejecuta ciclo de instalación/retirada con respaldos.");
  console.log("✓ Gestor de módulos: instalado, disponible sin registrar, fuera de catálogo, permisos admin y sesión revocada; lecturas del esquema temporal.");
  console.log("✓ Repositorio genérico y servicio: crear, normalize, beforeSave, revisión, listas, búsqueda, filtros, agrupación con etiquetas, lookup, kanban, historial, notas y borrado.");
  console.log("✓ Control de accesos: grupos implicados, CRUD por modelo, reglas de registro (AND/OR), overrides y reglas desactivadas en BD, superusuario y administración.");
  console.log("✓ Acciones @action: sólo nombres publicados, permisos/reglas/grupos, revisión, transición, hooks con rollback, historial y resultado canónico.");
  console.log("✓ Relaciones con reglas del destino: related y etiquetas Many2one vacíos si el actor no puede leer el registro; el ID se conserva.");
  console.log("✓ Kanban por acciones: grafo fijo, sesión/reglas/grupos, origen/revisión, historial único y rollback de destino incorrecto tras hooks.");

  command("next", ["typegen"], "Next route types");
  command("tsc", ["--noEmit", "--incremental", "false"], "typecheck with modules and ejected views");
  console.log("✓ Ruta comodín, módulos registrados y vistas expulsadas compilan con TypeScript.");

  if (process.argv.includes("--serve")) {
    const credentials = randomBytes(9).toString("base64url");
    // Disposable admin in the temporary schema only, for manual review of the default views.
    await writeFile(join(root, "serve-admin.ts"), `import { config } from "dotenv"; config({ path: ".env.local", quiet: true });\nconst { prisma } = await import("./src/lib/prisma");\nconst { hashPassword } = await import("./src/lib/auth/password");\nawait prisma.user.create({ data: { login: "serve-admin", password: await hashPassword(process.argv[2]), isAdmin: true, name: "Revisión visual" } });\nawait prisma.$disconnect();\n`);
    tsx(join(root, "serve-admin.ts"), [credentials], "serve admin");
    await writeFile(join(root, ".serve-login"), `usuario: serve-admin\ncontraseña: ${credentials}\n`, { mode: 0o600 });
    const launch = () => spawn(process.execPath, [join(root, "node_modules/next/dist/bin/next"), "dev", "-p", "3032", "-H", "127.0.0.1"], { cwd: root, stdio: ["ignore", "pipe", "pipe"] });
    let server = launch();
    console.log(`Revisión visual: http://127.0.0.1:3032/erp/ensayo (credenciales desechables en ${join(root, ".serve-login")}; se eliminan al detener).`);
    await new Promise<void>((resolve, reject) => {
      let stopping = false, output = "", retriedReminder = false;
      const stop = () => { stopping = true; server.kill("SIGTERM"); };
      const watcher = watch(root, (_event, filename) => { if (filename === ".stop") stop(); });
      const cleanup = () => { watcher.close(); process.off("SIGINT", stop); process.off("SIGTERM", stop); };
      process.once("SIGINT", stop); process.once("SIGTERM", stop);
      const observe = () => {
        const capture = (chunk: Buffer) => { output = (output + chunk.toString()).slice(-6000); };
        server.stdout?.on("data", capture); server.stderr?.on("data", capture);
        server.once("error", error => { cleanup(); reject(error); });
        server.once("exit", code => {
          // Repeat the same command once for Next's one-time reminder. No flags or dependencies change.
          if (!stopping && code !== 0 && !retriedReminder && output.includes("Your version of Next.js is affected by a known security vulnerability.") && output.includes("Retry the same command")) {
            retriedReminder = true; output = "";
            console.log("Aviso de seguridad de Next.js: se recomienda actualizar la versión; se repite el arranque temporal una sola vez sin cambiar dependencias.");
            server = launch(); observe(); return;
          }
          cleanup();
          if (!stopping && code !== 0) reject(new Error(sanitize(`El servidor de revisión terminó con código ${code}: ${output}`)));
          else resolve();
        });
      };
      observe();
    });
  }
  }
} finally {
  if (created) await database.query(`DROP SCHEMA "${schema}" CASCADE`);
  await database.end();
  // A running `next dev` may watch and briefly lock the folder on Windows: retry, and never hide the test's own error.
  await rm(root, { recursive: true, force: true, maxRetries: 20, retryDelay: 500 }).catch(error => {
    console.error(`No se pudo eliminar ${root} (${(error as NodeJS.ErrnoException).code}); bórralo manualmente. El esquema temporal sí se eliminó.`);
  });
}
console.log("✓ Proyecto y esquema temporales eliminados. Los datos del ERP permanecen intactos.");
