import assert from "node:assert/strict";
import test from "node:test";
import { availableCollectionViews, collectionViewHref, selectedCollectionView, collectionFieldMetadata, type ModelClientConfig } from "./config";
import { modelCollection } from "./collection";
import { defineModule } from "./define";
import unit, { Categoria, Tarea } from "./module.fixture";
import { Model, depends, type ReactionValues } from "../orm/index";
import { Fields } from "../orm/fields";
import { readListState } from "../list/state";
import { projectModelAccess } from "./access";

const task = unit.models[0];
const config: ModelClientConfig = {
  id: task.id, module: "unit", moduleName: "Unit", key: task.key, name: task.contract.name, label: task.label, route: task.route,
  fields: task.metadata, preview: { logo: Fields.Image({ related: "categoria.logo" }).metadata }, related: ["logo"], reactionRules: [], lookups: {}, actions: [],
  list: { ...task.list, fields: [...task.list.fields, "logo"], sortable: task.list.sortable ?? [], filterable: task.list.filterable ?? [], groupable: task.list.groupable ?? [] },
  view: "list", kanban: "estado",
};

test("sequence fields support search, filters and sorting in the shared collection", () => {
  class Folio extends Model { name = Fields.Text({ sequence: { prefix: "TCK-" } }); }
  const entry = defineModule({ id: "folios", name: "Folios", icon: "boxes", models: { folio: Folio } }).models[0];
  const source = modelCollection({ ...config, fields: entry.metadata, preview: {}, related: [], list: {
    fields: entry.list.fields, searchFields: entry.list.searchFields,
    sortable: entry.list.sortable ?? [], filterable: entry.list.filterable ?? [], groupable: entry.list.groupable ?? [],
  }, kanban: undefined });
  assert.deepEqual(source.common.searchFields, ["name"]);
  assert.equal(source.columns[0].sortable, true);
  assert.equal(source.columns[0].filterable, true);
});

test("actor config filters actions and graph without mutating definitions or granting a fallback move", () => {
  const declarations = [{ name: "start", label: "Iniciar" }, { name: "finish", label: "Finalizar", groups: ["private"] }];
  const graph = [{ from: "pendiente", to: "curso", action: "start" }, { from: "curso", to: "hecha", action: "finish" }];
  const base = { ...config, actions: declarations, kanbanTransitions: graph.map(({ from, to }) => ({ from, to })) };
  const actor = { isAdmin: false, groups: new Set<string>(), modelAccess: { [config.id]: { read: true, write: true, create: false, unlink: true } } };
  const writer = projectModelAccess(base, actor, declarations, graph);
  assert.deepEqual(writer.actions, [{ name: "start", label: "Iniciar" }]);
  assert.deepEqual(writer.kanbanTransitions, [{ from: "pendiente", to: "curso" }]);
  assert.equal(writer.capabilities?.move, true);
  assert.equal(writer.capabilities?.create, false);
  assert.equal(writer.capabilities?.unlink, true);
  assert.equal(JSON.stringify(writer).includes('"groups"'), false);
  const reader = projectModelAccess(base, { ...actor, modelAccess: { [config.id]: { ...actor.modelAccess[config.id], write: false } } }, declarations, graph);
  assert.deepEqual(reader.actions, []);
  assert.deepEqual(reader.kanbanTransitions, []);
  assert.equal(reader.capabilities?.move, false);
  assert.equal(base.kanbanTransitions.length, 2);
  assert.equal(projectModelAccess(config, actor, declarations).capabilities?.move, true, "legacy direct moves still require write");
  assert.equal(projectModelAccess(base, { ...actor, modelAccess: {} }, declarations, graph).capabilities?.read, false);
});

test("collection source separates display columns from shared query capabilities and kanban paging", () => {
  const source = modelCollection(config, [{ field: "name" }, { field: "logo", widget: "image" }]);
  assert.deepEqual(source.columns.map(column => column.field), ["name", "logo"]);
  assert.ok(source.queryColumns.some(column => column.field === "prioridad" && column.sortable));
  assert.equal(source.columns[1].sortable, false);
  assert.equal(source.columns[1].filterable, false);
  assert.equal(source.common.createHref, "/erp/unit/tarea/nuevo");
  assert.equal(source.common.recordHref, "/erp/unit/tarea/{id}");
  assert.equal(source.kanban?.groupField, "estado");
  assert.deepEqual(source.kanban?.groups.map(group => group.value), ["pendiente", "curso", "hecha"]);
  const state = readListState({ model: config.name, columns: source.queryColumns, searchFields: config.list.searchFields }, new URLSearchParams("sort=prioridad&dir=desc"));
  assert.equal(state.sort, "prioridad", "sorting survives a presentation which does not render that field");
  assert.throws(() => modelCollection(config, [{ field: "password" }]), /no está publicada/);
  const restricted = modelCollection({ ...config, list: { ...config.list, sortable: [] } }, [{ field: "name", sortable: true }]);
  assert.equal(restricted.columns[0].sortable, false);
  const presentation = modelCollection(config, [{ field: "name", sortable: false, filterable: false }]);
  assert.equal(presentation.queryColumns.find(column => column.field === "name")?.sortable, false);
  assert.equal(presentation.queryColumns.find(column => column.field === "name")?.filterable, false);
  assert.equal(presentation.queryColumns.find(column => column.field === "prioridad")?.sortable, true);
  assert.throws(() => modelCollection({ ...config, kanban: "name" }), /Selection publicado/);
});

