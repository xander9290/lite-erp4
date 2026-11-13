import assert from "node:assert/strict";
import { test } from "node:test";
import { Fields, Model } from "../orm";
import { defineModule, derivedListPolicy } from "./define";
import { fieldFromMetadata } from "./fields";
import { modelIdPattern } from "./config";
import demo from "../../modules/demo/manifest";
import { closeGroups } from "../access/engine";

class Etiqueta extends Model {
  name = Fields.Text({ required: true, maxLength: 40 });
  secreto = Fields.Text({ sensitive: true });
}

test("defineModule deriva nombres, tablas, rutas, delegates y perfil desde las claves", () => {
  const [tarea, categoria] = demo.models;
  assert.equal(tarea.id, "demo.tarea");
  assert.equal(tarea.contract.name, "DemoTarea");
  assert.equal(tarea.contract.table, "demo_tarea");
  assert.equal(tarea.delegate, "demoTarea");
  assert.equal(tarea.route, "/erp/demo/tarea");
  assert.equal(tarea.label, "Tareas");
  assert.equal(categoria.label, "Categorías");
  assert.equal(tarea.kanban, "estado");
  assert.equal(demo.profile.runtime, true);
  assert.equal(demo.icon, "flask-conical");
  assert.deepEqual(demo.profile.module.models.map(model => model.model.name), ["DemoTarea", "DemoCategoria"]);
  assert.deepEqual(demo.application.models, ["DemoTarea", "DemoCategoria"]);
  // With groups, the application and menus are visible to members with read access (presentation only).
  assert.equal(demo.application.access, "authenticated");
  assert.deepEqual(demo.application.groups, ["demo.usuario", "demo.responsable"]);
  assert.deepEqual(demo.application.menus, [
    { id: "tarea-list", label: "Tareas", href: "/erp/demo/tarea", access: "authenticated", groups: ["demo.usuario", "demo.responsable"] },
    { id: "configuracion-group", label: "Configuración", access: "authenticated", groups: ["demo.usuario", "demo.responsable"], items: [{ id: "categoria-list", label: "Categorías", href: "/erp/demo/categoria", access: "authenticated", groups: ["demo.usuario", "demo.responsable"] }] },
  ]);
  // Without groups a module stays admin-only.
  const plain = defineModule({ id: "prueba", name: "Prueba", icon: "flask-conical", models: { etiqueta: Etiqueta } });
  assert.equal(plain.application.access, "admin");
  assert.equal(plain.application.groups, undefined);
});

test("declareAccess normaliza grupos, permisos CRUD y reglas", () => {
  assert.deepEqual(demo.access.groups.map(group => [group.id, group.implies]), [["demo.usuario", []], ["demo.responsable", ["demo.usuario"]]]);
  assert.deepEqual(demo.access.grants.map(grant => [grant.group, grant.model, grant.perms]), [
    ["demo.usuario", "demo.tarea", { read: true, create: true, write: true, unlink: false }],
    ["demo.usuario", "demo.categoria", { read: true, create: false, write: false, unlink: false }],
    ["demo.responsable", "demo.tarea", { read: true, create: true, write: true, unlink: true }],
    ["demo.responsable", "demo.categoria", { read: true, create: true, write: true, unlink: true }],
  ]);
  assert.deepEqual(demo.access.rules.map(rule => [rule.id, rule.models, rule.groups, rule.operations]), [
    ["demo.tareas-propias", ["demo.tarea"], ["demo.usuario"], ["read", "create", "write", "unlink"]],
    ["demo.tareas-todas", ["demo.tarea"], ["demo.responsable"], ["read", "create", "write", "unlink"]],
  ]);
  const base = { id: "prueba", name: "Prueba", icon: "flask-conical", models: { etiqueta: Etiqueta } } as const;
  assert.throws(() => defineModule({ ...base, groups: { "Mal": "x" } }), /clave de grupo inválida/);
  assert.throws(() => defineModule({ ...base, groups: { uno: { label: "Uno", implies: ["dos"] } } }), /grupo no declarado/);
  assert.throws(() => defineModule({ ...base, groups: { uno: "Uno" }, access: [{ group: "dos", models: "etiqueta", perms: "r" }] }), /grupo no declarado/);
  assert.throws(() => defineModule({ ...base, groups: { uno: "Uno" }, access: [{ group: "uno", models: "otra", perms: "r" }] }), /modelo inexistente/);
  assert.throws(() => defineModule({ ...base, groups: { uno: "Uno" }, access: [{ group: "uno", models: "etiqueta", perms: "rx" }] }), /crud/);
  assert.throws(() => defineModule({ ...base, rules: [{ id: "r", label: "R", models: "etiqueta", domain: [{ field: "noexiste", operator: "eq", value: 1 }] as never }] }), /Dominio de lista inválido/);
  assert.throws(() => defineModule({ ...base, rules: [{ id: "r", label: "R", models: "etiqueta", domain: [] }, { id: "r", label: "R2", models: "etiqueta", domain: [] }] }), /duplicado/);
});

