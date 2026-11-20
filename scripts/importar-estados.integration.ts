import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { parse } from "dotenv";
import { Client } from "pg";

// Only the parent creates/drops an exclusive schema; the worker cannot run on public.
async function worker(schema: string) {
  assert.match(schema, /^import_states_test_[a-f0-9]{16}$/);
  assert.equal(new URL(process.env.DATABASE_URL!).searchParams.get("schema"), schema);
  const { prisma } = await import("../src/lib/prisma");
  try {
    const { modelService } = await import("../src/lib/modules/registry");
    const { leerEstadosExistentes, prepararPlanEstados, aplicarPlanEstados, estadosInegiSchema } = await import("../src/modules/ubicaciones/imports/estados-inegi");
    const { hashPassword } = await import("../src/lib/auth/password");
    const password = await hashPassword(randomBytes(16).toString("hex"));
    const user = await prisma.user.create({ data: { login: "import-test-admin", password, isAdmin: true } });
    const reader = await prisma.user.create({ data: { login: "import-test-reader", password } });
    const actor = { id: user.id, sessionVersion: user.sessionVersion };
    const paisService = modelService("ubicaciones.pais");
    const estadoService = modelService("ubicaciones.estado");
    const pais = await paisService.save(prisma, actor, { name: "México", codigo: "MX", active: true, estadoIds: [] });
    assert.ok(pais.ok, JSON.stringify(pais));
    const paisId = pais.values.id as string;
    const fuente = Array.from({ length: 32 }, (_, index) => ({ codigo: String(index + 1).padStart(2, "0"), name: `Estado ficticio ${index + 1}` }));
    const read = () => prisma.$transaction(tx => leerEstadosExistentes({ tx, actor }, paisId), { isolationLevel: "RepeatableRead" });
    const plan = async (source = fuente) => prepararPlanEstados(source, await read());
    const apply = (source: typeof fuente, reviewed: ReturnType<typeof prepararPlanEstados>, who = actor, target = paisId) => prisma.$transaction(
      tx => aplicarPlanEstados({ tx, actor: who }, target, source, reviewed),
      { isolationLevel: "Serializable", timeout: 60_000 },
    );
    const snapshot = async () => ({
      rows: await prisma.ubicacionesEstado.findMany({ orderBy: { id: "asc" } }),
      parent: await prisma.ubicacionesPais.findUnique({ where: { id: paisId } }),
      activity: await prisma.recordActivity.findMany({ orderBy: { id: "asc" } }),
    });
    const initial = await plan();
    assert.equal(initial.crear.length, 32);
    assert.deepEqual(await apply(fuente, initial), { creados: 32, actualizados: 0 });
    assert.equal(await prisma.ubicacionesEstado.count(), 32);
    assert.equal(await prisma.ubicacionesEstado.count({ where: { createBy: user.id } }), 32);
    assert.equal(await prisma.recordActivity.count({ where: { model: "UbicacionesEstado", actorId: user.id } }), 32);
    const beforeRepeat = await snapshot();
    const repeated = await plan();
    assert.equal(repeated.sinCambios.length, 32);
    assert.deepEqual(await apply(fuente, repeated), { creados: 0, actualizados: 0 });
    assert.deepEqual(await snapshot(), beforeRepeat, "repeat must not write revisions or history");

    const first = (await read()).find(row => row.codigo === "01")!;
    const record = await estadoService.read(prisma, actor, first.id);
    assert.ok(record.ok);
    assert.ok((await estadoService.save(prisma, actor, { ...record.values, active: false })).ok);
    const renamed = fuente.map(row => row.codigo === "01" ? { ...row, name: "Nombre oficial actualizado" } : row);
    const reviewedRename = await plan(renamed);
    assert.equal(reviewedRename.actualizar.length, 1);
    assert.deepEqual(await apply(renamed, reviewedRename), { creados: 0, actualizados: 1 });
    assert.equal((await prisma.ubicacionesEstado.findUniqueOrThrow({ where: { id: first.id } })).active, false);
    assert.ok((await estadoService.save(prisma, actor, { name: "Registro manual", codigo: "MANUAL", paisId, active: true })).ok);

    const stale = await plan(fuente);
    const second = (await read()).find(row => row.codigo === "02")!;
    const secondRecord = await estadoService.read(prisma, actor, second.id);
    assert.ok(secondRecord.ok);
    assert.ok((await estadoService.save(prisma, actor, { ...secondRecord.values, active: false })).ok);
    await assert.rejects(apply(fuente, stale), /datos cambiaron/);
    const reviewed = await plan(renamed);
    const beforeDenied = await snapshot();
    await assert.rejects(apply(renamed, reviewed, { id: reader.id, sessionVersion: 0 }), /administrador activo/);
    await assert.rejects(apply(renamed, reviewed, { ...actor, sessionVersion: actor.sessionVersion + 1 }), /administrador activo/);
    await prisma.user.update({ where: { id: user.id }, data: { active: false } });
    await assert.rejects(apply(renamed, reviewed), /administrador activo/);
    await prisma.user.update({ where: { id: user.id }, data: { active: true } });
    await assert.rejects(apply(renamed, reviewed, actor, "pais-inexistente"), /destino cambió/);
    assert.deepEqual(await snapshot(), beforeDenied);

    const invalid = [{ codigo: "71", name: "Alta que debe revertirse" }, { codigo: "72", name: "" }];
    const beforeRollback = await snapshot();
    await assert.rejects(apply(invalid, await plan(invalid)));
    assert.deepEqual(await snapshot(), beforeRollback, "late model rejection rolls back rows, parent and audit");

    // Deliberately inject a legacy duplicate in this disposable schema only.
    const duplicate = await prisma.ubicacionesEstado.create({ data: { name: "Duplicado ficticio", codigo: "03", paisId } });
    const conflicting = await plan(renamed);
    assert.equal(conflicting.conflictos.length, 1);
    const beforeConflict = await snapshot();
    await assert.rejects(apply(renamed, conflicting), /conflictos/);
    assert.deepEqual(await snapshot(), beforeConflict);
    await prisma.ubicacionesEstado.delete({ where: { id: duplicate.id } });

    const concurrentSource = [{ codigo: "90", name: "Alta concurrente ficticia" }];
    const concurrentPlan = await plan(concurrentSource);
    const concurrent = await Promise.allSettled([apply(concurrentSource, concurrentPlan), apply(concurrentSource, concurrentPlan)]);
    assert.equal(concurrent.filter(result => result.status === "fulfilled").length, 1);
    assert.equal(await prisma.ubicacionesEstado.count({ where: { paisId, codigo: "90" } }), 1);
    assert.equal(await prisma.ubicacionesEstado.count({ where: { paisId, codigo: "MANUAL" } }), 1);

    assert.equal(estadosInegiSchema.safeParse({ datos: [{ cve_ent: "01", nomgeo: "A" }, { cve_ent: "01", nomgeo: "B" }] }).success, false);
    const directory = await mkdtemp(join(tmpdir(), "inegi-cli-test-"));
    try {
      const preload = join(directory, "fetch.mjs");
      const terminal = join(directory, "terminal.mjs");
      await writeFile(terminal, 'Object.defineProperty(process.stdin, "isTTY", {value:true}); Object.defineProperty(process.stdout, "isTTY", {value:true});\n');
      await writeFile(preload, `globalThis.fetch = async () => new Response(${JSON.stringify(JSON.stringify({ datos: renamed.map(row => ({ cve_ent: row.codigo, nomgeo: row.name })) }))}, {status:200});\n`);
      const beforeCli = await snapshot();
      const cli = (args: string[], extraEnv = {}, input?: string, interactive = false) => spawnSync(process.execPath, ["--conditions=react-server", "--import", "tsx", "--import", preload, ...(interactive ? ["--import", terminal] : []), "scripts/importar-estados.ts", ...args], { env: { ...process.env, ...extraEnv }, input, encoding: "utf8", timeout: 60_000 });
      const preview = cli([user.login]);
      assert.equal(preview.status, 0, preview.stderr);
      assert.equal(JSON.parse(preview.stdout).sinCambios.length, 32);
      assert.deepEqual(await snapshot(), beforeCli, "CLI default is read only");
      assert.notEqual(cli([user.login, "--aplicar"]).status, 0, "application without TTY must fail");
      assert.notEqual(cli([user.login, "--yes"]).status, 0);
      assert.notEqual(cli([reader.login]).status, 0);
      assert.notEqual(cli([user.login], { NODE_ENV: "production" }).status, 0);
      assert.deepEqual(await snapshot(), beforeCli);
      const changed = renamed.map(row => row.codigo === "02" ? { ...row, name: "Cambio aprobado por terminal" } : row);
      await writeFile(preload, `globalThis.fetch = async () => new Response(${JSON.stringify(JSON.stringify({ datos: changed.map(row => ({ cve_ent: row.codigo, nomgeo: row.name })) }))}, {status:200});\n`);
      const cancelled = cli([user.login, "--aplicar"], {}, "cancelar\n", true);
      assert.equal(cancelled.status, 0, cancelled.stderr);
      assert.match(cancelled.stdout, /Importación cancelada/);
      assert.deepEqual(await snapshot(), beforeCli);
      const approved = cli([user.login, "--aplicar"], {}, "aplicar\n", true);
      assert.equal(approved.status, 0, approved.stderr);
      assert.equal((await prisma.ubicacionesEstado.findUniqueOrThrow({ where: { id: second.id } })).name, "Cambio aprobado por terminal");
      const afterCli = await snapshot();
      const noop = cli([user.login, "--aplicar"], {}, undefined, true);
      assert.equal(noop.status, 0, noop.stderr);
      assert.match(noop.stdout, /No hay cambios/);
      assert.deepEqual(await snapshot(), afterCli);
    } finally { await rm(directory, { recursive: true, force: true }); }
    console.log("✓ Importación: 32 altas, repetición sin escrituras, cambios preservando activo, auditoría, revisión/actor/conflictos, rollback completo, concurrencia y CLI plan/cancelar/confirmar/sin cambios/no TTY/producción.");
  } finally { await prisma.$disconnect(); }
}

