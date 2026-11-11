"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { RefreshCw } from "lucide-react";
import FormView from "@/components/ui/form/FormView";
import FormViewLoader from "@/components/ui/form/FormViewLoader";
import FormGroup from "@/components/ui/form/FormGroup";
import FieldText from "@/components/ui/form/FieldText";
import FieldBoolean from "@/components/ui/form/FieldBoolean";

import { useFormNavigation } from "@/components/ui/form/FormNavigationProvider";
import { useAlerts } from "@/components/ui/alerts/AlertProvider";
import { readRecord, saveRecord, loadActivity, addNote } from "../actions/fabricante.actions";
import { recordSchema, createRecordDefaults, type RecordInput, type RecordValues } from "../schemas/fabricante.schema";

function Editor({ record, onReload }: { record: RecordInput; onReload?: () => void }) {
  const router = useRouter();
  const [savedId, setSavedId] = useState(record.id);
  const methods = useForm<RecordInput, unknown, RecordValues>({ resolver: zodResolver(recordSchema), defaultValues: record });
  return <FormView layout="page" breadcrumbs={[{ label: "Aplicaciones", href: "/erp" }, { label: "Fabricante", href: "/erp/flota/fabricante" }, { label: savedId ? String(record.name ?? "Registro") : "Nuevo registro" }]} title={savedId ? "Editar registro" : "Nuevo registro"} methods={methods} activity={{ recordId: savedId, load: loadActivity, addNote }} mode={savedId ? "edit" : "create"} onSubmit={saveRecord}
    onNew={savedId ? () => router.push("/erp/flota/fabricante/nuevo") : undefined}
    onSaved={values => { setSavedId(values.id); if (!record.id && values.id) router.replace("/erp/flota/fabricante/" + encodeURIComponent(values.id)); router.refresh(); }}
    menuActions={onReload ? [{ id: "reload", label: "Recargar registro", icon: <RefreshCw size={16} />, onSelect: onReload }] : undefined}
    footer={<p className="text-xs text-base-content/55">Los cambios se guardan al presionar Guardar.</p>}>
    <FormGroup legend="Datos generales">
      <FieldText<RecordInput> name="name" label={"Nombre"} direction="inline" required maxLength={120} />
      <FieldText<RecordInput> name="logo" label={"Logotipo"} direction="inline" />
      <FieldBoolean<RecordInput> name="active" label={"Activo"} direction="inline" />
    </FormGroup>
  </FormView>;
}

export default function FabricanteForm({ id }: { id?: string }) {
  const router = useRouter();
  const navigation = useFormNavigation();
  const alerts = useAlerts();
  const [attempt, setAttempt] = useState(0);
  const load = useCallback(() => readRecord(id!), [id]);
  const reload = () => { void navigation.run(() => setAttempt(value => value + 1)).catch(() => { void alerts.error({ title: "No se pudo recargar el registro", message: "Intenta nuevamente. Tus cambios siguen en el formulario." }); }); };
  return <>
    {id ? <FormViewLoader key={router.bfcacheId + ":" + id + ":" + attempt} recordKey={id} load={load}>{record => <Editor record={record} onReload={reload} />}</FormViewLoader> : <Editor key={router.bfcacheId} record={createRecordDefaults()} />}
  </>;
}
