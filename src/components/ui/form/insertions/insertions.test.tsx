import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { FormProvider, useForm, useFormContext } from "react-hook-form";
import { insertionDeclarationIssue, resolveInsertions, slotEntries, type InsertionEntry, type InsertionPosition } from "./resolve";
import { InsertionProvider, Inserter } from "./Insertions";
import FieldText from "../FieldText";
import FormGroup from "../FormGroup";
import Stack from "../Stack";
import Notebook from "../Notebook";
import NotebookPage from "../NotebookPage";

let seq = 0;
const entry = (module: string, target: string, position: InsertionPosition, content = `${module}:${position}`): InsertionEntry<string> =>
  ({ key: `${module}-${target}-${position}-${seq}`, seq: seq++, rev: 1, module, target, position, content });
// crm depends on contactosextra; whatsapp is independent.
const modules = [{ module: "contactosextra", depends: ["ubicaciones"] }, { module: "crm", depends: ["contactosextra", "ubicaciones"] }, { module: "whatsapp", depends: [] }];
const mounted = (...targets: string[]) => new Map(targets.map(target => [target, { count: 1 }]));

test("Notebook page descriptors render server slots without a form provider", () => {
  const html = renderToStaticMarkup(<Notebook label="Accesos del grupo" pages={[
    { name: "modelos", label: "Modelos", children: <form autoComplete="off"><button>Guardar permisos</button></form> },
    { name: "reglas", label: "Reglas", children: <p>Sin reglas</p> },
  ]} />);
  assert.equal(html.match(/role="tab"/g)?.length, 2);
  assert.equal(html.match(/role="tabpanel"/g)?.length, 2);
  assert.match(html, /aria-selected="true"/);
  assert.match(html, /data-notebook-panel="reglas"[^>]*hidden=""/);
  assert.match(html, /Guardar permisos/);
  assert.match(html, /Sin reglas/);
  assert.equal(html.match(/<form /g)?.length, 1, "Notebook creates no wrapper form");
});

test("Notebook rejects mixed page declarations and unrelated child elements", () => {
  assert.throws(() => renderToStaticMarkup(<Notebook pages={[]}><NotebookPage name="x" label="X">Contenido</NotebookPage></Notebook>), /no ambos/);
  assert.throws(() => renderToStaticMarkup(<Notebook><div>Inválido</div></Notebook>), /solo admite NotebookPage/);
});

test("declaration syntax and allowed positions per kind of target", () => {
  assert.equal(insertionDeclarationIssue("field:email", "after"), undefined);
  assert.equal(insertionDeclarationIssue("page:extra/notas", "inside"), undefined);
  assert.match(insertionDeclarationIssue("field:email", "inside")!, /no admite position="inside"/);
  assert.match(insertionDeclarationIssue("notebook:extra", "replace")!, /no admite/);
  assert.match(insertionDeclarationIssue("page:notas", "after")!, /<notebook>\/<página>/);
  assert.match(insertionDeclarationIssue("//email", "after")!, /destino inválido/);
});

test("entries follow dependency order, independent of registration order", () => {
  const { slot } = slotEntries([entry("crm", "field:name", "after"), entry("whatsapp", "field:name", "after"), entry("contactosextra", "field:name", "after"), entry("crm", "field:name", "before")], modules, "field:name");
  assert.deepEqual(slot.after.map(item => item.module), ["contactosextra", "crm", "whatsapp"]);
  assert.deepEqual(slot.before.map(item => item.module), ["crm"]);
});

test("replace: the dependent module wins; unrelated replacements are a conflict; inside on a replaced container is rejected", () => {
  const inherited = slotEntries([entry("crm", "field:phone", "replace"), entry("contactosextra", "field:phone", "replace")], modules, "field:phone");
  assert.equal(inherited.slot.replace?.module, "crm");
  assert.equal(inherited.issues.length, 0);
  const conflict = slotEntries([entry("crm", "field:phone", "replace"), entry("whatsapp", "field:phone", "replace")], modules, "field:phone");
  assert.equal(conflict.slot.replace?.module, "crm");
  assert.match(conflict.issues[0], /lo reemplazan crm y whatsapp/);
  const container = slotEntries([entry("contactosextra", "group:contacto", "replace"), entry("whatsapp", "group:contacto", "inside")], modules, "group:contacto");
  assert.equal(container.slot.inside.length, 0);
  assert.equal(container.rejected[0].module, "whatsapp");
  assert.match(container.issues[0], /fue reemplazado por contactosextra/);
});

test("targets published by inserted content require depending on the publisher", () => {
  const entries = [entry("crm", "group:direccion", "inside"), entry("whatsapp", "group:direccion", "inside")];
  const { slot, issues } = slotEntries(entries, modules, "group:direccion", "contactosextra");
  assert.deepEqual(slot.inside.map(item => item.module), ["crm"]);
  assert.match(issues[0], /whatsapp.*lo publica contactosextra/);
});

