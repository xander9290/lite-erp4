"use client";

import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Check, Printer, Undo2, X, StickyNote, Mail, Paperclip } from "lucide-react";
import toast from "react-hot-toast";
import FormView from "@/components/ui/form/FormView";
import FormLayout from "@/components/ui/form/FormLayout";
import FormGroup from "@/components/ui/form/FormGroup";
import FieldText from "@/components/ui/form/FieldText";
import FieldNumber from "@/components/ui/form/FieldNumber";
import FieldBoolean from "@/components/ui/form/FieldBoolean";
import FieldSelect from "@/components/ui/form/FieldSelect";
import Notebook from "@/components/ui/form/Notebook";
import NotebookPage from "@/components/ui/form/NotebookPage";
import FormViewLoader from "@/components/ui/form/FormViewLoader";
import { useAlerts } from "@/components/ui/alerts/AlertProvider";
import { documentStates, formViewSchema, newFormViewDefaults, selectableStateSchema, type FormViewSampleValues, type SelectableStateValues } from "./formView.schema";
import { loadFormViewExample, prepareFormViewReport, saveFormViewExample, transitionFormViewExample } from "./formView.actions";
import FormViewReport from "./FormViewReport";

function SelectableStatebarSample() {
  const methods = useForm<SelectableStateValues>({ resolver: zodResolver(selectableStateSchema), defaultValues: { stage: 0 } });
  const [change, setChange] = useState<number | null>();
  const [result, setResult] = useState<SelectableStateValues>();
  return <section id="field-select-statebar" aria-labelledby="statebar-sample-title" className="card min-w-0 scroll-mt-6 border border-base-300 bg-base-100 shadow-sm">
    <div className="card-body min-w-0 gap-4 p-4 sm:p-6">
      <header className="space-y-1"><h2 id="statebar-sample-title" className="text-xl font-semibold">FieldSelect · Statebar</h2><p className="text-sm text-base-content/65">Por defecto muestra el estado sin permitir editarlo. Con readOnly=false permite seleccionar; conserva el valor numérico, incluido el cero.</p></header>
      <FormLayout methods={methods} onSubmit={values => setResult(values)}>
        <FormGroup legend="Selección directa" fullWidth>
          <FieldSelect<SelectableStateValues, number> name="stage" label="Etapa del ejemplo" widget="statebar" readOnly={false} required onChange={setChange} options={[{ value: 0, label: "Pendiente" }, { value: 1, label: "En curso" }, { value: 2, label: "Terminado" }, { value: 3, label: "No disponible", disabled: true }]} />
          <p role="status" className="text-xs text-base-content/60">{methods.formState.isDirty ? "Con cambios" : "Sin cambios"}{change !== undefined && ` · onChange: ${JSON.stringify(change)}`}</p>
        </FormGroup>
        <div className="col-span-full flex flex-wrap gap-2"><button type="submit" className="btn btn-primary btn-sm">Validar estado</button><button type="button" className="btn btn-ghost btn-sm" onClick={() => { methods.reset(); setChange(undefined); setResult(undefined); }}>Restablecer estado</button></div>
      </FormLayout>
      {result && <pre aria-live="polite" className="rounded-xl bg-base-200 p-3 text-xs">{JSON.stringify(result)}</pre>}
    </div>
  </section>;
}

