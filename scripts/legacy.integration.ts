import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { cp, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { spawn, type ChildProcess } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:net";
import { setTimeout as delay } from "node:timers/promises";
import { parse } from "dotenv";
import { Client } from "pg";

// Run the existing suites unchanged in a disposable project/schema, including
// auth's seed/admin assumptions. Never point their HTTP clients at the real ERP.
const project = process.cwd();
const variables = parse(await readFile(join(project, ".env.local")));
const connection = process.env.DATABASE_URL ?? variables.DATABASE_URL;
if (!connection) throw new Error("Configura DATABASE_URL para la prueba aislada.");
const schema = `legacy_test_${randomBytes(8).toString("hex")}`;
const url = new URL(connection); url.searchParams.set("schema", schema);
const root = await mkdtemp(join(project, ".legacy-test-"));
const database = new Client({ connectionString: connection, connectionTimeoutMillis: 10000 });
const listener = createServer();
await new Promise<void>((resolve, reject) => { listener.once("error", reject); listener.listen(0, "127.0.0.1", resolve); });
const address = listener.address(); assert.ok(address && typeof address === "object");
// NextRequest normalizes loopback IPs to localhost; use the same origin for
// Auth.js callback validation and the suites' exact redirect assertions.
const base = `http://localhost:${address.port}`;
await new Promise<void>((resolve, reject) => listener.close(error => error ? reject(error) : resolve()));
const env = { ...process.env, DATABASE_URL: url.toString(), AUTH_URL: base, TEST_AUTH_URL: base };
const sanitize = (text: string) => text.replaceAll(url.toString(), "[test database]").replaceAll(connection, "[database]");
let server: ChildProcess | undefined, serverLog = "", created = false;

async function stop(child: ChildProcess) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  const stopped = once(child, "exit");
  if (process.platform === "win32" && child.pid) {
    const killer = spawn("taskkill", ["/PID", String(child.pid), "/T", "/F"], { stdio: "ignore", windowsHide: true });
    await once(killer, "exit");
  } else child.kill("SIGTERM");
  await stopped;
}

async function command(args: string[], name: string) {
  const child = spawn(process.execPath, args, { cwd: root, env, stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
  let output = "";
  child.stdout.on("data", data => { output += data; }); child.stderr.on("data", data => { output += data; });
  let timedOut = false;
  const timeout = setTimeout(() => { timedOut = true; void stop(child).catch(() => child.kill()); }, 240000);
  try {
    const [code] = await once(child, "exit");
    assert.equal(code, 0, sanitize(`${name}${timedOut ? " (timeout 240 s)" : ""}: ${output}\nServidor temporal: ${serverLog}`));
    console.log(`✓ ${name}`);
  } finally { clearTimeout(timeout); }
}
const tsx = (file: string) => command(["--conditions=react-server", "--import", "tsx", file], file);

try {
  await database.connect();
  await database.query(`CREATE SCHEMA "${schema}"`); created = true;
  for (const directory of ["src", "scripts", "public", "prisma"]) await cp(join(project, directory), join(root, directory), { recursive: true, filter: path => !path.endsWith(".orm-sync.lock") });
  for (const file of [".gitignore", "package.json", "package-lock.json", "tsconfig.json", "next-env.d.ts", "prisma7.config.ts"]) await cp(join(project, file), join(root, file));
  await symlink(join(project, "node_modules"), join(root, "node_modules"), process.platform === "win32" ? "junction" : "dir");
  await writeFile(join(root, ".env.local"), `DATABASE_URL=${JSON.stringify(url.toString())}\nAUTH_SECRET=${randomBytes(32).toString("hex")}\nAUTH_TRUST_HOST=true\nAUTH_URL=${base}\n`, { mode: 0o600 });
  const next = await readFile(join(project, "next.config.ts"), "utf8");
  // Bound Tailwind's scanner to application sources. Without the real project's
  // ignore file, a copied project can scan generated code/dependency junctions.
  await writeFile(join(root, "next.config.ts"), next
    .replace("turbopack: {", `turbopack: {\n    root: ${JSON.stringify(project)},`)
    .replace('loaders: ["@tailwindcss/turbopack"]', `loaders: [{ loader: "@tailwindcss/turbopack", options: { base: ${JSON.stringify(join(root, "src"))} } }]`));
  await command([join(root, "node_modules/prisma/build/index.js"), "migrate", "deploy", "--config", "prisma7.config.ts"], "Migraciones sólo en esquema temporal");
  await command([join(root, "node_modules/prisma/build/index.js"), "generate", "--config", "prisma7.config.ts"], "Cliente Prisma temporal");
  await tsx("prisma/seed.ts");
  await command([join(root, "node_modules/next/dist/bin/next"), "build"], "Build del servidor temporal");
  const trace = JSON.parse(await readFile(join(root, ".next/server/app/(auth)/erp/modulos/page.js.nft.json"), "utf8")) as { files: string[] };
  for (const suffix of ["src/modules/demo/manifest.ts", "src/app/(auth)/erp/contactos/manifest.ts", "prisma/.orm-installations.json"]) assert.ok(trace.files.some(file => file.replaceAll("\\", "/").endsWith(suffix)), `El trace de Módulos debe incluir ${suffix}`);
  assert.ok(!trace.files.some(file => /(?:^|\/)\.env[^/]*$|(?:^|\/)\.module-operations\//.test(file.replaceAll("\\", "/"))), "El trace no debe distribuir configuración privada ni respaldos");
  console.log("✓ Trace de Módulos incluye manifests y propiedad para el catálogo en producción.");
  // Default cookie names are required by auth's tampering test. A random dedicated
  // HTTP port and private cookie jars keep this server separate from browser sessions.
  server = spawn(process.execPath, [join(root, "node_modules/next/dist/bin/next"), "start", "-p", String(address.port), "--hostname", "localhost"], { cwd: root, env: { ...env, NODE_ENV: "production" }, stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
  server.on("error", error => { serverLog += error.message; });
  for (const stream of [server.stdout, server.stderr]) stream?.on("data", data => { serverLog = (serverLog + data).slice(-14000); });
  const deadline = Date.now() + 120000;
  let ready = false;
  while (Date.now() < deadline && server.exitCode === null) {
    try { const response = await fetch(`${base}/api/auth/csrf`, { signal: AbortSignal.timeout(3000) }); ready = response.ok; await response.text(); if (ready) break; } catch { /* startup/compilation */ }
    await delay(500);
  }
  assert.ok(ready, sanitize(`El servidor temporal no arrancó: ${serverLog}`));
  for (const file of ["auth.integration.ts", "contacts.integration.ts", "theme.integration.ts"]) await tsx(`scripts/${file}`);
} finally {
  // Terminate only the recorded fixture process tree, including workers on timeout.
  if (server) await stop(server);
  try { if (created) await database.query(`DROP SCHEMA "${schema}" CASCADE`); }
  finally {
    await database.end();
    await rm(root, { recursive: true, force: true, maxRetries: 20, retryDelay: 500 });
  }
}
console.log("✓ Integraciones de autenticación, Contactos y tema aprobadas; proyecto y esquema temporales eliminados.");
