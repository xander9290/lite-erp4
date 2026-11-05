"use client";

import { useCallback, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Bell, FileText } from "lucide-react";
import { useAlerts } from "@/components/ui/alerts/AlertProvider";
import Modal from "@/components/ui/alerts/Modal";
import FormView from "@/components/ui/form/FormView";
import FormViewLoader from "@/components/ui/form/FormViewLoader";
import FormGroup from "@/components/ui/form/FormGroup";
import FieldText from "@/components/ui/form/FieldText";
import { formViewSchema, type FormViewSampleValues } from "./formView.schema";
import { loadFormViewExample, saveFormViewExample } from "./formView.actions";

function RecordPreview({ record }: { record: FormViewSampleValues }) {
  const methods = useForm<FormViewSampleValues>({ resolver: zodResolver(formViewSchema), defaultValues: record });
  return <FormView methods={methods} title="Registro cargado" readOnly onSubmit={saveFormViewExample}>
    <FormGroup legend="Datos del servidor"><FieldText name="reference" label="Referencia de prueba" /><FieldText name="customer" label="Cliente de prueba" /></FormGroup>
  </FormView>;
}

export default function AlertsSample() {
  const alerts = useAlerts();
  const [custom, setCustom] = useState(false);
  const [answer, setAnswer] = useState<string>();
  const [record, setRecord] = useState<"example" | "missing" | null>(null);
  const [version, setVersion] = useState(0);
  const load = useCallback(() => loadFormViewExample(record), [record]);
  async function confirm() {
    const accepted = await alerts.confirm({ title: "Confirmar acción", message: "¿Deseas continuar con esta acción de ejemplo?", confirmLabel: "Sí, continuar", cancelLabel: "Volver" });
    setAnswer(accepted ? "Acción confirmada." : "Acción cancelada; no se ejecutó ningún cambio.");
  }
  function openRecord(value: "example" | "missing") { setRecord(value); setVersion(value => value + 1); }
  return <section id="alerts" aria-labelledby="alerts-sample-title" className="card min-w-0 scroll-mt-6 border border-base-300 bg-base-100 shadow-sm">
    <div className="card-body min-w-0 gap-5 p-4 sm:p-6">
      <header className="flex items-start gap-3"><span aria-hidden="true" className="rounded-xl bg-primary/10 p-2.5 text-primary"><Bell size={21} /></span><div className="space-y-1"><h2 id="alerts-sample-title" className="text-xl font-semibold">Alertas y modales</h2><p className="text-sm text-base-content/60">Diálogos en orden, confirmaciones y carga de registros. Ejemplos sin escritura en base de datos.</p></div></header>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn btn-soft btn-sm" onClick={() => void alerts.info({ message: "Puedes continuar trabajando. Este aviso solo requiere tu atención." })}>Información</button>
        <button type="button" className="btn btn-soft btn-error btn-sm" onClick={() => void alerts.error({ message: "No se pudo completar la operación. Puedes intentarlo nuevamente." })}>Error</button>
        <button type="button" className="btn btn-soft btn-sm" onClick={() => void alerts.validation({ message: "Revisa los datos antes de continuar.", details: ["La referencia ya existe.", "El importe debe ser mayor que cero."] })}>Error de validación</button>
        <button type="button" className="btn btn-soft btn-sm" onClick={() => void confirm()}>Confirmación</button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setCustom(true)}>Modal personalizado</button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => {
          void alerts.info({ title: "Primer aviso", message: "Al cerrar este diálogo aparecerá el siguiente." });
          void alerts.info({ title: "Segundo aviso", message: "Los avisos se muestran uno a la vez." });
        }}>Probar cola</button>
      </div>
      {answer && <p role="status" className="rounded-xl bg-base-200 p-3 text-sm text-base-content/65">{answer}</p>}
      <div className="space-y-3 border-t border-base-300 pt-4">
        <p className="text-sm text-base-content/65">FormViewLoader muestra «Cargando…» hasta recibir el registro. Si falla, informa el error y permite reintentar.</p>
        <div className="flex flex-wrap gap-2"><button type="button" className="btn btn-primary btn-sm" onClick={() => openRecord("example")}>Abrir registro de prueba</button><button type="button" className="btn btn-soft btn-sm" onClick={() => openRecord("missing")}>Simular fallo de carga</button>{record && <button type="button" className="btn btn-ghost btn-sm" onClick={() => setRecord(null)}>Cerrar registro de prueba</button>}</div>
        {record && <FormViewLoader recordKey={`${record}:${version}`} load={load}>{data => <RecordPreview record={data} />}</FormViewLoader>}
      </div>
      <p className="text-xs text-base-content/50">En el FormView de abajo, usa DUPLICADO como referencia para probar el rechazo de validación del servidor sin perder lo que editaste.</p>
    </div>
    <Modal open={custom} title="Modal personalizado" icon={<FileText size={22} />} onClose={() => setCustom(false)} footer={<button type="button" className="btn btn-primary btn-sm" onClick={() => setCustom(false)}>Listo</button>}>
      <p>Este contenedor admite contenido propio, formularios o instrucciones. Conserva el estilo del sitio y devuelve el foco al cerrarse.</p>
    </Modal>
  </section>;
}
