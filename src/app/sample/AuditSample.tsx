"use client";

import { useState, useSyncExternalStore } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import FormView from "@/components/ui/form/FormView";
import FormGroup from "@/components/ui/form/FormGroup";
import FieldText from "@/components/ui/form/FieldText";
import FieldMany2One from "@/components/ui/form/FieldMany2One";
import ListView from "@/components/ui/list/ListView";
import { recordAuditColumns, type RecordAudit } from "@/lib/orm/audit";
import type { ListResult } from "@/lib/list/types";

const schema = z.strictObject({ name: z.string().trim().min(1, "Introduce un nombre.").max(120) });
type Values = z.infer<typeof schema>;
const initialAudit: RecordAudit = {
  createdAt: "2026-11-08T16:00:00.000Z", updatedAt: "2026-11-08T16:00:00.000Z",
  createBy: { id: "demo-user", login: "alex.demo", name: "Alex · demostración", avatarUrl: null },
};
const previewColumns = recordAuditColumns.map(column => ({ ...column, sortable: false, filterable: false }));
const subscribe = () => () => {};
const hydrated = () => true;
const server = () => false;
async function loadPreview(): Promise<ListResult> {
  return { ok: true, data: { rows: [
    { id: "demo-record", createByUser: { login: "alex.demo", partner: { name: "Alex · demostración", avatarUrl: null } }, createdAt: initialAudit.createdAt, updatedAt: initialAudit.updatedAt },
    { id: "legacy-record", createByUser: null, createdAt: initialAudit.createdAt, updatedAt: initialAudit.updatedAt },
  ], total: 2, page: 1, pageSize: 25 } };
}

export default function AuditSample() {
  const ready = useSyncExternalStore(subscribe, hydrated, server);
  const methods = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { name: "Vehículo de demostración" } });
  const [audit, setAudit] = useState(initialAudit);
  const [submitted, setSubmitted] = useState<Values | null>(null);
  const [legacy, setLegacy] = useState(false);
  const visible = { ...audit, createBy: legacy ? null : initialAudit.createBy };
  return <section id="record-audit" className="min-w-0 scroll-mt-6 space-y-4">
    <header className="space-y-1 px-1"><h2 className="text-xl font-semibold">Auditoría · solo lectura</h2><p className="text-sm text-base-content/60">Datos ficticios, sin persistencia. El creador está fuera de RHF: no se valida, no se envía y no altera isDirty.</p></header>
    <FormView title="Registro de ejemplo" methods={methods} onSubmit={async values => {
      const next = { ...visible, updatedAt: new Date().toISOString() };
      setSubmitted(values);
      return { ok: true, values, audit: next, message: "Ejemplo validado localmente." };
    }} onSaved={(_values, next) => { if (next) setAudit(next); }} footer={<span className="text-xs text-base-content/55">Solo el nombre pertenece al formulario. Las fechas se muestran en la zona del navegador.</span>}>
      <FormGroup legend="Datos editables"><FieldText<Values> name="name" label="Nombre" required /></FormGroup>
      <FormGroup legend="Información del registro">
        <FieldMany2One mode="display" label="Creado por" value={visible.createBy ? { id: visible.createBy.id, label: `[${visible.createBy.login}] ${visible.createBy.name}`, avatarUrl: visible.createBy.avatarUrl } : null} />
        <dl className="grid gap-2 text-xs text-base-content/60"><div><dt>Creado el</dt><dd><time dateTime={visible.createdAt}>{ready ? new Date(visible.createdAt).toLocaleString("es-MX") : "…"}</time></dd></div><div><dt>Actualizado el</dt><dd><time dateTime={visible.updatedAt}>{ready ? new Date(visible.updatedAt).toLocaleString("es-MX") : "…"}</time></dd></div></dl>
        <button type="button" className="btn btn-ghost btn-xs w-fit" onClick={() => setLegacy(value => !value)}>{legacy ? "Mostrar creador de ejemplo" : "Simular registro antiguo"}</button>
      </FormGroup>
    </FormView>
    <ListView model="AuditDemo" title="Auditoría en ListView" description="Vista previa de dos registros: uno con autor y otro anterior a la auditoría." columns={previewColumns} searchFields={[]} load={loadPreview} paramPrefix="audit" className="h-80" />
    <div className="rounded-xl bg-base-100 p-4 text-xs"><p className="mb-2 font-medium">Payload validado con Zod · sin auditoría</p><pre className="overflow-x-auto">{submitted ? JSON.stringify(submitted, null, 2) : "Edita el nombre y guarda el ejemplo."}</pre><p role="status" className="mt-2 text-base-content/55">{methods.formState.isDirty ? "Con cambios" : "Sin cambios"}</p></div>
  </section>;
}
