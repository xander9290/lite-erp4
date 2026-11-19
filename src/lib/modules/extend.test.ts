import assert from "node:assert/strict";
import { test } from "node:test";
import { Fields, Model, ModelValidationError, action, depends } from "../orm";
import type { ReactionValues } from "../orm";
import { defineModule } from "./define";
import { composeModules } from "./compose";
import { extendModel } from "./extend";
import { createRepository } from "./repository";
import { generateModule } from "../orm/generator/generate";
import type { ModelContext } from "../orm/context";

class Equipo extends Model {
  name = Fields.Text({ label: "Nombre", required: true, maxLength: 80 });
  estado = Fields.Selection([{ value: "activo", label: "Activo" }, { value: "baja", label: "Baja" }], { label: "Estado", required: true, default: "activo" });
  beforeSave(values: Record<string, unknown>): Record<string, unknown> {
    return { ...values, name: String(values.name).toUpperCase() };
  }
}
const base = defineModule({ id: "basex", name: "Base", icon: "box", models: { equipo: Equipo } });

// Legacy decorators need a class declaration: name the class inside the mixin.
const EquipoSoporte = extendModel(Equipo, Base => {
  class EquipoSoporte extends Base {
  responsable = Fields.Text({ label: "Responsable", maxLength: 60, tracking: true });
  nivel = Fields.Integer({ label: "Nivel", required: true, default: 1, min: 1, max: 3 });
  etiqueta = Fields.Text({ label: "Etiqueta", compute: "calcularEtiqueta" });

  @depends("nivel")
  calcularEtiqueta(values: ReactionValues) { return `N${values.nivel}`; }

  @action({ label: "Escalar" })
  escalar(record: { nivel: number }) { return { nivel: Math.min(3, record.nivel + 1) }; }

  beforeSave(values: Record<string, unknown>) {
    const result = super.beforeSave(values);
    if (result.estado === "baja" && !result.responsable) throw new ModelValidationError("Asigna un responsable.", { responsable: "Requerido para dar de baja." });
    return result;
  }
  }
  return EquipoSoporte;
});
const soporte = defineModule({ id: "soporte", name: "Soporte", icon: "life-buoy", depends: ["basex"], models: {}, extends: { "basex.equipo": EquipoSoporte } });

test("an extension compiles to a companion model owned by the extending module", () => {
  const [extension] = soporte.extensions;
  assert.equal(extension.target, "basex.equipo");
  assert.deepEqual(extension.fields, ["responsable", "nivel"]);
  assert.deepEqual(extension.computed, ["etiqueta"]);
  assert.deepEqual(extension.companion, { name: "SoporteBasexEquipo", table: "soporte_basex_equipo", relation: "soporteBasexEquipoRecordIdRecords" });
  const [companion] = soporte.profile.module.models;
  assert.equal(companion.model.name, "SoporteBasexEquipo");
  assert.deepEqual(Object.keys(companion.model.metadata), ["recordId", "responsable", "nivel"]);
  assert.deepEqual(companion.model.metadata.recordId, { ...companion.model.metadata.recordId, kind: "many2one", target: "BasexEquipo", required: true, unique: true, onDelete: "Cascade" });
  assert.equal(soporte.models.length, 0);
  assert.deepEqual(soporte.application.depends, ["basex"]);
});

test("the companion schema links 1:1 to the base record and deletes with it", () => {
  const schema = `datasource db {\n  provider = "postgresql"\n}\n\nmodel User {\n  id String @id @default(cuid())\n}\n\nmodel BasexEquipo {\n  id String @id @default(cuid())\n  name String\n  @@map("basex_equipo")\n}\n`;
  const files = generateModule(soporte.profile.module, { schema, owners: { BasexEquipo: "basex" } });
  assert.match(files["models.prisma"], /recordId String @unique @map\("record_id"\)/);
  assert.match(files["models.prisma"], /record BasexEquipo @relation\("SoporteBasexEquipo_recordId", fields: \[recordId\], references: \[id\], onDelete: Cascade\)/);
  assert.match(files["models.prisma"], /@@map\("soporte_basex_equipo"\)/);
  const review = JSON.parse(files["review.json"]) as { relations: { target: string; declaration: string; owner: string }[] };
  assert.ok(review.relations.some(relation => relation.target === "BasexEquipo" && relation.owner === "basex" && /soporteBasexEquipoRecordIdRecords SoporteBasexEquipo\? /.test(relation.declaration)));
});