test("registration supports independent lazy/default views, preserves legacy and validates kanban", () => {
  const legacy = availableCollectionViews("list", { list: true }, false);
  assert.deepEqual(legacy, ["list"]);
  assert.equal(selectedCollectionView("kanban", legacy, "list"), "list");
  assert.equal(selectedCollectionView(["card"], ["list", "card"], "list"), "list");
  const loader = async () => { throw new Error("must remain lazy"); };
  const spec = { id: "unit", name: "Unit", icon: "boxes", models: { categoria: Categoria, tarea: { model: Tarea, kanban: "estado", view: "kanban" as const, views: { list: loader, card: true as const, kanban: loader } } } };
  const entry = defineModule(spec).models[1];
  assert.deepEqual(entry.collectionViews, ["list", "card", "kanban"]);
  assert.equal(entry.view, "kanban");
  assert.equal(selectedCollectionView("card", entry.collectionViews, entry.view), "card");
  assert.throws(() => availableCollectionViews("kanban", {}, false), /configuración kanban/);
  assert.throws(() => defineModule({ ...spec, models: { categoria: Categoria, tarea: { model: Tarea, views: { kanban: true } } } }), /configuración kanban/);
  assert.throws(() => defineModule({ ...spec, models: { categoria: Categoria, tarea: { model: Tarea, views: { form: true } as never } } }), /registro de vista inválido/);
});

test("switching keeps search, filters, sorting and unrelated params; resets only its paging and grouping", () => {
  const filters = JSON.stringify([{ field: "active", operator: "eq", value: "true" }]);
  const params = new URLSearchParams({ q: "Corolla", filters, sort: "plate", dir: "desc", size: "25", page: "4", group: '["active"]', other_page: "7" });
  const href = collectionViewHref("/erp/flota/vehicle", params.toString(), "kanban");
  const result = new URL(href, "http://localhost").searchParams;
  for (const key of ["q", "filters", "sort", "dir", "size", "other_page"]) assert.equal(result.get(key), params.get(key));
  assert.equal(result.get("view"), "kanban");
  assert.equal(result.has("page"), false);
  assert.equal(result.has("group"), false);
  const scoped = new URL(collectionViewHref("/sample", "core_page=3&core_group=x&page=8&core_q=foo", "card", "core"), "http://localhost").searchParams;
  assert.equal(scoped.get("core_view"), "card");
  assert.equal(scoped.get("core_q"), "foo");
  assert.equal(scoped.get("page"), "8");
  assert.equal(scoped.has("core_page"), false);
});


test("declared compute is a readonly collection field, while manual previews and unpublished dependencies stay closed", () => {
  class Calc extends Model {
    amount = Fields.Integer({ required: true });
    total = Fields.Integer({ compute: "calculate" });
    privateResult = Fields.Integer({ compute: "other", list: false });
    @depends("amount") calculate(values: ReactionValues) { return values.amount; }
    @depends("amount") other() { return 0; }
  }
  const entry = defineModule({ id: "calc", name: "Calc", icon: "boxes", models: { item: Calc } }).models[0];
  assert.deepEqual(entry.list.fields, ["amount", "total"]);
  assert.ok(!entry.list.filterable?.includes("total"));
  const collection = modelCollection({ ...config, fields: entry.metadata, preview: { total: new Calc().total.metadata, manual: Fields.Integer().metadata }, related: [], list: { ...entry.list, searchFields: [], sortable: ["amount"], filterable: ["amount"], groupable: [] }, kanban: undefined }, [{ field: "amount" }, { field: "total" }]);
  assert.equal(collectionFieldMetadata({ fields: {}, related: [], preview: { manual: Fields.Integer().metadata } }).manual, undefined);
  assert.equal(collection.columns[1].type, "integer");
  assert.equal(collection.columns[1].filterable, false);
  assert.equal(collection.columns[1].sortable, false);
  assert.equal(collection.columns[1].groupable, false);
  assert.throws(() => defineModule({ id: "calc", name: "Calc", icon: "boxes", models: { item: { model: Calc, list: { fields: ["total"], searchFields: [], sortable: [], filterable: [], groupable: [] } } } }), /dependencias/);
});

