import assert from "node:assert/strict";
import { test } from "node:test";
import { Fields, Model } from "../orm";
import { defineModule, derivedListPolicy } from "./define";
import { fieldFromMetadata } from "./fields";
import { modelIdPattern } from "./config";
import demo from "../../modules/demo/manifest";

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
  assert.deepEqual(demo.application.menus, [
    { id: "tarea-list", label: "Tareas", href: "/erp/demo/tarea", access: "admin" },
    { id: "configuracion-group", label: "Configuración", access: "admin", items: [{ id: "categoria-list", label: "Categorías", href: "/erp/demo/categoria", access: "admin" }] },
  ]);
});

test("la política de lista sale de los metadatos y excluye sensibles", () => {
  const [tarea] = demo.models;
  assert.deepEqual(tarea.list, {
    fields: ["name", "categoria", "estado", "prioridad", "vence"],
    searchFields: ["name"],
    sortable: ["name", "categoria", "estado", "prioridad", "vence"],
    filterable: ["name", "categoria", "estado", "prioridad", "vence"],
    groupable: ["categoria", "estado"],
  });
  const definition = defineModule({ id: "prueba", name: "Prueba", icon: "flask-conical", models: { etiqueta: Etiqueta } });
  assert.deepEqual(definition.models[0].list.fields, ["name"]);
  assert.deepEqual(derivedListPolicy(definition.models[0].metadata, { searchFields: [] }).searchFields, []);
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
