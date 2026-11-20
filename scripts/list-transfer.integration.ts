import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { parse } from "dotenv";
import { Client } from "pg";

async function worker(schema: string) {
  assert.match(schema, /^list_transfer_test_[a-f0-9]{16}$/);
  assert.equal(new URL(process.env.DATABASE_URL!).searchParams.get("schema"), schema);
  const { prisma } = await import("../src/lib/prisma");
  const { reviewTransfer, applyTransfer, exportTransfer } = await import("../src/lib/list/transfer");
  const { modelService, modelClientConfig, getModuleModel } = await import("../src/lib/modules/registry");
  const { readAccessCapabilities } = await import("../src/lib/access/engine");
  const { setModelAccess } = await import("../src/lib/access/admin");
  const { readTransferFile } = await import("../src/lib/list/transfer-file");
  try {
    const user = await prisma.user.create({ data: { login: "transfer-admin", password: "unused", isAdmin: true } });
    const reader = await prisma.user.create({ data: { login: "transfer-reader", password: "unused" } });
    const actor = { id: user.id, sessionVersion: user.sessionVersion };
    const other = { id: reader.id, sessionVersion: reader.sessionVersion };
    const model = "ubicaciones.pais";
    const state = { query: "", page: 1, pageSize: 25, sort: "name", direction: "asc", filters: [] };
    const csv = (text: string) => reviewTransfer(prisma, actor, model, "pais.csv", Buffer.from(text));
    const count = async () => ({ countries: await prisma.ubicacionesPais.count(), history: await prisma.recordActivity.count() });
    const initial = await count();
    const plan = await csv("codigo,name,active\nmx,México,true\nUS,Estados Unidos,false");
    assert.ok(plan.token); assert.deepEqual(plan.rows.map(row => row.operation), ["create", "create"]);
    assert.deepEqual(await count(), initial, "preview commits no writes");
    assert.deepEqual(await applyTransfer(prisma, actor, model, plan.token!), { created: 2, updated: 0, unchanged: 0 });
    const mexico = await prisma.ubicacionesPais.findUniqueOrThrow({ where: { codigo: "MX" } });
    assert.equal(mexico.createBy, user.id);
    const beforeRepeat = await count();
    const repeated = await csv("codigo,name,active\nMX,México,true\nUS,Estados Unidos,false");
    assert.deepEqual(await applyTransfer(prisma, actor, model, repeated.token!), { created: 0, updated: 0, unchanged: 2 });
    assert.deepEqual(await count(), beforeRepeat);
    assert.deepEqual(await prisma.ubicacionesPais.findUnique({ where: { codigo: "MX" } }), mexico);
    await assert.rejects(applyTransfer(prisma, actor, model, plan.token!), /cambiaron/);
    await assert.rejects(applyTransfer(prisma, other, model, repeated.token!), /expiró/);
    await assert.rejects(applyTransfer(prisma, actor, model, repeated.token! + "x"), /vigente/);

    const estado = await modelService("ubicaciones.estado").save(prisma, actor, { name: "Estado de prueba", codigo: "01", paisId: mexico.id, active: true });
    assert.ok(estado.ok, JSON.stringify(estado));
    const changed = await csv("codigo,name\nMX,México actualizado");
    assert.equal(changed.rows[0].operation, "update", JSON.stringify(changed));
    assert.deepEqual(await applyTransfer(prisma, actor, model, changed.token!), { created: 0, updated: 1, unchanged: 0 });
    assert.equal(await prisma.ubicacionesEstado.count({ where: { paisId: mexico.id } }), 1, "owned states survive scalar updates");
    assert.equal((await prisma.ubicacionesPais.findUniqueOrThrow({ where: { codigo: "MX" } })).active, true);

    const duplicate = await csv("codigo,name\nmx,Uno\nMX,Dos");
    assert.equal(duplicate.token, undefined); assert.ok(duplicate.rows.every(row => row.operation === "error"));
    const invalid = await csv("codigo,name,active\nX,Uno,true\nCA,Canadá,no");
    assert.equal(invalid.token, undefined); assert.ok(invalid.rows[0].errors?.codigo); assert.ok(invalid.rows[1].errors?.active);
    await assert.rejects(csv("id,name\nforged,Nombre"), /Encabezados/);
    const { Pais } = await import("../src/modules/ubicaciones/models/pais");
    const { ModelValidationError } = await import("../src/lib/orm/context");
    const hookDescriptor = Object.getOwnPropertyDescriptor(Pais.prototype, "afterSave");
    const beforeHook = await count();
    try {
      Object.defineProperty(Pais.prototype, "afterSave", { configurable: true, value: async () => { throw new ModelValidationError("Rechazo desde afterSave."); } });
      const rejected = await csv("codigo,name\nZZ,Rechazado");
      assert.equal(rejected.token, undefined);
      assert.match(JSON.stringify(rejected.rows[0].errors), /afterSave/);
      assert.deepEqual(await count(), beforeHook, "preview rolls back even after a hook rejects the write");
    } finally {
      if (hookDescriptor) Object.defineProperty(Pais.prototype, "afterSave", hookDescriptor);
      else Reflect.deleteProperty(Pais.prototype, "afterSave");
    }
    const late = await csv("codigo,name\nAA,Primero\nBB,Segundo");
    assert.ok(late.token);
    const intruder = await modelService(model).save(prisma, actor, { name: "Creado después", codigo: "BB", active: true, estadoIds: [] });
    assert.ok(intruder.ok);
    const lateBefore = await count();
    await assert.rejects(applyTransfer(prisma, actor, model, late.token!), /Fila 3.*ninguna fila/);
    assert.equal(await prisma.ubicacionesPais.count({ where: { codigo: "AA" } }), 0);
    assert.deepEqual(await count(), lateBefore, "late failure rolls back previous rows and history");

    for (const format of ["csv", "xlsx"] as const) {
      const file = await exportTransfer(prisma, actor, model, { format, state: { ...state, query: "México" }, selection: [], template: false });
      const rows = await readTransferFile(file.name, Buffer.from(file.base64, "base64"));
      assert.equal(rows.length, 2); assert.equal(rows[1][0], "MX");
      const selected = await exportTransfer(prisma, actor, model, { format, state, selection: [mexico.id], template: false });
      assert.equal((await readTransferFile(selected.name, Buffer.from(selected.base64, "base64"))).length, 2);
    }
    await assert.rejects(exportTransfer(prisma, actor, model, { format: "csv", state: { ...state, query: "México" }, selection: [intruder.values.id], template: false }), /fuera/);
    await assert.rejects(exportTransfer(prisma, other, model, { format: "csv", state, selection: [], template: false }), /permiso/);
    await assert.rejects(reviewTransfer(prisma, other, model, "pais.csv", Buffer.from("codigo,name\nCA,Canadá")), /permiso/);
    const municipioModel = "ubicaciones.municipio";
    const municipioEnabled = Boolean(getModuleModel(municipioModel)!.entry.declaration.transfer);
    if (!municipioEnabled) await assert.rejects(reviewTransfer(prisma, actor, municipioModel, "municipio.csv", Buffer.from("codigo,name\n01,Municipio")), /habilita/);

    await setModelAccess(prisma, actor, "core.internal", new Map([[model, { read: true, create: false, write: false, unlink: false, import: true, export: true }]]));
    const capabilities = await prisma.$transaction(tx => readAccessCapabilities(tx, other));
    assert.equal(capabilities.modelAccess[model].import, true); assert.equal(capabilities.modelAccess[model].export, true);
    const ui = modelClientConfig(model, capabilities);
    assert.equal(ui.transfer?.canImport, false, "import also needs create or write"); assert.equal(ui.transfer?.canExport, true);
    const deniedCrud = await reviewTransfer(prisma, other, model, "pais.csv", Buffer.from("codigo,name\nCA,Canadá"));
    assert.equal(deniedCrud.token, undefined);
    await setModelAccess(prisma, actor, "core.internal", new Map([[model, { read: true, create: true, write: true, unlink: false, import: true, export: true }]]));
    const allowed = await reviewTransfer(prisma, other, model, "pais.csv", Buffer.from("codigo,name\nCA,Canadá")); assert.ok(allowed.token);
    await setModelAccess(prisma, actor, "core.internal", new Map([[model, { read: true, create: true, write: true, unlink: false, import: false, export: false }]]));
    await assert.rejects(applyTransfer(prisma, other, model, allowed.token!), /permiso/);
    assert.equal(await prisma.ubicacionesPais.count({ where: { codigo: "CA" } }), 0);

    // Phase 2: external Many2one keys and a compound identity, preserving owner semantics.
    const countries = await csv("codigo,name\nCL,País piloto CL\nAR,País piloto AR");
    assert.ok(countries.token);
    await applyTransfer(prisma, actor, model, countries.token!);
    const countryCL = await prisma.ubicacionesPais.findUniqueOrThrow({ where: { codigo: "CL" } });
    const countryAR = await prisma.ubicacionesPais.findUniqueOrThrow({ where: { codigo: "AR" } });
    const stateModel = "ubicaciones.estado";
    const stateCsv = (text: string, who = actor) => reviewTransfer(prisma, who, stateModel, "estado.csv", Buffer.from(text));
    const inputStates = "paisId.codigo,codigo,name,active\ncl,01,Piloto uno,true\nCL,02,Piloto dos,false\nAR,01,Piloto Argentina,true";
    const owners = () => prisma.ubicacionesPais.findMany({ where: { id: { in: [countryCL.id, countryAR.id] } }, orderBy: { id: "asc" } });
    const parentsBefore = await owners(), historyBefore = await prisma.recordActivity.count();
    const statesPlan = await stateCsv(inputStates);
    assert.ok(statesPlan.token, JSON.stringify(statesPlan));
    assert.deepEqual(statesPlan.rows.map(row => row.operation), ["create", "create", "create"]);
    assert.equal(statesPlan.rows[0].values?.["paisId.codigo"], "CL");
    assert.deepEqual(await owners(), parentsBefore, "state preview rolls back parent revisions too");
    assert.equal(await prisma.recordActivity.count(), historyBefore);
    assert.deepEqual(await applyTransfer(prisma, actor, stateModel, statesPlan.token!), { created: 3, updated: 0, unchanged: 0 });
    assert.notDeepEqual(await owners(), parentsBefore, "state writes advance their owners' revisions");
    const stateOne = await prisma.ubicacionesEstado.findFirstOrThrow({ where: { paisId: countryCL.id, codigo: "01" } });
    assert.equal(await prisma.ubicacionesEstado.count({ where: { codigo: "01", paisId: { in: [countryCL.id, countryAR.id] } } }), 2, "codes can repeat across countries");
    const duplicateSave = await modelService(stateModel).save(prisma, actor, { name: "Duplicado", codigo: "01", paisId: countryCL.id, active: true });
    assert.equal(duplicateSave.ok, false, "database enforces the same compound identity outside imports");
    const parentsAfter = await owners(), historyAfter = await prisma.recordActivity.count();
    const stateRepeat = await stateCsv(inputStates);
    assert.ok(stateRepeat.token, JSON.stringify(stateRepeat));
    assert.deepEqual(await applyTransfer(prisma, actor, stateModel, stateRepeat.token!), { created: 0, updated: 0, unchanged: 3 });
    assert.deepEqual(await owners(), parentsAfter);
    assert.equal(await prisma.recordActivity.count(), historyAfter);
    const changedState = await stateCsv("paisId.codigo,codigo,name\nCL,02,Piloto dos actualizado");
    assert.ok(changedState.token, JSON.stringify(changedState));
    await applyTransfer(prisma, actor, stateModel, changedState.token!);
    assert.equal((await prisma.ubicacionesEstado.findFirstOrThrow({ where: { paisId: countryCL.id, codigo: "02" } })).active, false);

    for (const format of ["csv", "xlsx"] as const) {
      const file = await exportTransfer(prisma, actor, stateModel, { format, state: { ...state, query: "Piloto" }, selection: [], template: false });
      const bytes = Buffer.from(file.base64, "base64"), cells = await readTransferFile(file.name, bytes);
      assert.deepEqual(cells[0], ["paisId.codigo", "codigo", "name", "active"]);
      assert.equal(cells.length, 4);
      assert.ok(cells.slice(1).every(row => ["CL", "AR"].includes(String(row[0])) && ["01", "02"].includes(String(row[1]))));
      const reimport = await reviewTransfer(prisma, actor, stateModel, file.name, bytes);
      assert.ok(reimport.token, JSON.stringify(reimport));
      assert.ok(reimport.rows.every(row => row.operation === "unchanged"));
    }
    const beforeMissing = await count();
    const missing = await stateCsv("paisId.codigo,codigo,name\nZZ,01,Sin país");
    assert.equal(missing.token, undefined); assert.ok(missing.rows[0].errors?.["paisId.codigo"]);
    assert.deepEqual(await count(), beforeMissing, "related countries are never created implicitly");
    await assert.rejects(stateCsv("paisId,codigo,name\nCL,01,ID crudo"), /Encabezados/);
    await assert.rejects(stateCsv("codigo,name\n01,Sin país"), /Encabezados/);
    const duplicateStates = await stateCsv("paisId.codigo,codigo,name\ncl,01,Uno\nCL, 01 ,Otro");
    assert.equal(duplicateStates.token, undefined); assert.ok(duplicateStates.rows.every(row => row.operation === "error"));

    const limitedParent = await csv("codigo,name\nLM,País con límite de documento");
    assert.ok(limitedParent.token); await applyTransfer(prisma, actor, model, limitedParent.token!);
    const limitedBefore = await prisma.ubicacionesPais.findUniqueOrThrow({ where: { codigo: "LM" } });
    const historyBeforeLimit = await prisma.recordActivity.count();
    const maxStates = getModuleModel(model)!.entry.contract.one2manyFields.estadoIds.one2many.maxRows;
    const exceedsOwner = await stateCsv("paisId.codigo,codigo,name\n" + Array.from({ length: maxStates + 1 }, (_, index) => `LM,${String(index + 1).padStart(2, "0")},Estado de límite ${index + 1}`).join("\n"));
    assert.equal(exceedsOwner.token, undefined, "cumulative owner limits must be detected before confirmation");
    assert.equal(exceedsOwner.rows[maxStates].operation, "error");
    assert.ok(JSON.stringify(exceedsOwner.rows[maxStates].errors).includes(`límite de ${maxStates} líneas editables`));
    assert.equal(await prisma.ubicacionesEstado.count({ where: { paisId: limitedBefore.id } }), 0);
    assert.deepEqual(await prisma.ubicacionesPais.findUniqueOrThrow({ where: { codigo: "LM" } }), limitedBefore);
    assert.equal(await prisma.recordActivity.count(), historyBeforeLimit, "batch preview rolls back every row, owner revision and history entry");

    const lateStates = await stateCsv("paisId.codigo,codigo,name\nAR,04,Piloto cuatro\nAR,05,Piloto cinco");
    assert.ok(lateStates.token, JSON.stringify(lateStates));
    const { Estado } = await import("../src/modules/ubicaciones/models/estado");
    const stateHook = Object.getOwnPropertyDescriptor(Estado.prototype, "afterSave");
    const beforeLateStates = { owners: await owners(), history: await prisma.recordActivity.count() };
    try {
      Object.defineProperty(Estado.prototype, "afterSave", { configurable: true, value: async (record: Record<string, unknown>) => { if (record.codigo === "05") throw new ModelValidationError("Rechazo tardío del Estado."); } });
      await assert.rejects(applyTransfer(prisma, actor, stateModel, lateStates.token!), /Fila 3.*Rechazo tardío/);
      assert.equal(await prisma.ubicacionesEstado.count({ where: { paisId: countryAR.id, codigo: { in: ["04", "05"] } } }), 0);
      assert.deepEqual({ owners: await owners(), history: await prisma.recordActivity.count() }, beforeLateStates, "late state failure rolls back owner revisions and all history");
    } finally {
      if (stateHook) Object.defineProperty(Estado.prototype, "afterSave", stateHook);
      else Reflect.deleteProperty(Estado.prototype, "afterSave");
    }

    const { encodeTransferValues } = await import("../src/lib/list/transfer-relations");
    const { Fields } = await import("../src/lib/orm/fields");
    const stateEntry = getModuleModel(stateModel)!.entry;
    const domainEntry = { ...stateEntry, metadata: { ...stateEntry.metadata, paisId: Fields.Many2one("UbicacionesPais", { required: true, domain: d => d.eq("active", true) }).metadata } };
    const arDocument = await modelService(model).read(prisma, actor, countryAR.id); assert.ok(arDocument.ok);
    assert.ok((await modelService(model).save(prisma, actor, { ...arDocument.values, active: false })).ok);
    const arState = await prisma.ubicacionesEstado.findFirstOrThrow({ where: { paisId: countryAR.id, codigo: "01" } });
    const domainInput = { paisId: countryAR.id, codigo: "01", name: arState.name, active: true };
    await assert.rejects(prisma.$transaction(tx => encodeTransferValues(tx, actor, domainEntry, stateEntry.declaration.transfer!, domainInput, true)), /dominio/);
    const historical = await prisma.$transaction(tx => encodeTransferValues(tx, actor, domainEntry, stateEntry.declaration.transfer!, domainInput));
    assert.equal(historical.values["paisId.codigo"], "AR", "export preserves readable historical references outside the domain");
    const restoreAR = await modelService(model).read(prisma, actor, countryAR.id); assert.ok(restoreAR.ok);
    assert.ok((await modelService(model).save(prisma, actor, { ...restoreAR.values, active: true })).ok);

    const renamedPlan = await stateCsv("paisId.codigo,codigo,name\nCL,01,Piloto revisado");
    assert.ok(renamedPlan.token);
    const parentDocument = await modelService(model).read(prisma, actor, countryCL.id); assert.ok(parentDocument.ok);
    assert.ok((await modelService(model).save(prisma, actor, { ...parentDocument.values, codigo: "CY" })).ok);
    const replacement = await csv("codigo,name\nCL,Otro país con la clave anterior"); assert.ok(replacement.token);
    await applyTransfer(prisma, actor, model, replacement.token!);
    await assert.rejects(applyTransfer(prisma, actor, stateModel, renamedPlan.token!), /referencia cambió/);
    assert.equal((await prisma.ubicacionesEstado.findUniqueOrThrow({ where: { id: stateOne.id } })).name, "Piloto uno");

    // Phase 3: a Many2one whose destination is identified by a compound key (Estado = País + código).
    const { decodeTransferReferences } = await import("../src/lib/list/transfer-relations");
    const municipioEntry = getModuleModel(municipioModel)!.entry;
    const municipioSpec = { key: ["estadoId", "codigo"], fields: ["estadoId", "codigo", "name", "active"], relations: { estadoId: { key: ["paisId", "codigo"], relations: { paisId: { key: "codigo" } } } } } as const;
    const decodeMunicipio = (cells: Record<string, unknown>, who = actor) => prisma.$transaction(tx => decodeTransferReferences(tx, who, municipioEntry, municipioSpec, { estadoId: cells, codigo: "001", name: "Municipio piloto" }));
    const fieldError = (header: string) => (error: unknown) => { assert.ok((error as { fieldErrors?: Record<string, string> }).fieldErrors?.[header], JSON.stringify((error as { fieldErrors?: unknown }).fieldErrors)); return true; };
    const stateCY = await prisma.ubicacionesEstado.findUniqueOrThrow({ where: { id: stateOne.id } });
    assert.equal((await decodeMunicipio({ "paisId.codigo": "ar", codigo: "01" })).estadoId, arState.id, "each hop applies its destination's normalization");
    assert.equal((await decodeMunicipio({ "paisId.codigo": "CY", codigo: "01" })).estadoId, stateCY.id, "the same state code resolves inside its own country");
    await assert.rejects(decodeMunicipio({ "paisId.codigo": "ZZ", codigo: "01" }), fieldError("estadoId.paisId.codigo"));
    await assert.rejects(decodeMunicipio({ "paisId.codigo": "AR", codigo: "99" }), fieldError("estadoId.paisId.codigo + estadoId.codigo"));
    await assert.rejects(decodeMunicipio({ "paisId.codigo": "AR", codigo: "" }), fieldError("estadoId.codigo"));
    assert.equal((await decodeMunicipio({ "paisId.codigo": "", codigo: "" })).estadoId, null, "an all-blank reference explicitly clears");
    const encodedMunicipio = await prisma.$transaction(tx => encodeTransferValues(tx, actor, municipioEntry, municipioSpec, { estadoId: stateCY.id, codigo: "001", name: "Municipio piloto", active: true }));
    assert.deepEqual(encodedMunicipio.values, { "estadoId.paisId.codigo": "CY", "estadoId.codigo": "01", codigo: "001", name: "Municipio piloto", active: true });
    assert.deepEqual(encodedMunicipio.references.map(reference => reference.model), ["ubicaciones.estado", "ubicaciones.pais"], "every hop is signed");
    if (municipioEnabled) {
      const municipioCsv = (text: string) => reviewTransfer(prisma, actor, municipioModel, "municipio.csv", Buffer.from(text));
      const header = "estadoId.paisId.codigo,estadoId.codigo,codigo,name,active";
      const municipios = `${header}\nar,01,001,Municipio AR,true\nCY,01,001,Municipio CY,true`;
      const municipioPlan = await municipioCsv(municipios);
      assert.ok(municipioPlan.token, JSON.stringify(municipioPlan));
      assert.deepEqual(await applyTransfer(prisma, actor, municipioModel, municipioPlan.token!), { created: 2, updated: 0, unchanged: 0 });
      assert.equal(await prisma.ubicacionesMunicipio.count({ where: { codigo: "001", estadoId: { in: [arState.id, stateCY.id] } } }), 2, "codes repeat across states");
      const repeatedMunicipios = await municipioCsv(municipios);
      assert.deepEqual(await applyTransfer(prisma, actor, municipioModel, repeatedMunicipios.token!), { created: 0, updated: 0, unchanged: 2 });
      for (const format of ["csv", "xlsx"] as const) {
        const file = await exportTransfer(prisma, actor, municipioModel, { format, state: { ...state, query: "Municipio" }, selection: [], template: false });
        const bytes = Buffer.from(file.base64, "base64");
        assert.deepEqual((await readTransferFile(file.name, bytes))[0], header.split(","));
        const reimport = await reviewTransfer(prisma, actor, municipioModel, file.name, bytes);
        assert.ok(reimport.token && reimport.rows.every(row => row.operation === "unchanged"), JSON.stringify(reimport));
      }
      // estadoId belongs to the key: every one of its columns is a required header.
      await assert.rejects(municipioCsv("estadoId.codigo,codigo,name\n01,002,Sin país"), /incluye estadoId\.paisId\.codigo, estadoId\.codigo, codigo/);
      const missingState = await municipioCsv(`${header}\nAR,99,002,Sin estado,true`);
      assert.equal(missingState.token, undefined); assert.ok(missingState.rows[0].errors?.["estadoId.paisId.codigo + estadoId.codigo"], JSON.stringify(missingState));
      const stalePlan = await municipioCsv(`${header}\nAR,01,003,Municipio tardío,true`);
      assert.ok(stalePlan.token, JSON.stringify(stalePlan));
      const arDocument = await modelService(stateModel).read(prisma, actor, arState.id); assert.ok(arDocument.ok);
      assert.ok((await modelService(stateModel).save(prisma, actor, { ...arDocument.values, codigo: "09" })).ok);
      await assert.rejects(applyTransfer(prisma, actor, municipioModel, stalePlan.token!), /Fila 2/);
      assert.equal(await prisma.ubicacionesMunicipio.count({ where: { codigo: "003" } }), 0);
      const restored = await modelService(stateModel).read(prisma, actor, arState.id); assert.ok(restored.ok);
      assert.ok((await modelService(stateModel).save(prisma, actor, { ...restored.values, codigo: "01" })).ok);
      console.log("✓ Municipio: Estado by País+código (two hops), repeated codes across states, Excel+CSV reimport, partial/missing references and stale state keys.");
    } else console.log("• Municipio aún sin transfer en su manifest: sólo se verificó la resolución por saltos (decode/encode).");

    // A state remains an owned line: the importer must not bypass the parent's write access.
    await setModelAccess(prisma, actor, "core.internal", new Map([
      [model, { read: true, create: false, write: false, unlink: false }],
      [stateModel, { read: true, create: true, write: true, unlink: false, import: true, export: true }],
    ]));
    const deniedParent = await stateCsv("paisId.codigo,codigo,name\nAR,03,Piloto sin acceso al padre", other);
    assert.equal(deniedParent.token, undefined);
    await setModelAccess(prisma, actor, "core.internal", new Map([[model, { read: true, create: false, write: true, unlink: false }]]));
    const allowedState = await stateCsv("paisId.codigo,codigo,name\nAR,03,Piloto autorizado", other);
    assert.ok(allowedState.token, JSON.stringify(allowedState));
    await setModelAccess(prisma, actor, "core.internal", new Map([[model, { read: true, create: false, write: false, unlink: false }]]));
    await assert.rejects(applyTransfer(prisma, other, stateModel, allowedState.token!), /permiso/);
    assert.equal(await prisma.ubicacionesEstado.count({ where: { paisId: countryAR.id, codigo: "03" } }), 0);
    await setModelAccess(prisma, actor, "core.internal", new Map([[model, { read: false, create: false, write: false, unlink: false }]]));
    await assert.rejects(stateCsv("paisId.codigo,codigo,name\nAR,03,No legible", other), /permiso/);
    await assert.rejects(decodeMunicipio({ "paisId.codigo": "AR", codigo: "01" }, other), /permiso/, "each hop applies the destination's read access");
    console.log("✓ Estado: composite DB uniqueness, external country keys, siblings in one batch, owner revisions/permissions, Excel+CSV reimport, duplicate/missing references and renamed/reassigned country keys.");
    await prisma.user.update({ where: { id: reader.id }, data: { active: false } });
    await assert.rejects(exportTransfer(prisma, other, model, { format: "csv", state, selection: [], template: false }), /sesión/);
    console.log("✓ List transfer: preview without writes, normalized keys, create/update/noop, owned states, rollback, stale/replayed/forged plans, Excel/CSV, filters/selection, permissions and revocation.");
  } finally { await prisma.$disconnect(); }
}

if (process.argv[2] === "--worker") {
  await worker(process.argv[3]);
} else {
  const variables = parse(await readFile(".env.local"));
  const connection = process.env.DATABASE_URL ?? variables.DATABASE_URL;
  if (!connection) throw new Error("Configura la conexión de desarrollo para la prueba aislada.");
  const schema = `list_transfer_test_${randomBytes(8).toString("hex")}`;
  const url = new URL(connection); url.searchParams.set("schema", schema);
  const database = new Client({ connectionString: connection });
  const sanitize = (value: string) => value.replaceAll(url.toString(), "[test database]").replaceAll(connection, "[database]");
  let created = false;
  try {
    await database.connect();
    await database.query(`CREATE SCHEMA "${schema}"`); created = true;
    const env = { ...process.env, DATABASE_URL: url.toString() };
    for (const args of [["node_modules/prisma/build/index.js", "migrate", "deploy", "--config", "prisma7.config.ts"], ["--conditions=react-server", "--import", "tsx", "scripts/list-transfer.integration.ts", "--worker", schema]]) {
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
