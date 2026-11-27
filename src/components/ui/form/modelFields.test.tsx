import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";
import { useForm, FormProvider } from "react-hook-form";
import { Fields } from "@/lib/orm/fields";
import { fieldFromMetadata } from "@/lib/modules/fields";
import { FormModelContext, useModelField } from "./modelFields";
import FieldText from "./FieldText";
import FieldSelect from "./FieldSelect";
import FieldNumber from "./FieldNumber";
import FormGroup from "./FormGroup";
import Stack from "./Stack";
import { FormActionsContext, FormButton } from "./formActions";
import { defineActionReferences, type ModelActionReference } from "@/lib/orm/action-reference";
const fields={name:Fields.Text({label:"Nombre heredado",required:true,maxLength:12}),state:Fields.Selection([{value:"draft",label:"Borrador"}],{label:"Estado",required:true}),ownerId:Fields.Many2one("Owner")};
const load=async()=>({ok:false as const,error:"sample"});

test("field policies omit no-read controls and lock no-write controls even with explicit presentation overrides", () => {
  function Restricted() {
    const methods = useForm({ defaultValues: { name: "PRIVATE VALUE", state: "draft" } });
    return <FormProvider {...methods}><FormModelContext.Provider value={{ fields, fieldAccess: {
      name: { noRead: true, noWrite: true, invisible: false, readOnly: false },
      state: { noRead: false, noWrite: true, invisible: false, readOnly: false },
    } }}><FieldText name="name" invisible={false} /><FieldSelect name="state" readOnly={false} /></FormModelContext.Provider></FormProvider>;
  }
  const html = renderToStaticMarkup(<Restricted />);
  assert.doesNotMatch(html, /PRIVATE VALUE|name="name"/);
  assert.match(html, /draft/);
  assert.match(html, /disabled=""|readOnly=""/);
});
function Probe(){const props=useModelField({name:"ownerId"},"many2one") as {load?:unknown};return <span>{props.load===load?"lookup heredado":"sin lookup"}</span>;}
function Fixture({override=false,bound=true}:{override?:boolean;bound?:boolean}) {
  const methods=useForm({defaultValues:{name:"",state:"draft"}});
  return <FormProvider {...methods}><FormModelContext.Provider value={bound?{fields,lookups:{ownerId:load}}:undefined}>
    <FieldText name="name" {...override?{label:"Personalizado",required:false,maxLength:30}:{}} />
    <FieldSelect name="state" {...!bound?{options:[{value:"draft",label:"Manual"}]}:{}} />
    <Probe />
  </FormModelContext.Provider></FormProvider>;
}
test("existing controls inherit metadata, explicit false/labels/limits override it, manual forms keep working",()=>{
  const inherited=renderToStaticMarkup(<Fixture />);
  assert.match(inherited,/Nombre heredado/);assert.match(inherited,/maxLength="12"/i);assert.match(inherited,/required=""/);assert.match(inherited,/Borrador/);assert.match(inherited,/lookup heredado/);assert.match(inherited,/autoComplete="off"/i);
  const overridden=renderToStaticMarkup(<Fixture override />);
  assert.match(overridden,/Personalizado/);assert.match(overridden,/maxLength="30"/i);
  assert.doesNotMatch(overridden.split('name="name"')[0],/required=""/);
  assert.match(renderToStaticMarkup(<Fixture bound={false} />),/Manual/);
});

test("Text and Number display consume readonly metadata without any form provider or editable inputs",()=>{
  const readFields={total:Fields.Integer({label:"Total calculado"}),summary:Fields.Text({label:"Resumen"})};
  const html=renderToStaticMarkup(<FormModelContext.Provider value={{fields:{},readFields,reactionState:{pending:false,error:null,preview:{total:1234,summary:"<script>texto literal</script>"}}}}>
    <FieldNumber mode="display" name="total" type="integer" direction="inline" />
    <FieldText mode="display" name="summary" />
  </FormModelContext.Provider>);
  assert.match(html,/Total calculado/);assert.match(html,/1,234/);
  assert.match(html,/&lt;script&gt;texto literal&lt;\/script&gt;/);
  assert.doesNotMatch(html,/<input|<textarea|<script>/);
  assert.match(html,/data-form-field="total"/);
  assert.throws(()=>renderToStaticMarkup(<FormModelContext.Provider value={{fields:{},readFields}}><FieldText mode="display" name="missing" /></FormModelContext.Provider>),/no publicado/);
});

