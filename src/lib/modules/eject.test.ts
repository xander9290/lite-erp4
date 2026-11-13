import assert from "node:assert/strict";
import { test } from "node:test";
import { formViewSource, listViewSource, manifestModel, registerView } from "./eject";
import { sourceFile } from "../scaffold/source-edit";
import demo from "./module.fixture";

const manifest = (models: string) => `import "server-only";
import { defineModule } from "@/lib/modules/define";
import { Categoria } from "./models/categoria";
import { Tarea } from "./models/tarea";

export default defineModule({
  id: "demo",
  name: "Demo",
  icon: "flask-conical",
  models: {
${models}
  },
});
`;
const parses = (text: string) => { sourceFile(text, "manifest.ts"); return text; };

test("registerView envuelve una clase simple y conserva el resto del manifest", () => {
  const before = manifest(`    tarea: Tarea,\n    categoria: Categoria,`);
  const after = parses(registerView(before, "categoria", "form"));
  assert.match(after, /categoria: \{ model: Categoria, views: \{ form: \(\) => import\("\.\/views\/CategoriaForm"\) \} \},/);
  assert.match(after, /    tarea: Tarea,\n/);
  assert.equal(manifestModel(after, "categoria").className, "Categoria");
});

test("registerView añade views a un objeto de una línea y luego otra vista", () => {
  const before = manifest(`    tarea: { model: Tarea, kanban: "estado" },`);
  const once = parses(registerView(before, "tarea", "form"));
  assert.match(once, /tarea: \{ model: Tarea, kanban: "estado", views: \{ form: \(\) => import\("\.\/views\/TareaForm"\) \} \},/);
  const twice = parses(registerView(once, "tarea", "list"));
  assert.match(twice, /views: \{ form: \(\) => import\("\.\/views\/TareaForm"\), list: \(\) => import\("\.\/views\/TareaList"\) \}/);
  assert.throws(() => registerView(twice, "tarea", "form"), /ya registra una vista form/);
});

test("registerView respeta objetos multilínea", () => {
  const before = manifest(`    tarea: {\n      model: Tarea,\n      kanban: "estado",\n    },\n    categoria: Categoria,`);
  const after = parses(registerView(before, "tarea", "form"));
  assert.match(after, /      kanban: "estado",\n      views: \{ form: \(\) => import\("\.\/views\/TareaForm"\) \},\n    \},\n    categoria: Categoria,/);
});

test("registerView rechaza manifests ambiguos o modelos inexistentes", () => {
  assert.throws(() => registerView(manifest(`    tarea: Tarea,`), "otra", "form"), /no está declarado/);
  assert.throws(() => registerView(manifest(`    ...extra,`), "tarea", "form"), /sin spreads/);
  assert.throws(() => registerView(`export const x = 1;`, "tarea", "form"), /defineModule/);
});

test("las plantillas usan los mismos controles que la vista por defecto y tipan con FormValues", () => {
  const [tarea] = demo.models;
  const model = { key: "tarea", className: "Tarea", classImport: "./models/tarea", fields: tarea.metadata, preview: {}, listFields: tarea.list.fields, lookups: ["categoria"] };
  const form = formViewSource(model);
  sourceFile(form, "TareaForm.tsx");
  assert.match(form, /^"use client";/);
  assert.match(form, /import type \{ Tarea \} from "\.\.\/models\/tarea";/);
  assert.match(form, /type Values = FormValues<typeof Tarea>;/);
  for (const control of ['<FieldText<Values> name="name"', '<FieldMany2One<Values> name="categoria"', '<FieldSelect<Values> name="estado"', '<FieldNumber<Values> name="prioridad" type="integer"', '<FieldDate<Values> name="vence" type="datetime"']) assert.ok(form.includes(control), control);
  assert.match(formViewSource({ ...model, lookups: [] }), /categoria: Many2one sin proveedor/);
  const list = listViewSource(model);
  sourceFile(list, "TareaList.tsx");
  assert.doesNotMatch(list, /use client/);
  assert.match(list, /\{ field: "categoria" \},/);
});
