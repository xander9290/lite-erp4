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
import core from "../core/manifest";
import { User } from "../core/models/user";

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
  assert.deepEqual((calls[0][1].select as Record<string, unknown>).soporteBasexEquipoRecordIdRecords, { select: { id: true, responsable: true, nivel: true } });
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
  assert.throws(() => declare({ insertions: { pivot: loader } }), /insertions sólo registra form, modal, list, card o kanban/);
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

test("Many2many in extensions: companion link table, composition rules and repository writes", async () => {
  class Marca extends Model { name = Fields.Text({ label: "Nombre", required: true }); }
  const ExtraTags = extendModel(Equipo, Base => class extends Base {
    marcas = Fields.Many2many("EtiquetasMarca", { label: "Marcas", maxSelected: 3 });
  });
  const etiquetas = defineModule({ id: "etiquetas", name: "Etiquetas", icon: "tag", depends: ["basex"], models: { marca: Marca }, extends: { "basex.equipo": ExtraTags } });
  // An extension with only Many2many is valid; its links belong to the companion model.
  const [extension] = etiquetas.extensions;
  assert.deepEqual(extension.fields, []);
  assert.deepEqual(extension.many2many, ["marcas"]);
  const companion = etiquetas.profile.module.models.find(model => model.model.name === "EtiquetasBasexEquipo")!;
  assert.deepEqual(Object.keys(companion.model.many2manyFields ?? {}), ["marcas"]);
  const schema = ["datasource db {", '  provider = "postgresql"', "}", "", "model User {", "  id String @id @default(cuid())", "}", "", "model BasexEquipo {", "  id String @id @default(cuid())", "  name String", '  @@map("basex_equipo")', "}", ""].join(String.fromCharCode(10));
  const files = generateModule(etiquetas.profile.module, { schema, owners: { BasexEquipo: "basex" } });
  const prisma = files["models.prisma"];
  assert.ok(prisma.includes("model EtiquetasBasexEquipoMarcasLink {"));
  assert.ok(prisma.includes('source EtiquetasBasexEquipo @relation("EtiquetasBasexEquipoMarcasLink_source", fields: [sourceId], references: [id], onDelete: Cascade)'));
  assert.ok(prisma.includes('target EtiquetasMarca @relation("EtiquetasBasexEquipoMarcasLink_target", fields: [targetId], references: [id], onDelete: Restrict)'));
  assert.ok(prisma.includes('@@map("etiquetas_basex_equipo_marcas_rel")'));

  const equipo = composeModules([base, etiquetas])[0].models[0];
  assert.deepEqual(Object.keys(equipo.contract.many2manyFields), ["marcas"]);
  assert.deepEqual(equipo.extensions[0].many2many, [{ field: "marcas", source: "etiquetasBasexEquipoMarcasLinkSourceRecords", maximum: 3 }]);
  assert.deepEqual((equipo.contract.createDefaults() as Record<string, unknown>).marcas, []);

  // Repository: links travel inside the companion row, in the same statement.
  const calls: [string, Record<string, unknown>][] = [];
  const updatedAt = new Date("2026-11-20T10:00:00.000Z");
  const companionRow = (ids: string[]) => ({ id: "c1", etiquetasBasexEquipoMarcasLinkSourceRecords: ids.map(targetId => ({ targetId })) });
  const delegate = {
    findMany: async () => [],
    findUnique: async (args: Record<string, unknown>) => { calls.push(["findUnique", args]); return (args.where as { id: string }).id === "viejo" ? { id: "viejo", updatedAt, name: "A", estado: "activo", etiquetasBasexEquipoRecordIdRecords: null } : { id: "e1", updatedAt, name: "B", estado: "activo", etiquetasBasexEquipoRecordIdRecords: companionRow(["m1", "m2"]) }; },
    create: async (args: Record<string, unknown>) => { calls.push(["create", args]); return { id: "n1", updatedAt, name: "C", estado: "activo", etiquetasBasexEquipoRecordIdRecords: companionRow(["m1"]) }; },
    update: async (args: Record<string, unknown>) => { calls.push(["update", args]); return { id: "e1", updatedAt, name: "B", estado: "activo", etiquetasBasexEquipoRecordIdRecords: companionRow([]) }; },
  };
  const tx = { basexEquipo: delegate } as never;
  const repository = createRepository(equipo, base.profile.module);
  assert.deepEqual((await repository.read(tx, "viejo") as Record<string, unknown>).marcas, [], "sin fila compañera: sin vínculos");
  assert.deepEqual((await repository.read(tx, "e1") as Record<string, unknown>).marcas, ["m1", "m2"]);
  assert.deepEqual((calls[0][1].select as Record<string, unknown>).etiquetasBasexEquipoRecordIdRecords, { select: { id: true, etiquetasBasexEquipoMarcasLinkSourceRecords: { select: { targetId: true }, orderBy: { targetId: "asc" }, take: 4 } } });
  await repository.create(tx, { name: "C", estado: "activo", marcas: ["m1"] } as never, "u1");
  assert.deepEqual(calls[2][1].data, { name: "C", estado: "activo", createBy: "u1", etiquetasBasexEquipoRecordIdRecords: { create: { etiquetasBasexEquipoMarcasLinkSourceRecords: { create: [{ targetId: "m1" }] }, createBy: "u1" } } });
  await repository.update(tx, "e1", updatedAt.toISOString(), { name: "B", estado: "activo", marcas: [] } as never);
  assert.deepEqual((calls[3][1].data as Record<string, unknown>).etiquetasBasexEquipoRecordIdRecords, { upsert: {
    create: { etiquetasBasexEquipoMarcasLinkSourceRecords: { create: [] } },
    update: { etiquetasBasexEquipoMarcasLinkSourceRecords: { deleteMany: {}, create: [] } },
  } });
  // No base Many2many relation is written for extension fields.
  assert.equal(Object.keys(calls[3][1].data as object).some(key => key.startsWith("basexEquipoMarcas")), false);

  // Rules: names, target dependency, limit of four and custom repositories.
  const spec = { id: "etiquetas", name: "Etiquetas", icon: "tag", depends: ["basex"], models: { marca: Marca } };
  assert.throws(() => defineModule({ ...spec, extends: { "basex.equipo": extendModel(Equipo, Base => class extends Base { name = Fields.Many2many("EtiquetasMarca", { label: "X" }) as never; }) } }), /ya declara/);
  const ajeno = defineModule({ ...spec, models: {}, extends: { "basex.equipo": extendModel(Equipo, Base => class extends Base { otras = Fields.Many2many("OtroModelo", { label: "X" }); }) } });
  assert.throws(() => composeModules([base, ajeno]), /Many2many requiere un destino declarativo registrado/);
  const cinco = defineModule({ ...spec, extends: { "basex.equipo": extendModel(Equipo, Base => class extends Base {
    a = Fields.Many2many("EtiquetasMarca", { label: "A" }); b = Fields.Many2many("EtiquetasMarca", { label: "B" }); c = Fields.Many2many("EtiquetasMarca", { label: "C" }); d = Fields.Many2many("EtiquetasMarca", { label: "D" }); e = Fields.Many2many("EtiquetasMarca", { label: "E" });
  }) } });
  assert.throws(() => composeModules([base, cinco]), /máximo cuatro relaciones Many2many/);
  // core.user writes through its own repository: Many2many extensions are rejected clearly.
  const sobreUsuario = defineModule({ id: "etiquetas", name: "Etiquetas", icon: "tag", models: { marca: Marca }, extends: { "core.user": extendModel(User, Base => class extends Base { marcas = Fields.Many2many("EtiquetasMarca", { label: "Marcas" }); }) } });
  assert.throws(() => composeModules([core, sobreUsuario]), /repositorio propio/);
});