test("audit: true publishes the creator as a Many2one plus dates; groups by creator, never searches", () => {
  class Nota extends Model {
    name = Fields.Text({ label: "Nombre", required: true });
    estado = Fields.Selection([{ value: "a", label: "A" }], { label: "Estado", required: true, default: "a" });
  }
  const entry = defineModule({ id: "notas", name: "Notas", icon: "boxes", models: { nota: { model: Nota, audit: true } } }).models[0];
  assert.deepEqual(entry.list.fields, ["name", "estado", "createBy", "createdAt", "updatedAt"]);
  assert.ok(["createBy", "createdAt", "updatedAt"].every(name => entry.list.filterable?.includes(name)));
  assert.ok(["createdAt", "updatedAt"].every(name => entry.list.sortable?.includes(name)) && !entry.list.sortable?.includes("createBy"));
  assert.ok(entry.list.groupable?.includes("createBy") && !entry.list.groupable?.includes("createdAt"));
  assert.ok(!entry.list.searchFields.includes("createBy"));
  const audited: ModelClientConfig = { ...config, fields: entry.metadata, preview: {}, related: [], audit: true, kanban: undefined, list: {
    fields: entry.list.fields, searchFields: entry.list.searchFields,
    sortable: entry.list.sortable ?? [], filterable: entry.list.filterable ?? [], groupable: entry.list.groupable ?? [],
  } };
  const source = modelCollection(audited, [{ field: "name" }, { field: "createBy", label: "Autor" }, { field: "createdAt" }]);
  assert.deepEqual(source.columns.slice(1).map(({ field, label, type, widget, sortable, filterable, groupable }) => ({ field, label, type, widget, sortable, filterable, groupable })), [
    { field: "createBy", label: "Autor", type: "text", widget: "many2one", sortable: false, filterable: true, groupable: true },
    { field: "createdAt", label: "Creado el", type: "datetime", widget: undefined, sortable: true, filterable: true, groupable: false },
  ]);
  assert.equal(modelCollection(audited).columns.length, 5, "default presentation includes the audit columns");
  assert.throws(() => modelCollection(audited, [{ field: "createByUser.partner.name" }]), /no está publicada/);
  assert.throws(() => modelCollection(audited, [{ field: "createdAt", type: "text" }]), /auditoría/);
  assert.throws(() => modelCollection({ ...audited, audit: undefined }, [{ field: "createdAt" }]), /no está publicada/);
  // Without audit: true the manifest cannot publish them; createBy is grouped, never sorted or searched.
  assert.throws(() => defineModule({ id: "notas", name: "Notas", icon: "boxes", models: { nota: { model: Nota, list: { fields: ["name", "createdAt"] } } } }), /audit: true/);
  assert.throws(() => defineModule({ id: "notas", name: "Notas", icon: "boxes", models: { nota: { model: Nota, audit: true, list: { groupable: ["createdAt"] } } } }), /no se busca/);
  assert.throws(() => defineModule({ id: "notas", name: "Notas", icon: "boxes", models: { nota: { model: Nota, audit: true, list: { sortable: ["createBy"] } } } }), /createByUser.partner.name/);
  // Explicit list.fields decide placement, including the optional creator name column.
  const placed = defineModule({ id: "notas", name: "Notas", icon: "boxes", models: { nota: { model: Nota, audit: true, list: { fields: ["createdAt", "name", "createByUser.partner.name"] } } } }).models[0];
  assert.deepEqual(placed.list.fields, ["createdAt", "name", "createByUser.partner.name"]);
  assert.deepEqual(placed.list.sortable, ["name", "createByUser.partner.name", "createdAt"]);
});

test("Many2many columns are tags: filterable by membership, never sorted or grouped", () => {
  const tagged: ModelClientConfig = { ...config, lookups: { ...config.lookups, tags: "unit.etiqueta" }, many2many: { tags: { target: "UnitEtiqueta", label: "Etiquetas", minSelected: 0, maxSelected: 20 } } };
  const declared = modelCollection(tagged, [{ field: "name" }, { field: "tags" }]);
  const tags = declared.columns.find(column => column.field === "tags")!;
  assert.equal(tags.widget, "tags");
  assert.equal(tags.label, "Etiquetas");
  assert.equal(tags.filterable, true);
  assert.equal(tags.sortable, false);
  assert.equal(tags.groupable, false);
  assert.ok(declared.queryColumns.some(column => column.field === "tags"), "declared tag columns stay available to the filter toolbar");
  // Without declared columns they follow the published ones while there is room (12 at most).
  const derived = modelCollection(tagged);
  assert.equal(derived.columns.at(-1)?.field, "tags");
  assert.ok(derived.columns.length <= 12);
  assert.equal(modelCollection(tagged, [{ field: "tags", label: "Marcas" }]).columns[0].label, "Marcas");
});
