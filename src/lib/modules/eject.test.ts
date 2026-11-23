import assert from "node:assert/strict";
import { test } from "node:test";
import { formViewSource, listViewSource, manifestModel, registerView } from "./eject";
import { sourceFile } from "../scaffold/source-edit";
import demo from "./module.fixture";
import { Fields } from "../orm/fields";

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

test("card/kanban eject register independently, replace only defaults and keep custom list/form", () => {
  const before = manifest('    tarea: { model: Tarea, views: { list: () => import("./views/TareaList"), card: true, form: () => import("./views/TareaForm") } },');
  const card = parses(registerView(before, "tarea", "card"));
  const board = parses(registerView(card, "tarea", "kanban"));
  assert.match(board, /list: \(\) => import\("\.\/views\/TareaList"\)/);
  assert.match(board, /form: \(\) => import\("\.\/views\/TareaForm"\)/);
  assert.match(board, /card: \(\) => import\("\.\/views\/TareaCard"\)/);
  assert.match(board, /kanban: \(\) => import\("\.\/views\/TareaKanban"\)/);
  assert.throws(() => registerView(board, "tarea", "kanban"), /no se sobrescribe/);
  const [task] = demo.models;
  for (const kind of ["card", "kanban"] as const) {
    const source = listViewSource({ key: "tarea", className: "Tarea", classImport: "./models/tarea", fields: task.metadata, preview: {}, listFields: task.list.fields, lookups: [] }, kind);
    sourceFile(source, "view.tsx");
    assert.match(source, new RegExp(`view="${kind}"`));
    assert.doesNotMatch(source, /modelKanban|modelMove|collectionFieldMetadata/);
  }
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

test("sequence fields are ejected as headers while ordinary text stays editable", () => {
  const form = formViewSource({ key: "ticket", className: "Ticket", classImport: "./models/ticket",
    fields: { name: Fields.Text({ sequence: { prefix: "TCK-" } }).metadata, asunto: Fields.Text().metadata },
    preview: {}, listFields: ["name", "asunto"], lookups: [] });
  sourceFile(form, "TicketForm.tsx");
  assert.match(form, /<FieldText<Values> name="name" widget="header" direction="inline" \/>/);
  assert.match(form, /<FieldText<Values> name="asunto" direction="inline" \/>/);
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

test("modal eject preserves the page and collection views, including extension short and literal declarations", () => {
  const own = registerView(manifest('    tarea: { model: Tarea, views: { form: () => import("./Page") } },'), "tarea", "modal");
  parses(own);
  assert.match(own, /form: \(\) => import\("\.\/Page"\), modal: \(\) => import\("\.\/views\/TareaModal"\)/);
  for (const declaration of ["Extra", "{ model: Extra }", '{ model: Extra, insertions: { form: () => import("./Insert"), list: () => import("./List") }, views: { form: () => import("./Partial") } }', "{ model }"]) {
    const before = `export default defineModule({models:{}, extends:{ "core.partner": ${declaration} }});`;
    const after = parses(registerView(before, "core.partner", "modal"));
    assert.match(after, /modal: \(\) => import\("\.\/views\/CorePartnerModal"\)/);
    if (declaration.includes("insertions:")) {
      assert.match(after, /insertions: \{ form: \(\) => import\("\.\/Insert"\), list: \(\) => import\("\.\/List"\) \}/);
      assert.match(after, /form: \(\) => import\("\.\/Partial"\)/);
    }
    assert.throws(() => registerView(after, "core.partner", "modal"), /no se sobrescribe/);
  }
  assert.throws(() => registerView('export default defineModule({models:{}, extends:{ ...others }});', "core.partner", "modal"), /sin spreads/);
  assert.throws(() => registerView('export default defineModule({models:{}});', "core.partner", "modal"), /extends/);
  assert.throws(() => registerView(own, "core.partner", "form"), /sólo modal/);
});

test("modal templates keep the shared runtime, extension fields, inline lines and independent child collections", () => {
  const source = formViewSource({ key: "core.partner", fields: { name: Fields.Text().metadata, parentId: Fields.Many2one("Partner").metadata }, preview: {}, listFields: ["name"], lookups: ["parentId"], many2many: ["tagIds"], lines: ["lineIds"], collections: ["childIds"], excludeExtensionFields: ["name", "parentId", "tagIds"] }, "modal");
  sourceFile(source, "CorePartnerModal.tsx");
  assert.match(source, /function CorePartnerModal/);
  assert.match(source, /type Values = Record<string, unknown>/);
  assert.doesNotMatch(source, /import.*models\/|FormDialog|useForm|onSubmit/);
  for (const text of ['<ModelForm config={config} id={id}>', '<ModelExtensions excludeFields={["name","parentId","tagIds"]} />', '<FieldMany2One<Values> name="parentId"', '<FieldRelationTag<Values> name="tagIds"', '<FieldOne2many name="lineIds" />', '<ModelChildCollections name="childIds" openIn="modal" />']) assert.ok(source.includes(text), text);
});