if (process.argv[2] === "--worker") {
  await worker(process.argv[3]);
} else {
  const variables = parse(await readFile(".env.local"));
  const connection = process.env.DATABASE_URL ?? variables.DATABASE_URL;
  if (!connection) throw new Error("Configura la conexión de desarrollo para la prueba aislada.");
  const schema = `import_states_test_${randomBytes(8).toString("hex")}`;
  const url = new URL(connection); url.searchParams.set("schema", schema);
  const database = new Client({ connectionString: connection });
  const sanitize = (value: string) => value.replaceAll(url.toString(), "[test database]").replaceAll(connection, "[database]");
  let created = false;
  try {
    await database.connect();
    await database.query(`CREATE SCHEMA "${schema}"`); created = true;
    const env = { ...process.env, DATABASE_URL: url.toString() };
    for (const args of [["node_modules/prisma/build/index.js", "migrate", "deploy", "--config", "prisma7.config.ts"], ["--conditions=react-server", "--import", "tsx", "scripts/importar-estados.integration.ts", "--worker", schema]]) {
      const result = spawnSync(process.execPath, args, { env, encoding: "utf8", timeout: 180_000 });
      if (result.error) throw result.error;
      assert.equal(result.status, 0, sanitize(`${result.stdout}\n${result.stderr}`));
      if (args.includes("--worker")) console.log(result.stdout.trim());
    }
  } finally {
    if (created) await database.query(`DROP SCHEMA "${schema}" CASCADE`);
    await database.end();
    if (created) console.log("✓ Esquema temporal eliminado. No se modificaron datos del ERP.");
  }
}