function DocumentForm({ record }: { record: FormViewSampleValues }) {
  const alerts = useAlerts();
  const methods = useForm<FormViewSampleValues>({ resolver: zodResolver(formViewSchema), defaultValues: record });
  const [saved, setSaved] = useState(record);
  const [mode, setMode] = useState<"create" | "edit">("edit");
  const [busy, setBusy] = useState(false);
  const actionInFlight = useRef(false);
  const [report, setReport] = useState<string>();
  const [activePage, setActivePage] = useState("notes");

  async function runAction(target: FormViewSampleValues["state"] | "report") {
    if (mode === "create" || actionInFlight.current || methods.formState.isDirty || methods.formState.isSubmitting) return;
    actionInFlight.current = true;
    try {
      if (target === "cancelled" && !await alerts.confirm({ title: "Cancelar documento", message: "El documento pasará al estado Cancelado. ¿Deseas continuar?", confirmLabel: "Sí, cancelar", cancelLabel: "Volver", danger: true })) return;
      setBusy(true);
      if (target === "report") {
        const response = await prepareFormViewReport(saved);
        if (response.ok) setReport(response.html); else toast.error(response.error);
      } else {
        const response = await transitionFormViewExample(saved, target);
        if (!response.ok) { toast.error(response.error); return; }
        methods.reset(response.values); setSaved(response.values); toast.success(response.message!);
      }
    } catch { toast.error("No se pudo completar la acción. Intenta nuevamente."); }
    finally { actionInFlight.current = false; setBusy(false); }
  }

  return <>
    <section aria-label="Ejemplo de FormView" className="min-w-0">
      <FormView methods={methods} title={mode === "create" ? "Nuevo documento de ejemplo" : "Documento de ejemplo"} description="FormView · Datos, acciones y estado en una misma Card." busy={busy} mode={mode}
        onNew={mode === "edit" ? () => { methods.reset(newFormViewDefaults); setSaved(newFormViewDefaults); setMode("create"); setActivePage("notes"); setReport(undefined); } : undefined}
        onSubmit={saveFormViewExample} onSaved={values => { setSaved(values); setMode("edit"); }}
        statebar={<FieldSelect<FormViewSampleValues, string> name="state" widget="statebar" aria-label="Estado del documento" options={documentStates} />}
        menuActions={({ isDirty, busy }) => [
          { id: "report", label: "Preparar reporte", icon: <Printer size={16} />, disabled: mode === "create" || isDirty || busy, onSelect: () => void runAction("report") },
        ]}
        headerActions={({ isDirty, busy }) => mode === "edit" && <>
          {saved.state === "draft" && <button type="button" disabled={isDirty || busy} className="btn btn-soft btn-primary btn-sm" onClick={() => void runAction("confirmed")}><Check size={15} />Confirmar</button>}
          {saved.state !== "cancelled" && <button type="button" disabled={isDirty || busy} className="btn btn-ghost btn-sm" onClick={() => void runAction("cancelled")}><X size={15} />Cancelar documento</button>}
          {saved.state === "cancelled" && <button type="button" disabled={isDirty || busy} className="btn btn-soft btn-sm" onClick={() => void runAction("draft")}><Undo2 size={15} />Volver a borrador</button>}
        </>}
        footer={<p className="text-xs leading-relaxed text-base-content/55">Demostración sin persistencia: las acciones validan en el servidor y no modifican la base de datos. Guarda o revierte antes de usar las acciones. Para probar un rechazo del servidor, usa la referencia DUPLICADO.</p>}>
        <FormGroup legend="Documento">
          <FieldText<FormViewSampleValues> name="reference" label="Referencia" direction="inline" />
          <FieldText<FormViewSampleValues> name="customer" label="Cliente" direction="inline" />
          <FieldNumber<FormViewSampleValues> name="amount" label="Importe" direction="inline" type="monetary" decimals={2} currency="MXN" />
        </FormGroup>
        <FormGroup legend="Detalles">
          <FieldSelect<FormViewSampleValues, string> name="priority" label="Prioridad" direction="inline" required options={[{ value: "normal", label: "Normal" }, { value: "high", label: "Alta" }]} />
          <FieldBoolean<FormViewSampleValues> name="active" label="Activo" direction="inline" />
        </FormGroup>
        <Notebook id="notebook" label="Detalles del documento" activePage={activePage} onPageChange={setActivePage}>
          <NotebookPage name="notes" label="Notas" icon={<StickyNote size={16} />}>
            <FormGroup legend="Notas internas">
              <FieldText<FormViewSampleValues> name="notes" label="Notas del documento" widget="long" rows={4} maxLength={500} />
              <p className="text-xs text-base-content/55">Cambia de pestaña: el texto y el estado de los Fields se conservan.</p>
            </FormGroup>
          </NotebookPage>
          <NotebookPage name="delivery" label="Contacto y entrega" icon={<Mail size={16} />} badge="2">
            <FormGroup legend="Contacto para la entrega">
              <FieldText<FormViewSampleValues> name="delivery.email" label="Correo de contacto" placeholder="contacto@ejemplo.com" />
              <p className="text-xs text-base-content/55">Prueba un correo inválido, regresa a Notas y guarda: esta pestaña se abrirá y mostrará su indicador de error.</p>
            </FormGroup>
            <FormGroup legend="Entrega">
              <FieldText<FormViewSampleValues> name="delivery.instructions" label="Indicaciones de entrega" widget="long" rows={4} maxLength={300} />
            </FormGroup>
          </NotebookPage>
          <NotebookPage name="attachments" label="Adjuntos" icon={<Paperclip size={16} />} disabled>
            <p className="text-sm text-base-content/60">Página deshabilitada de ejemplo.</p>
          </NotebookPage>
        </Notebook>
      </FormView>
    </section>
    <SelectableStatebarSample />
    {report && <FormViewReport html={report} onClose={() => setReport(undefined)} />}
  </>;
}

export default function FormViewSample() {
  return <section id="form-view" className="min-w-0 scroll-mt-6">
    <FormViewLoader recordKey="sample-document" load={loadFormViewExample}>
      {record => <DocumentForm record={record} />}
    </FormViewLoader>
  </section>;
}