test("the registry composes extension fields, super hooks, decorators and collections", async () => {
  const [, composed] = composeModules([base, soporte]);
  assert.equal(composed, soporte);
  const equipo = composeModules([base, soporte])[0].models[0];
  assert.deepEqual(Object.keys(equipo.metadata), ["name", "estado", "responsable", "nivel"]);
  assert.deepEqual(equipo.extensions, [{ module: "soporte", label: "Soporte", fields: ["responsable", "nivel"], computed: ["etiqueta"], depends: ["basex"], relation: "soporteBasexEquipoRecordIdRecords", delegate: "soporteBasexEquipo" }]);
  assert.deepEqual(equipo.list.fields, ["name", "estado", "responsable", "nivel", "etiqueta"]);
  assert.deepEqual(equipo.contract.actions.map(item => item.name), ["escalar"]);
  assert.equal((equipo.contract.createDefaults() as Record<string, unknown>).nivel, 1);
  const context = { operation: "update", id: "e1", previous: null } as unknown as ModelContext;
  const saved = await equipo.contract.beforeSave({ name: "taladro", estado: "activo", responsable: null, nivel: 2 } as never, context as never);
  assert.equal((saved as Record<string, unknown>).name, "TALADRO");
  await assert.rejects(equipo.contract.beforeSave({ name: "x", estado: "baja", responsable: null, nivel: 1 } as never, context as never), /responsable/);
  assert.equal(base.models[0].metadata.responsable, undefined, "the declaring module stays untouched");
});

test("extension declarations are validated", () => {
  const spec = { id: "soporte", name: "Soporte", icon: "life-buoy", depends: ["basex"], models: {} };
  assert.throws(() => defineModule({ ...spec, depends: [], extends: { "basex.equipo": EquipoSoporte } }), /depends/);
  assert.throws(() => defineModule({ ...spec, extends: { "basex.equipo": extendModel(Equipo, Base => class extends Base { name = Fields.Text({ label: "Otro", required: true }); }) } }), /ya declara/);
  assert.throws(() => defineModule({ ...spec, extends: { "basex.equipo": extendModel(Equipo, Base => class extends Base { codigo = Fields.Text({ label: "Código", required: true }); }) } }), /necesita default/);
  assert.throws(() => defineModule({ ...spec, extends: { "basex.equipo": extendModel(Equipo, Base => class extends Base { recordId = Fields.Text({ label: "X" }); }) } }), /reservado/);
  assert.throws(() => defineModule({ ...spec, extends: { "basex.equipo": extendModel(Equipo, Base => class extends Base { codigo = Fields.Text({ label: "X", unique: true, default: "duplicado" }); }) } }), /opcional sin default/);
  assert.throws(() => defineModule({ ...spec, extends: { "basex.equipo": extendModel(Equipo, Base => class extends Base { beforeSave(values: Record<string, unknown>) { return super.beforeSave(values); } }) } }), /persistente/);
  assert.throws(() => defineModule({ ...spec, extends: { "basex.equipo": Equipo as never } }), /extendModel/);
  class Otro extends Model { name = Fields.Text({ label: "Nombre" }); }
  const wrong = defineModule({ ...spec, extends: { "basex.equipo": extendModel(Otro, Base => class extends Base { extra = Fields.Text({ label: "Extra" }); }) } });
  assert.throws(() => composeModules([base, wrong]), /clase registrada/);
  assert.throws(() => composeModules([soporte]), /no está registrado/);
});

test("several extensions compose in dependency order and cannot declare the same field", () => {
  const segunda = defineModule({ id: "auditoria", name: "Auditoría", icon: "eye", depends: ["soporte", "basex"], models: {}, extends: { "basex.equipo": extendModel(Equipo, Base => class extends Base {
    revisado = Fields.Boolean({ label: "Revisado", default: false });
    beforeSave(values: Record<string, unknown>) { return { ...super.beforeSave(values), revisado: true }; }
  }) } });
  // Declared in reverse order; the depth of dependencies decides: soporte first, then auditoria.
  const equipo = composeModules([segunda, soporte, base])[2].models[0];
  assert.deepEqual(equipo.extensions.map(extension => extension.module), ["soporte", "auditoria"]);
  assert.deepEqual(Object.keys(equipo.metadata), ["name", "estado", "responsable", "nivel", "revisado"]);
  const duplicada = defineModule({ id: "otra", name: "Otra", icon: "eye", depends: ["basex"], models: {}, extends: { "basex.equipo": extendModel(Equipo, Base => class extends Base { nivel = Fields.Integer({ label: "Nivel" }); }) } });
  assert.throws(() => composeModules([base, soporte, duplicada]), /lo declaran/);
});

