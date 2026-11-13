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
  const result = spawnSync(binary, args, { cwd: root, env: { ...process.env, DATABASE_URL: url.toString() }, encoding: "utf8", timeout: 180000 });
  if (result.error) throw result.error;
  assert.equal(result.status, expected, sanitize(`${name}: ${result.stderr}\n${result.stdout}`));
  return result.stdout;
}
const tsx = (file: string, args: string[] = [], name = file) => command(process.execPath, ["--conditions=react-server", "--import", "tsx", file, ...args], name);
const prisma = (args: string[]) => command("prisma", [...args, "--config", join(root, "prisma7.config.ts")], `prisma ${args[0]}`);
const exists = (path: string) => access(path).then(() => true, () => false);

try {
  await database.connect();
  await database.query(`CREATE SCHEMA "${schema}"`); created = true;
  for (const directory of ["src", "scripts", "public", "prisma/models", "prisma/migrations"]) await cp(join(project, directory), join(root, directory), { recursive: true });
  for (const file of ["package.json", "package-lock.json", "tsconfig.json", "next-env.d.ts", "prisma7.config.ts", "prisma/.orm-installations.json"]) await cp(join(project, file), join(root, file));
  await symlink(join(project, "node_modules"), join(root, "node_modules"), process.platform === "win32" ? "junction" : "dir");
  await writeFile(join(root, ".env.local"), `DATABASE_URL=${JSON.stringify(url.toString())}\nAUTH_SECRET=${randomBytes(32).toString("hex")}\nAUTH_TRUST_HOST=true\nAUTH_URL=http://127.0.0.1:3032\n`, { mode: 0o600 });
  const authPath = join(root, "src/auth.config.ts");
  const fixtureCookies = Object.fromEntries(["sessionToken", "csrfToken", "callbackUrl"].map(name => [name, { name: `${schema}.${name}`, options: { httpOnly: true, sameSite: "lax", path: "/", secure: false } }]));
  const auth = await readFile(authPath, "utf8");
  assert.ok(auth.includes("providers: [],"));
  await writeFile(authPath, auth.replace("providers: [],", `providers: [],\n  cookies: ${JSON.stringify(fixtureCookies)},`));
  const next = await readFile(join(project, "next.config.ts"), "utf8");
  await writeFile(join(root, "next.config.ts"), next.replace("turbopack: {", `turbopack: {\n    root: ${JSON.stringify(project)},`));
  prisma(["migrate", "deploy"]);

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
  await writeFile(join(root, "src/modules/index.ts"), `import "server-only";\nimport type { ModuleDefinition } from "@/lib/modules/define";\nimport ensayo from "./ensayo/manifest";\nexport const modules: readonly ModuleDefinition[] = [ensayo];\n`);
  console.log("✓ Módulo ensayo instalado: sólo esquema y migración; sin contratos, bindings ni uploads generados.");

  await cp(join(project, "scripts/fixtures/modules-check.fixture"), join(root, "modules-check.ts"));
  tsx(join(root, "modules-check.ts"), [], "modules check");
  console.log("✓ Repositorio genérico y servicio: crear, normalize, beforeSave, revisión, listas, búsqueda, filtros, agrupación con etiquetas, lookup, kanban, historial, notas, borrado y permisos.");

  command("next", ["typegen"], "Next route types");
  command("tsc", ["--noEmit", "--incremental", "false"], "typecheck with modules and ejected views");
  console.log("✓ Ruta comodín, módulos registrados y vistas expulsadas compilan con TypeScript.");

  if (process.argv.includes("--serve")) {
    const credentials = randomBytes(9).toString("base64url");
    // Disposable admin in the temporary schema only, for manual review of the default views.
    await writeFile(join(root, "serve-admin.ts"), `import { config } from "dotenv"; config({ path: ".env.local", quiet: true });\nconst { prisma } = await import("./src/lib/prisma");\nconst { hashPassword } = await import("./src/lib/auth/password");\nawait prisma.user.create({ data: { login: "serve-admin", password: await hashPassword(process.argv[2]), isAdmin: true, partner: { create: { name: "Revisión visual" } } } });\nawait prisma.$disconnect();\n`);
    tsx(join(root, "serve-admin.ts"), [credentials], "serve admin");
    await writeFile(join(root, ".serve-login"), `usuario: serve-admin\ncontraseña: ${credentials}\n`, { mode: 0o600 });
    const server = spawn(process.execPath, [join(root, "node_modules/next/dist/bin/next"), "dev", "-p", "3032"], { cwd: root, stdio: ["ignore", "ignore", "ignore"] });
    console.log(`Revisión visual: http://127.0.0.1:3032/erp/ensayo (credenciales desechables en ${join(root, ".serve-login")}; se eliminan al detener).`);
    await new Promise<void>((resolve, reject) => {
      const stop = () => { server.kill("SIGTERM"); };
      const watcher = watch(root, (_event, filename) => { if (filename === ".stop") stop(); });
      process.once("SIGINT", stop); process.once("SIGTERM", stop);
      server.once("error", error => { watcher.close(); reject(error); });
      server.once("exit", () => { watcher.close(); resolve(); });
    });
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
