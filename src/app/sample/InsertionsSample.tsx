"use client";
import { useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import FormLayout from "@/components/ui/form/FormLayout";
import FormGroup from "@/components/ui/form/FormGroup";
import Stack from "@/components/ui/form/Stack";
import FieldText from "@/components/ui/form/FieldText";
import Notebook from "@/components/ui/form/Notebook";
import NotebookPage from "@/components/ui/form/NotebookPage";
import { InsertionProvider, Inserter, useInsertionFallback } from "@/components/ui/form/insertions/Insertions";

/** Fictitious extensions over one base form (no modules, no persistence). */
const schema = z.object({
  name: z.string().min(1, "Requerido"), phone: z.string(), email: z.string(),
  vat: z.string().min(12, "El RFC tiene 12 o 13 caracteres"), street: z.string(), referencias: z.string(),
  notes: z.string(), etapa: z.string().min(1, "Requerido"), alias: z.string(),
});
type Values = z.input<typeof schema>;
const defaults: Values = { name: "Ana López", phone: "", email: "", vat: "", street: "", referencias: "", notes: "", etapa: "", alias: "" };

/** «contactosextra»: RFC after the name and a new group after the contact data. */
function ExtraInsertions() {
  return <>
    <Inserter target="field:name" position="after"><FieldText<Values> name="vat" label="RFC (contactosextra)" /></Inserter>
    <Inserter target="group:contacto" position="after">
      <FormGroup id="direccion" legend="Dirección (contactosextra)"><FieldText<Values> name="street" label="Calle" /></FormGroup>
    </Inserter>
  </>;
}
/** «crm» depends on contactosextra: may use the group it published. */
function CrmInsertions() {
  return <>
    <Inserter target="field:phone" position="replace"><FieldText<Values> name="phone" widget="phone" label="Teléfono principal (crm)" /></Inserter>
    <Inserter target="group:direccion" position="inside"><FieldText<Values> name="referencias" widget="long" label="Referencias (crm)" /></Inserter>
    <Inserter target="notebook:extra" position="inside">
      <NotebookPage name="ventas" label="Ventas (crm)"><FormGroup><FieldText<Values> name="etapa" label="Etapa" /></FormGroup></NotebookPage>
    </Inserter>
  </>;
}
/** «whatsapp», independent: conflicts with crm and points to a missing target. */
function WhatsappInsertions() {
  return <>
    <Inserter target="field:phone" position="replace"><FieldText<Values> name="phone" label="WhatsApp" /></Inserter>
    <Inserter target="field:apodo" position="after"><FieldText<Values> name="alias" label="Alias (whatsapp, destino ausente)" /></Inserter>
  </>;
}

const modules = [{ module: "contactosextra", depends: [] }, { module: "crm", depends: ["contactosextra"] }, { module: "whatsapp", depends: [] }];

function Fallback({ module, label }: { module: string; label: string }) {
  const content = useInsertionFallback(module);
  return content ? <FormGroup legend={label}>{content}</FormGroup> : null;
}

export default function InsertionsSample() {
  const [mode, setMode] = useState<"base" | "extensions" | "conflict">("extensions");
  const [saved, setSaved] = useState<unknown>(null);
  const methods = useForm<Values>({ resolver: zodResolver(schema), defaultValues: defaults });
  const collectors: Record<string, ReactNode> = mode === "base" ? {} : { contactosextra: <ExtraInsertions />, crm: <CrmInsertions />, ...(mode === "conflict" ? { whatsapp: <WhatsappInsertions /> } : {}) };
  return <section id="insertions" className="card min-w-0 space-y-4 border border-base-300 bg-base-100 p-5">
    <h2 className="text-xl font-semibold">Inserciones en vistas extendidas</h2>
    <p className="text-sm">Datos ficticios. El formulario base no cambia: dos módulos simulados colocan campos con <code>&lt;Inserter&gt;</code>. Todo se valida y envía en el mismo formulario; un error en «Ventas» revela su pestaña.</p>
    <div role="group" aria-label="Escenario" className="join">
      {([["base", "Sólo base"], ["extensions", "Con extensiones"], ["conflict", "Con conflicto"]] as const).map(([value, label]) =>
        <button key={value} type="button" className={`btn btn-sm join-item ${mode === value ? "btn-primary" : "btn-outline"}`} onClick={() => setMode(value)}>{label}</button>)}
    </div>
    <FormLayout methods={methods} onSubmit={values => setSaved(values)}>
      <InsertionProvider key={mode} modules={modules} collectors={collectors}>
        <FormGroup id="contacto" legend="Datos de contacto (base)">
          <FieldText<Values> name="name" label="Nombre" />
          <Stack id="medios">
            <FieldText<Values> name="phone" label="Teléfono" />
            <FieldText<Values> name="email" widget="email" label="Email" />
          </Stack>
        </FormGroup>
        <Notebook id="extra">
          <NotebookPage name="notas" label="Notas"><FormGroup><FieldText<Values> name="notes" widget="long" label="Notas" /></FormGroup></NotebookPage>
        </Notebook>
        {mode === "conflict" && <Fallback module="whatsapp" label="Whatsapp (contenido sin destino)" />}
      </InsertionProvider>
      <button type="submit" className="btn btn-primary">Validar</button>
    </FormLayout>
    {saved != null && <pre className="overflow-x-auto rounded-box bg-base-200 p-3 text-xs" data-testid="insertions-result">{JSON.stringify(saved, null, 2)}</pre>}
  </section>;
}