test("Text header renders the RHF title without its inherited label or an editable control", () => {
  function HeaderFixture({ name = "<Toyota>" }: { name?: string }) {
    const methods = useForm({ defaultValues: { name } });
    return <FormProvider {...methods}><FormModelContext.Provider value={{ fields }}>
      <FieldText name="name" widget="header" direction="inline" />
    </FormModelContext.Provider></FormProvider>;
  }
  const html = renderToStaticMarkup(<HeaderFixture />);
  assert.match(html, /<h1[^>]*>&lt;Toyota&gt;<\/h1>/);
  assert.match(html, /data-form-field="name"/);
  assert.doesNotMatch(html, /<label|<input|<textarea|Nombre heredado/);
  assert.match(renderToStaticMarkup(<HeaderFixture name="" />), /Nuevo registro/);
});

test("Stack forces block direction through custom children and display Fields without affecting siblings", () => {
  function NestedField() {
    return <FieldText name="name" direction="inline" />;
  }
  function StackFixture() {
    const methods = useForm({ defaultValues: { name: "Toyota", outside: "Exterior" } });
    const readFields = { summary: Fields.Text({ label: "Resumen" }) };
    return <FormProvider {...methods}><FormModelContext.Provider value={{ fields, readFields }}>
      <FormGroup legend="Distribución">
        <Stack>
          <><NestedField /></>
          <FieldText mode="display" name="summary" direction="inline" />
        </Stack>
      </FormGroup>
      <FieldText name="outside" label="Exterior" direction="inline" />
    </FormModelContext.Provider></FormProvider>;
  }
  const html = renderToStaticMarkup(<StackFixture />);
  const outside = html.indexOf('data-form-field="outside"');
  assert.ok(outside > 0);
  assert.doesNotMatch(html.slice(0, outside), /grid-cols-\[minmax/);
  assert.match(html.slice(outside), /grid-cols-\[minmax/);
  assert.match(html, /value="Toyota"/);
  assert.match(html, /Nombre heredado/);
  assert.match(html, /autoComplete="off"/i);
});

test("invisible inherits metadata, permits explicit overrides and keeps registered values mounted", () => {
  const hidden = Fields.Text({ label: "Código", required: true, invisible: true });
  function InvisibleFixture({ invisible }: { invisible?: boolean }) {
    const methods = useForm({ defaultValues: { code: "AUTO-001" }, shouldUnregister: true });
    return <FormProvider {...methods}><FormModelContext.Provider value={{ fields: { code: hidden } }}>
      <FieldText name="code" invisible={invisible} />
    </FormModelContext.Provider></FormProvider>;
  }
  const html = renderToStaticMarkup(<InvisibleFixture />);
  assert.match(html, /hidden="" class="hidden!"/);
  assert.match(html, /value="AUTO-001"/);
  assert.match(html, /<label/);
  assert.doesNotMatch(html, /disabled=""|invisible="/);
  assert.doesNotMatch(renderToStaticMarkup(<InvisibleFixture invisible={false} />), /hidden=""/);
  assert.equal(hidden.schema.safeParse("").success, false);

  const display = renderToStaticMarkup(<FormModelContext.Provider value={{ fields: {}, readFields: { code: hidden } }}>
    <FieldText mode="display" name="code" />
  </FormModelContext.Provider>);
  assert.match(display, /hidden="" class="hidden!"/);
});

test("FormButton hides actions outside the published capability snapshot and all actions in consultation", () => {
  const context = { model: "SamplePolicy", header: null, locked: false, readOnly: false, actions: [{ name: "allowed", label: "Permitida" }], run: async () => true, running: null };
  const actions = defineActionReferences("SamplePolicy", ["allowed", "denied"]);
  const buttons = <><FormButton action={actions.allowed} confirm="¿Ejecutar permitida?" /><FormButton action={actions.denied}>No permitida</FormButton></>;
  const html = renderToStaticMarkup(<FormActionsContext.Provider value={context}>{buttons}</FormActionsContext.Provider>);
  assert.match(html, /Permitida/);
  assert.doesNotMatch(html, /No permitida/);
  assert.doesNotMatch(html, /confirm=|¿Ejecutar permitida\?/);
  const readonly = renderToStaticMarkup(<FormActionsContext.Provider value={{ ...context, readOnly: true }}>{buttons}</FormActionsContext.Provider>);
  assert.doesNotMatch(readonly, /<button/);
  const other = defineActionReferences("OtherModel", ["allowed"]);
  for (const action of [other.allowed, "allowed" as unknown as ModelActionReference]) {
    assert.doesNotMatch(renderToStaticMarkup(<FormActionsContext.Provider value={context}><FormButton action={action} /></FormActionsContext.Provider>), /<button/);
  }
  for (const value of [{ ...context, model: undefined }, { ...context, actions: undefined }]) {
    assert.doesNotMatch(renderToStaticMarkup(<FormActionsContext.Provider value={value}>{buttons}</FormActionsContext.Provider>), /<button/);
  }
});

test("declarative One2many columns inherit child metadata and preserve persisted IDs", async () => {
  const { default: FieldOne2many } = await import("./FieldOne2many");
  const childFields={name:Fields.Text({label:"Descripción",required:true,maxLength:17}),cantidad:Fields.Integer({label:"Cantidad",required:true,min:0})};
  function LinesFixture({readonly=false}:{readonly?:boolean}) {
    const methods=useForm({defaultValues:{lines:[{id:"database-id",revision:"2026-11-15T00:00:00.000Z",name:"Guardado",cantidad:2}]}});
    return <FormProvider {...methods}><FormModelContext.Provider value={{fields:{},lines:{lines:{fields:childFields,minRows:0,maxRows:3,label:"Detalles",createRow:()=>({name:"",cantidad:1}),capabilities:{read:true,create:!readonly,write:!readonly,unlink:!readonly}}}}}>
      <FieldOne2many name="lines"><FieldOne2many.Column name="name" /><FieldOne2many.Column name="cantidad" render={({fieldName})=><FieldNumber name={fieldName("cantidad")} type="integer" />} /></FieldOne2many>
      <output>{methods.getValues("lines.0.id")}</output>
    </FormModelContext.Provider></FormProvider>;
  }
  const html=renderToStaticMarkup(<LinesFixture />);
  assert.match(html,/Descripción/);assert.match(html,/maxLength="17"/i);assert.match(html,/name="lines.0.name"/);assert.match(html,/value="Guardado"/);assert.match(html,/database-id/);assert.match(html,/Agregar línea/);assert.match(html,/autocomplete="off"/i);assert.doesNotMatch(html,/documentoId/);
  const readonly=renderToStaticMarkup(<LinesFixture readonly />);assert.doesNotMatch(readonly,/Agregar línea|Quitar línea/);assert.match(readonly,/<fieldset disabled=""/);assert.match(readonly,/value="Guardado"/);
});

test("declarative One2many columns support invisible and per-row readOnly", async () => {
  const { default: FieldOne2many } = await import("./FieldOne2many");
  const childFields={name:Fields.Text({label:"Descripción",required:true}),nota:Fields.Text({label:"Nota oculta"}),cantidad:Fields.Integer({label:"Cantidad",required:true,min:0})};
  function ColumnsFixture({ columns }: { columns: ReactNode }) {
    const methods=useForm({defaultValues:{lines:[{id:"saved-id",revision:"2026-11-15T00:00:00.000Z",name:"Guardado",nota:"secreta",cantidad:2},{name:"Nueva",nota:"",cantidad:1}]}});
    return <FormProvider {...methods}><FormModelContext.Provider value={{fields:{},lines:{lines:{fields:childFields,minRows:0,maxRows:3,createRow:()=>({name:"",nota:"",cantidad:1}),capabilities:{read:true,create:true,write:true,unlink:true}}}}}>
      <FieldOne2many name="lines">{columns}</FieldOne2many>
    </FormModelContext.Provider></FormProvider>;
  }
  const html=renderToStaticMarkup(<ColumnsFixture columns={<><FieldOne2many.Column name="name" readOnly={row=>Boolean(row.id)} /><FieldOne2many.Column name="nota" invisible /><FieldOne2many.Column name="cantidad" readOnly /></>} />);
  assert.doesNotMatch(html,/Nota oculta|lines\.0\.nota|secreta/);
  const input=(name:string)=>html.match(new RegExp(`<input[^>]*name="${name.replace(/\./g,"\\.")}"[^>]*>`))?.[0] ?? "";
  assert.match(input("lines.0.name"),/readonly=""/i);
  assert.doesNotMatch(input("lines.1.name"),/readonly=""/i);
  assert.match(input("lines.0.cantidad"),/readonly=""/i);
  assert.match(input("lines.1.cantidad"),/readonly=""/i);
  assert.match(html,/Agregar línea/);
  assert.throws(()=>renderToStaticMarkup(<ColumnsFixture columns={<FieldOne2many.Column name="name" invisible />} />),/al menos una columna visible/);
  assert.throws(()=>renderToStaticMarkup(<ColumnsFixture columns={<FieldOne2many.Column name="inexistente" invisible />} />),/no publicada/);
});


test("Many2many tags inherit provider, bounds, label and visibility with explicit overrides", () => {
  const tags = Fields.Many2many("SampleTag", { label: "Etiquetas heredadas", minSelected: 1, maxSelected: 3, invisible: true });
  function ProbeTags({ override = false }: { override?: boolean }) {
    const props = useModelField({ name: "tags", ...(override ? { label: "Propias", required: false, invisible: false } : {}) }, "many2many") as { label?: string; required?: boolean; invisible?: boolean; maxSelected?: number; load?: unknown };
    return <span>{JSON.stringify({ ...props, load: props.load === load })}</span>;
  }
  const render = (override = false) => renderToStaticMarkup(<FormModelContext.Provider value={{ fields: {}, many2many: { tags }, lookups: { tags: load } }}><ProbeTags override={override} /></FormModelContext.Provider>);
  const inherited = render();
  assert.match(inherited, /Etiquetas heredadas/);
  assert.match(inherited, /maxSelected&quot;:3/);
  assert.match(inherited, /load&quot;:true/);
  assert.match(inherited, /invisible&quot;:true/);
  assert.match(render(true), /Propias/);
  assert.match(render(true), /required&quot;:false/);
  assert.match(render(true), /invisible&quot;:false/);
});


test("sequence text keeps Nuevo and lets FieldText choose readonly explicitly", () => {
  const name = Fields.Text({ label: "Folio", sequence: { prefix: "TCK-" } });
  function SequenceFixture({ readOnly }: { readOnly?: boolean }) {
    const methods = useForm({ defaultValues: { name: "" } });
    return <FormProvider {...methods}><FormModelContext.Provider value={{ fields: { name } }}><FieldText name="name" readOnly={readOnly} required /></FormModelContext.Provider></FormProvider>;
  }
  const html = renderToStaticMarkup(<SequenceFixture />);
  assert.doesNotMatch(html, /readOnly=""/i);
  assert.doesNotMatch(renderToStaticMarkup(<SequenceFixture readOnly={false} />), /readOnly=""/i);
  assert.match(renderToStaticMarkup(<SequenceFixture readOnly />), /readOnly=""/i);
  assert.match(html, /placeholder="Nuevo"/);
  assert.match(html, /autoComplete="off"/i);
  assert.doesNotMatch(html, / required=""/);
});

test("write-only secrets bind as an empty password input; other sensitive fields stay rejected", () => {
  const password = fieldFromMetadata(Fields.Text({ label: "Contraseña", writeOnly: true, trim: false }).metadata);
  assert.equal(password.metadata.kind === "text" && password.metadata.writeOnly, true, "the browser mirror keeps writeOnly");
  function SecretFixture({ field }: { field: typeof password }) {
    const methods = useForm({ defaultValues: { secret: "" } });
    return <FormProvider {...methods}><FormModelContext.Provider value={{ fields: { secret: field } }}><FieldText name="secret" widget="password" /></FormModelContext.Provider></FormProvider>;
  }
  const html = renderToStaticMarkup(<SecretFixture field={password} />);
  assert.match(html, /type="password"/);
  assert.match(html, /Contraseña/);
  assert.throws(() => renderToStaticMarkup(<SecretFixture field={Fields.Text({ label: "Token", sensitive: true })} />), /Contrato incompatible/);
});

test("nested lines: paths resolve at any depth and rows render their sub-lines inline", async () => {
  const { default: FieldOne2many } = await import("./FieldOne2many");
  const { lineAt, lineField } = await import("./modelFields");
  const caps = { read: true, create: true, write: true, unlink: true };
  const entregas = { fields: { cantidad: Fields.Integer({ label: "Cantidad", required: true, min: 1 }) }, minRows: 0, maxRows: 3, label: "Entregas", createRow: () => ({ cantidad: 1 }), capabilities: caps };
  const model = { fields: {}, lines: { lineas: { fields: { name: Fields.Text({ label: "Producto", required: true }) }, minRows: 0, maxRows: 5, label: "Partidas", createRow: () => ({ name: "", entregas: [] }), capabilities: caps, lines: { entregas } } } };
  assert.equal(lineAt(model, "lineas.0.entregas"), entregas);
  assert.equal(lineAt(model, "lineas.x.entregas"), undefined);
  assert.deepEqual(lineField(model, "lineas.1.entregas.2.cantidad"), { line: entregas, key: "cantidad", row: "lineas.1.entregas.2" });
  assert.deepEqual(lineField(model, "name"), { key: "name" });
  function NestedFixture() {
    const methods = useForm({ defaultValues: { lineas: [{ id: "p1", revision: "2026-11-19T00:00:00.000Z", name: "Cable", entregas: [{ id: "e1", revision: "2026-11-19T00:00:00.000Z", cantidad: 2 }] }] } });
    return <FormProvider {...methods}><FormModelContext.Provider value={model}><FieldOne2many name="lineas" /></FormModelContext.Provider></FormProvider>;
  }
  const html = renderToStaticMarkup(<NestedFixture />);
  assert.match(html, /aria-expanded="false"/);
  assert.match(html, /Mostrar Entregas \(1\) de la línea 1/);
  // Collapsed sub-lines stay mounted (registered values), just hidden.
  assert.match(html, /name="lineas.0.entregas.0.cantidad"/);
  assert.match(html, /value="2"/);
});