test("drawer option of a module reaches its application manifest", () => {
  class Etiqueta extends Model { name = Fields.Text({ label: "Nombre", required: true }); }
  const hidden = defineModule({ id: "etiquetas", name: "Etiquetas", icon: "tag", models: { etiqueta: Etiqueta }, drawer: false });
  assert.equal(hidden.application.drawer, false);
  assert.equal(defineModule({ id: "visible", name: "Visible", icon: "tag", models: { etiqueta: Etiqueta } }).application.drawer, undefined);
});

test("Many2many collection predicates and page IDs: own links and links through the companion row", async () => {
  class Marca extends Model { name = Fields.Text({ label: "Nombre", required: true }); }
  const ExtraTags = extendModel(Equipo, Base => class extends Base { marcas = Fields.Many2many("EtiquetasMarca", { label: "Marcas", maxSelected: 3 }); });
  const etiquetas = defineModule({ id: "etiquetas", name: "Etiquetas", icon: "tag", depends: ["basex"], models: { marca: Marca }, extends: { "basex.equipo": ExtraTags } });
  const equipo = composeModules([base, etiquetas])[0].models[0];
  const repository = createRepository(equipo, base.profile.module);
  const via = (predicate: unknown) => ({ etiquetasBasexEquipoRecordIdRecords: { is: { etiquetasBasexEquipoMarcasLinkSourceRecords: predicate } } });
  assert.deepEqual(repository.many2manyWhere!("marcas", "any", ["m1", "m2"]), via({ some: { targetId: { in: ["m1", "m2"] } } }));
  assert.deepEqual(repository.many2manyWhere!("marcas", "all", ["m1", "m2"]), { AND: [via({ some: { targetId: "m1" } }), via({ some: { targetId: "m2" } })] });
  assert.deepEqual(repository.many2manyWhere!("marcas", "notEmpty", []), via({ some: {} }));
  // A record without a companion row has no links: it counts as empty.
  assert.deepEqual(repository.many2manyWhere!("marcas", "empty", []), { OR: [{ etiquetasBasexEquipoRecordIdRecords: { is: null } }, via({ none: {} })] });
  assert.throws(() => repository.many2manyWhere!("name", "any", ["x"]), /no está publicada/);
  const tx = { basexEquipo: { findMany: async (args: Record<string, unknown>) => {
    assert.deepEqual(args, { where: { id: { in: ["e1", "e2"] } }, select: { id: true, etiquetasBasexEquipoRecordIdRecords: { select: { etiquetasBasexEquipoMarcasLinkSourceRecords: { select: { targetId: true }, orderBy: { targetId: "asc" } } } } } });
    return [{ id: "e1", etiquetasBasexEquipoRecordIdRecords: { etiquetasBasexEquipoMarcasLinkSourceRecords: [{ targetId: "m1" }] } }, { id: "e2", etiquetasBasexEquipoRecordIdRecords: null }];
  } } } as never;
  const ids = await repository.many2manyIds!(tx, "marcas", ["e1", "e2"]);
  assert.deepEqual([...ids], [["e1", ["m1"]], ["e2", []]]);
});
