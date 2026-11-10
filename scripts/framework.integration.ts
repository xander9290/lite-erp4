import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { cp, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { watch } from "node:fs";
import { parse } from "dotenv";
import { Client } from "pg";

// A complete disposable project + PostgreSQL schema. Never seed/reset the ERP database.
const project = process.cwd();
const variables = parse(await readFile(join(project, ".env.local")));
const connection = process.env.DATABASE_URL ?? variables.DATABASE_URL;
if (!connection) throw new Error("Configura DATABASE_URL para la prueba aislada.");
const schema = `framework_test_${randomBytes(8).toString("hex")}`;
const url = new URL(connection); url.searchParams.set("schema", schema);
const root = await mkdtemp(join(project, ".framework-test-"));
const database = new Client({ connectionString: connection });
let created = false;
const sanitize = (text: string) => text.replaceAll(url.toString(), "[test database]").replaceAll(connection, "[database]");
function command(binary: string, args: string[], name: string, expected = 0) {
  // Invoke package entrypoints with Node: Windows cannot spawn POSIX .bin wrappers.
  const cli = { prisma: "prisma/build/index.js", tsc: "typescript/bin/tsc", next: "next/dist/bin/next" };
  const executable = Object.entries(cli).find(([name]) => binary === join(root, "node_modules/.bin", name));
  if (executable) { args = [join(root, "node_modules", executable[1]), ...args]; binary = process.execPath; }
  const result = spawnSync(binary, args, { cwd: root, encoding: "utf8", timeout: 90000 });
  if (result.error) throw result.error;
  assert.equal(result.status, expected, sanitize(`${name}: ${result.stderr}\n${result.stdout}`));
  return result.stdout;
}
const script = (name: string, args: string[] = [], expected = 0) => command(process.execPath, ["--conditions=react-server", "--import", "tsx", join(root, "scripts", name), ...args], name, expected);
const prisma = (args: string[]) => command(join(root, "node_modules/.bin/prisma"), [...args, "--config", join(root, "prisma7.config.ts")], `prisma ${args[0]}`);
async function migration(name: string, sql: string) {
  assert.match(sql, /CREATE TABLE|ADD COLUMN/);
  assert.doesNotMatch(sql, /\bDROP\s+(TABLE|COLUMN|TYPE)\b|\bTRUNCATE\b/i);
  const path = join(root, "prisma/migrations", name);
  await mkdir(path); await writeFile(join(path, "migration.sql"), sql);
}

try {
  await database.connect();
  await database.query(`CREATE SCHEMA "${schema}"`); created = true;
  for (const directory of ["src", "scripts", "public", "prisma/models", "prisma/migrations"]) {
    try { await cp(join(project, directory), join(root, directory), { recursive: true }); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
  }
  for (const file of ["package.json", "package-lock.json", "tsconfig.json", "next-env.d.ts", "prisma7.config.ts", "prisma/.orm-installations.json"]) {
    try { await cp(join(project, file), join(root, file)); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
  }
  await symlink(join(project, "node_modules"), join(root, "node_modules"), process.platform === "win32" ? "junction" : "dir");
  await writeFile(join(root, ".env.local"), `DATABASE_URL=${JSON.stringify(url.toString())}\nAUTH_SECRET=${randomBytes(32).toString("hex")}\nAUTH_TRUST_HOST=true\nAUTH_URL=http://127.0.0.1:3031\n`, { mode: 0o600 });
  const authPath = join(root, "src/auth.config.ts");
  const fixtureCookies = Object.fromEntries(["sessionToken", "csrfToken", "callbackUrl"].map(name => [name, { name: `${schema}.${name}`, options: { httpOnly: true, sameSite: "lax", path: "/", secure: false } }]));
  const auth = await readFile(authPath, "utf8");
  assert.ok(auth.includes("providers: [],"));
  await writeFile(authPath, auth.replace("providers: [],", `providers: [],\n  cookies: ${JSON.stringify(fixtureCookies)},`));
  // The symlinked dependencies and fixture both live under the workspace root.
  const next = await readFile(join(project, "next.config.ts"), "utf8");
  await writeFile(join(root, "next.config.ts"), next.replace("turbopack: {", `turbopack: {\n    root: ${JSON.stringify(project)},`));
  prisma(["migrate", "deploy"]);
  script("create-app.ts", ["Ensayo Framework"]);
  const firstModel = join(root, "src/app/(auth)/erp/ensayo-framework/models/Record.ts");
  await writeFile(firstModel, (await readFile(firstModel, "utf8")).replace('"unique":false', '"unique":true'));
  script("orm-generate.ts", ["ensayo-framework", "--write"]);
  script("orm-bind.ts", ["ensayo-framework", "--write"], 1);
  const initialSql = await readFile(join(root, "src/generated/orm/apps/ensayo-framework/migration.preview.sql"), "utf8");
  script("orm-install.ts", ["ensayo-framework", "--write"]);
  await migration("20990101000000_framework_install", initialSql);
  prisma(["migrate", "deploy"]); prisma(["generate"]);
  script("orm-generate.ts", ["ensayo-framework", "--write"]);
  script("orm-bind.ts", ["ensayo-framework", "--write"]);
  await writeFile(join(root, "initial-check.ts"), `import assert from "node:assert/strict";\nimport {config} from "dotenv"; config({path:".env.local",quiet:true});\nconst {prisma}=await import("./src/lib/prisma");\nconst {recordService}=await import("./src/app/(auth)/erp/ensayo-framework/models/record.service");\nconst {hashPassword}=await import("./src/lib/auth/password");\ntry { const user=await prisma.user.create({data:{login:"fixture-admin",password:await hashPassword("framework-test-only"),isAdmin:true}}); const saved=await recordService.save(prisma,user,{name:"Registro anterior",active:true}); assert.ok(saved.ok,JSON.stringify(saved)); } finally {await prisma.$disconnect();}\n`);
  command(process.execPath, ["--conditions=react-server", "--import", "tsx", "initial-check.ts"], "initial persistence");
  console.log("✓ Aplicación creada, esquema migrado, acceso tipado enlazado y primer registro guardado.");

  const modelPath = join(root, "src/app/(auth)/erp/ensayo-framework/models/Record.ts");
  const model = await readFile(modelPath, "utf8");
  await writeFile(modelPath, model.replace("Fields, Model, defineModel", "Fields, Model, defineModel, ModelValidationError").replace('// Reglas de negocio: beforeSave(values, context) y afterSave(record, context).', `quantity = Fields.Integer({ required: true, default: 0, min: 0, tracking: true });\n  notes = Fields.Text({ maxLength: 200, sensitive: true });\n  startsAt = Fields.DateTime();\n  status = Fields.Selection([{value:"draft",label:"Borrador"},{value:"done",label:"Terminado"}] as const, {required:true,default:"draft",tracking:true});\n  partnerId = Fields.Many2one("Partner");\n  beforeSave(values: Record<string, unknown>) {\n    if (values.name === "bloqueado") throw new ModelValidationError("Nombre bloqueado por negocio.", {name:"Elige otro nombre."});\n    if (values.name === "normalizar") return {...values,quantity:7};\n    return values;\n  }\n  afterSave(values: Record<string, unknown>) { if(values.name === "rollback") throw new ModelValidationError("Rollback solicitado por la regla de negocio."); }`));
  const profilePath = join(root, "src/app/(auth)/erp/ensayo-framework/orm.config.ts");
  const profile = await readFile(profilePath, "utf8");
  await writeFile(profilePath, profile.replace('depends: []', 'depends: ["contactos"]').replace('["name", "active"]', '["name", "active", "quantity", "notes", "startsAt", "status", "partnerId"]').replace('externalOwners: {}', 'externalOwners: {Partner:"contactos"}'));
  script("orm-generate.ts", ["ensayo-framework", "--write"]);
  const updatedSql = await readFile(join(root, "src/generated/orm/apps/ensayo-framework/migration.preview.sql"), "utf8");
  script("orm-install.ts", ["ensayo-framework", "--write"], 1);
  script("orm-install.ts", ["ensayo-framework", "--update", "--write"]);
  script("orm-generate.ts", ["ensayo-framework", "--write"]);
  script("orm-bind.ts", ["ensayo-framework", "--write"], 1); // Old generated Prisma client must not pass compilation.
  await migration("20990101000001_framework_evolution", updatedSql);
  prisma(["migrate", "deploy"]); prisma(["generate"]);
  script("orm-bind.ts", ["ensayo-framework", "--write"]);
  script("orm-generate.ts", ["ensayo-framework", "--check"]);
  script("orm-install.ts", ["ensayo-framework", "--update", "--write"]);
  await cp(join(project, "scripts/fixtures/framework-check.fixture"), join(root, "framework-check.ts"));
  command(process.execPath, ["--conditions=react-server", "--import", "tsx", "framework-check.ts"], "evolved persistence and security");
  command(join(root, "node_modules/.bin/next"), ["typegen"], "Next route types");
  command(join(root, "node_modules/.bin/tsc"), ["--noEmit", "--incremental", "false"], "complete scaffold typecheck");
  console.log("✓ Evolución migrada sin perder el registro anterior; permisos, concurrencia, validación, relaciones, filtros, agrupación anidada, hooks, historial y notas verificados.");

  if (process.argv.includes("--serve")) {
    const server = spawn(join(root, "node_modules/.bin/next"), ["dev", "-p", "3031"], { cwd: root, stdio: ["ignore", "ignore", "ignore"] });
    console.log("Fixture para revisión visual: http://127.0.0.1:3031/erp/ensayo-framework (cookies aisladas; se eliminará al detener esta prueba).");
    await new Promise<void>((resolve, reject) => {
      const stop = () => { server.kill("SIGTERM"); };
      const watcher = watch(root, (_event, filename) => { if (filename === ".stop") stop(); });
      process.once("SIGINT", stop); process.once("SIGTERM", stop);
      server.once("error", error => { watcher.close(); process.off("SIGINT", stop); process.off("SIGTERM", stop); reject(error); });
      server.once("exit", code => { watcher.close(); process.off("SIGINT", stop); process.off("SIGTERM", stop); if (code && code !== 143) reject(new Error("El servidor temporal terminó con error.")); else resolve(); });
    });
  }
} finally {
  if (created) await database.query(`DROP SCHEMA "${schema}" CASCADE`);
  await database.end();
  await rm(root, { recursive: true, force: true });
}
console.log("✓ Proyecto y esquema temporales eliminados. Flota y los datos del ERP permanecen intactos.");