test("whole-form check: missing targets fall back by module, duplicates and repeated anchors are reported", () => {
  const entries = [entry("crm", "field:telefono", "replace"), entry("crm", "field:email", "after"), entry("crm", "field:email", "after", "repetido"), entry("contactosextra", "field:name", "after")];
  const result = resolveInsertions(entries, modules, new Map([["field:email", { count: 1 }], ["field:name", { count: 2 }]]));
  assert.deepEqual(result.fallback.get("crm")?.map(item => item.target), ["field:telefono"]);
  assert.equal(result.fallback.get("contactosextra"), undefined);
  assert.ok(result.issues.some(issue => /field:telefono \(replace\): el destino no existe en esta vista/.test(issue)));
  assert.ok(result.issues.some(issue => /más de una vez/.test(issue)));
  assert.ok(result.issues.some(issue => /field:name aparece 2 veces/.test(issue)));
  assert.equal(resolveInsertions([entry("crm", "field:email", "after")], modules, mounted("field:email")).issues.length, 0);
});

function Probe({ label }: { label: string }) {
  // Inserted content runs inside the base form's RHF context.
  const { getValues } = useFormContext();
  return <span data-probe>{label}={String(getValues("name"))}</span>;
}

function ExtraInsertions() {
  return <>
    <Inserter target="field:name" position="after"><FieldText name="vat" label="RFC" /></Inserter>
    <Inserter target="group:contacto" position="after">
      <FormGroup id="direccion" legend="Dirección"><FieldText name="street" label="Calle" /></FormGroup>
    </Inserter>
    <Inserter target="stack:medios" position="inside"><Probe label="extra" /></Inserter>
  </>;
}
function CrmInsertions() {
  return <>
    <Inserter target="field:phone" position="replace"><FieldText name="phone" label="Teléfono principal" /></Inserter>
    <Inserter target="group:direccion" position="inside"><FieldText name="referencias" label="Referencias" /></Inserter>
    <Inserter target="notebook:extra" position="inside"><NotebookPage name="ventas" label="Ventas"><FieldText name="etapa" label="Etapa" /></NotebookPage></Inserter>
    <Inserter target="page:extra/notas" position="inside"><FieldText name="nota2" label="Nota CRM" /></Inserter>
  </>;
}

function BaseForm({ collectors }: { collectors: Record<string, React.ReactNode> }) {
  const methods = useForm({ defaultValues: { name: "Ana", phone: "", email: "", vat: "", street: "", referencias: "", etapa: "", notes: "", nota2: "" } });
  return <FormProvider {...methods}>
    <InsertionProvider modules={modules.slice(0, 2)} collectors={collectors}>
      <FormGroup id="contacto" legend="Datos de contacto">
        <FieldText name="name" label="Nombre" />
        <Stack id="medios">
          <FieldText name="phone" label="Teléfono" />
          <FieldText name="email" label="Email" />
        </Stack>
      </FormGroup>
      <Notebook id="extra">
        <NotebookPage name="notas" label="Notas"><FieldText name="notes" label="Notas" /></NotebookPage>
      </Notebook>
    </InsertionProvider>
  </FormProvider>;
}

test("anchors render inserted content in place, in order, inside the same form", () => {
  const html = renderToStaticMarkup(<BaseForm collectors={{ contactosextra: <ExtraInsertions />, crm: <CrmInsertions /> }} />);
  const order = ["Nombre", "RFC", "Teléfono principal", "Email", "extra=Ana", "Dirección", "Calle", "Referencias", "Notas", "Ventas", "Nota CRM"]; // tabs precede panels;
  const positions = order.map(text => html.indexOf(text));
  assert.ok(positions.every(position => position >= 0), `faltan textos: ${order.filter((_, index) => positions[index] < 0).join(", ")}`);
  assert.deepEqual([...positions].sort((a, b) => a - b), positions, "orden de inserción");
  assert.doesNotMatch(html, />Teléfono</, "el campo reemplazado no se pinta");
  assert.equal(html.match(/name="phone"/g)?.length, 1, "la sustitución no se aplica a sí misma");
  assert.match(html, /role="tab"[^>]*>.*Ventas/s);
});

test("without insertion files the base form is unchanged", () => {
  const plain = renderToStaticMarkup(<BaseForm collectors={{}} />);
  assert.match(plain, /Teléfono/);
  assert.doesNotMatch(plain, /RFC|Dirección/);
});

test("Inserter outside an insertions file fails clearly", () => {
  assert.throws(() => renderToStaticMarkup(<Inserter target="field:name" position="after">x</Inserter>), /archivo insertions/);
});