test("the repository reads and writes companion fields in the same statement and revision", async () => {
  const equipo = composeModules([base, soporte])[0].models[0];
  const calls: [string, Record<string, unknown>][] = [];
  const updatedAt = new Date("2026-11-17T10:00:00.000Z");
  const rows: Record<string, Record<string, unknown> | null> = {
    legacy: { id: "legacy", updatedAt, name: "VIEJO", estado: "activo", soporteBasexEquipoRecordIdRecords: null },
  };
  const delegate = {
    findMany: async () => [],
    findUnique: async (args: Record<string, unknown>) => { calls.push(["findUnique", args]); return rows[(args.where as { id: string }).id] ?? null; },
    create: async (args: Record<string, unknown>) => { calls.push(["create", args]); return { id: "n1", updatedAt, name: "NUEVO", estado: "activo", soporteBasexEquipoRecordIdRecords: { responsable: "Ana", nivel: 2 } }; },
    update: async (args: Record<string, unknown>) => { calls.push(["update", args]); return { id: "legacy", updatedAt, name: "VIEJO", estado: "baja", soporteBasexEquipoRecordIdRecords: { responsable: "Luis", nivel: 3 } }; },
  };
  const tx = { basexEquipo: delegate } as never;
  const repository = createRepository(equipo, base.profile.module);
  // A record saved before the extension was installed has no companion row: defaults.
  assert.deepEqual(await repository.read(tx, "legacy"), { id: "legacy", revision: updatedAt.toISOString(), name: "VIEJO", estado: "activo", responsable: null, nivel: 1 });
  assert.deepEqual((calls[0][1].select as Record<string, unknown>).soporteBasexEquipoRecordIdRecords, { select: { responsable: true, nivel: true } });
  const created = await repository.create(tx, { name: "NUEVO", estado: "activo", responsable: "Ana", nivel: 2 } as never, "u1");
  assert.equal((created as Record<string, unknown>).responsable, "Ana");
  assert.deepEqual(calls[1][1].data, { name: "NUEVO", estado: "activo", createBy: "u1", soporteBasexEquipoRecordIdRecords: { create: { responsable: "Ana", nivel: 2, createBy: "u1" } } });
  await repository.update(tx, "legacy", updatedAt.toISOString(), { name: "VIEJO", estado: "baja", responsable: "Luis", nivel: 3 } as never);
  const update = calls[2][1] as { where: unknown; data: Record<string, unknown> };
  assert.deepEqual(update.where, { id: "legacy", updatedAt });
  assert.deepEqual(update.data.soporteBasexEquipoRecordIdRecords, { upsert: { create: { responsable: "Luis", nivel: 3 }, update: { responsable: "Luis", nivel: 3 } } });
  assert.equal(update.data.name, "VIEJO");
  assert.ok(update.data.updatedAt instanceof Date);
});

test("insertions: deferred loaders per view, form exclusive with views.form, transitive depends published", () => {
  const loader = async () => ({ default: () => null });
  const Extra = extendModel(Equipo, Base => class extends Base { serie = Fields.Text({ label: "Serie" }); });
  const declare = (spec: Record<string, unknown>) => defineModule({ id: "inserta", name: "Inserta", icon: "eye", depends: ["soporte", "basex"], models: {}, extends: { "basex.equipo": { model: Extra, ...spec } as never } });
  assert.throws(() => declare({ insertions: { pivot: loader } }), /insertions sólo registra form, list, card o kanban/);
  assert.throws(() => declare({ insertions: { list: "./views/Lista" } }), /loader diferido/);
  // Collection insertions are compatible with a whole-block views.form.
  assert.equal(declare({ insertions: { list: loader, kanban: loader }, views: { form: loader } }).extensions[0].insertions?.list, loader);
  assert.throws(() => declare({ insertions: {} }), /insertions sólo registra form/);
  assert.throws(() => declare({ insertions: { form: loader }, views: { form: loader } }), /usa sólo uno/);
  const inserta = declare({ insertions: { form: loader } });
  assert.equal(inserta.extensions[0].insertions?.form, loader);
  const equipo = composeModules([inserta, soporte, base])[2].models[0];
  const info = equipo.extensions.find(extension => extension.module === "inserta");
  assert.equal(info?.insertions?.form, loader);
  assert.deepEqual(info?.depends, ["basex", "soporte"]);
  assert.deepEqual(equipo.extensions.find(extension => extension.module === "soporte")?.depends, ["basex"]);
});