test("closeGroups resuelve grupos implicados e ignora ids desconocidos", () => {
  const groups = new Map(demo.access.groups.map(group => [group.id, group]));
  assert.deepEqual([...closeGroups(["demo.responsable"], groups)].sort(), ["demo.responsable", "demo.usuario"]);
  assert.deepEqual([...closeGroups(["demo.usuario", "borrado.grupo"], groups)], ["demo.usuario"]);
});

test("la política de lista sale de los metadatos y excluye sensibles", () => {
  const [tarea] = demo.models;
  assert.deepEqual(tarea.list, {
    fields: ["name", "categoria", "estado", "prioridad", "vence"],
    searchFields: ["name"],
    sortable: ["name", "categoria", "estado", "prioridad", "vence"],
    filterable: ["name", "categoria", "estado", "prioridad", "vence"],
    groupable: ["categoria", "estado", "prioridad"],
  });
  const definition = defineModule({ id: "prueba", name: "Prueba", icon: "flask-conical", models: { etiqueta: Etiqueta } });
  assert.deepEqual(definition.models[0].list.fields, ["name"]);
  assert.deepEqual(derivedListPolicy(definition.models[0].metadata, { searchFields: [] }).searchFields, []);
});

test("las opciones del Field deciden lista, búsqueda, orden, filtros y grupos", () => {
  class Producto extends Model {
    name = Fields.Text({ required: true, searchable: true });
    codigo = Fields.Text({ searchable: true, sortable: false });
    notas = Fields.Text({ list: false });
    activo = Fields.Boolean({ default: true, groupable: false, filterable: false });
    stock = Fields.Integer({ groupable: true });
  }
  const { list } = defineModule({ id: "prueba", name: "Prueba", icon: "flask-conical", models: { producto: Producto } }).models[0];
  assert.deepEqual(list, {
    fields: ["name", "codigo", "activo", "stock"],
    searchFields: ["name", "codigo"],
    sortable: ["name", "activo", "stock"],
    filterable: ["name", "codigo", "stock"],
    groupable: ["stock"],
  });
  assert.deepEqual(defineModule({ id: "prueba", name: "Prueba", icon: "flask-conical", models: { producto: { model: Producto, list: { searchFields: ["name"] } } } }).models[0].list.searchFields, ["name"]);
  class Oculto extends Model { name = Fields.Text({ list: false, sortable: true }); }
  assert.throws(() => defineModule({ id: "prueba", name: "Prueba", icon: "flask-conical", models: { oculto: Oculto } }), /fuera de la lista/);
});

test("las opciones de presentación se validan al declarar el Field", () => {
  assert.throws(() => Fields.Integer({ searchable: true }), /sólo aplica a campos Text/);
  assert.throws(() => Fields.Image({ folder: "x", sortable: true }), /no se ordena/);
  assert.throws(() => Fields.DateTime({ groupable: true }), /no admite imágenes ni fechas/);
  assert.throws(() => Fields.Text({ sensitive: true, list: true }), /sensible/);
  assert.throws(() => Fields.Text({ compute: "calc", sortable: true }), /virtual/);
  assert.throws(() => Fields.Text({ searchable: "si" as never }), /booleano/);
  assert.equal(Fields.Text({ compute: "calc", list: true }).metadata.list, true);
  assert.equal(Object.hasOwn(Fields.Text().metadata, "searchable"), false, "sin opción no se añade la clave");
});

test("defineModule rechaza identificadores, claves y menús inválidos", () => {
  const base = { name: "Prueba", icon: "flask-conical", models: { etiqueta: Etiqueta } };
  assert.throws(() => defineModule({ ...base, id: "Mal-Id" }), /módulo inválido/);
  assert.throws(() => defineModule({ ...base, id: "prueba", models: { nuevo: Etiqueta } }), /reservada/);
  assert.throws(() => defineModule({ ...base, id: "prueba", models: { "Mal": Etiqueta } }), /inválida/);
  assert.throws(() => defineModule({ ...base, id: "prueba", menu: { Otro: "inexistente" } }), /modelo inexistente/);
  assert.throws(() => defineModule({ ...base, id: "prueba", models: {} }), /al menos un modelo/);
  assert.throws(() => defineModule({ ...base, id: "prueba", icon: "Flask" }), /icono Lucide/);
});

test("los Fields reconstruidos en el navegador conservan los metadatos del servidor", () => {
  for (const model of demo.models) {
    for (const [name, metadata] of Object.entries(model.metadata)) {
      const serialized = JSON.parse(JSON.stringify(metadata));
      assert.deepEqual(JSON.parse(JSON.stringify(fieldFromMetadata(serialized).metadata)), serialized, `${model.id}.${name}`);
    }
  }
  const estado = fieldFromMetadata(JSON.parse(JSON.stringify(demo.models[0].metadata.estado)));
  assert.equal(estado.createDefault(), "pendiente");
  assert.equal(estado.schema.safeParse("otra").success, false);
});

test("sólo se aceptan ids de modelo con forma módulo.clave", () => {
  for (const valid of ["demo.tarea", "flota.fabricante"]) assert.ok(modelIdPattern.test(valid));
  for (const invalid of ["demo", "demo.", "../demo.tarea", "demo.tarea.x", "Demo.tarea", "demo.tarea;"]) assert.equal(modelIdPattern.test(invalid), false, invalid);
});
