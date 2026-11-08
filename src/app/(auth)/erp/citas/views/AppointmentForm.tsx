"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarDays, ChevronLeft, ClipboardList, History, RefreshCw, StickyNote } from "lucide-react";
import FormView from "@/components/ui/form/FormView";
import FormViewLoader from "@/components/ui/form/FormViewLoader";
import FormGroup from "@/components/ui/form/FormGroup";
import FieldText from "@/components/ui/form/FieldText";
import FieldDate from "@/components/ui/form/FieldDate";
import FieldMany2One from "@/components/ui/form/FieldMany2One";
import FieldSelect from "@/components/ui/form/FieldSelect";
import FieldOne2many, { type One2manyColumn } from "@/components/ui/form/FieldOne2many";
import Notebook from "@/components/ui/form/Notebook";
import NotebookPage from "@/components/ui/form/NotebookPage";
import { useFormNavigation } from "@/components/ui/form/FormNavigationProvider";
import { useAlerts } from "@/components/ui/alerts/AlertProvider";
import { readAppointment, saveAppointment } from "../actions/appointment.actions";
import { appointmentSchema, appointmentStatusOptions, newAppointmentDefaults, type AppointmentInput, type AppointmentValues } from "../schemas/appointment.schema";
import { createTreatment } from "../schemas/treatment.schema";
import PatientHistory from "./PatientHistory";
import { appointmentReturnHref } from "../navigation";

const treatmentColumns: One2manyColumn<AppointmentInput, "treatments">[] = [
  { key: "performedAt", label: "Fecha y hora", width: "28%", render: ({ fieldName, index }) => <FieldDate<AppointmentInput> name={fieldName("performedAt")} type="datetime" required aria-label={`Fecha del tratamiento ${index + 1}`} /> },
  { key: "procedure", label: "Procedimiento", width: "36%", render: ({ fieldName, index }) => <FieldText<AppointmentInput> name={fieldName("procedure")} required placeholder="Procedimiento realizado" maxLength={1000} aria-label={`Procedimiento ${index + 1}`} /> },
  { key: "observations", label: "Observaciones", render: ({ fieldName, index }) => <FieldText<AppointmentInput> name={fieldName("observations")} widget="long" rows={2} placeholder="Notas del tratamiento" maxLength={10000} aria-label={`Observaciones del tratamiento ${index + 1}`} /> },
];

function AppointmentRecordForm({ record, onReload, returnHref }: { record: AppointmentInput; onReload?: () => void; returnHref: string }) {
  const router = useRouter();
  const methods = useForm<AppointmentInput, unknown, AppointmentValues>({ resolver: zodResolver(appointmentSchema), defaultValues: record });
  const [savedId, setSavedId] = useState(record.id);
  const [tab, setTab] = useState("treatments");
  const patientId = useWatch({ control: methods.control, name: "patientId" });
  const treatments = useWatch({ control: methods.control, name: "treatments" });
  const revision = useWatch({ control: methods.control, name: "revision" });
  const returnQuery = returnHref === "/erp/citas" ? "" : `?returnTo=${encodeURIComponent(returnHref)}`;
  return <FormView title={savedId ? "Cita odontológica" : "Nueva cita"} description="Agenda, atención y seguimiento del paciente." icon={<CalendarDays size={22} />}
    methods={methods} mode={savedId ? "edit" : "create"} onSubmit={saveAppointment}
    statebar={<FieldSelect<AppointmentInput, string> name="status" label="Estado" widget="statebar" readOnly={false} options={appointmentStatusOptions} />}
    onNew={savedId ? () => router.push(`/erp/citas/nuevo${returnQuery}`) : undefined} newLabel="Nueva cita"
    menuActions={onReload ? [{ id: "reload", label: "Recargar registro", icon: <RefreshCw size={16} />, onSelect: onReload }] : undefined}
    onSaved={values => {
      setSavedId(values.id);
      if (!record.id && values.id) router.replace(`/erp/citas/${encodeURIComponent(values.id)}${returnQuery}`);
      router.refresh();
    }}
    footer={<p className="text-xs leading-relaxed text-base-content/55">La cita, su estado y los tratamientos se guardan juntos. Puedes programar una cita sin añadir tratamientos.</p>}>
    <FormGroup legend="Paciente y consulta">
      <FieldMany2One<AppointmentInput> name="patientId" label="Paciente" model="partner" searchFields={["name", "email", "phone"]} displayName="{name}" required autoFocus={!savedId} placeholder="Buscar por nombre, teléfono o correo…" />
      <FieldText<AppointmentInput> name="reason" label="Motivo de la cita" widget="long" rows={2} required maxLength={1000} placeholder="¿Cuál es el motivo de la consulta?" />
    </FormGroup>
    <FormGroup legend="Agenda">
      <FieldDate<AppointmentInput> name="scheduledAt" label="Fecha y hora de la cita" type="datetime" required />
      <p className="text-xs leading-relaxed text-base-content/55">Captura la hora local de tu navegador. La agenda y el historial se muestran en el horario del consultorio.</p>
      <Link href="/erp/contactos/nuevo" className="w-fit rounded-sm text-xs font-medium text-primary hover:underline focus-visible:outline-2 focus-visible:outline-primary">Registrar un nuevo paciente</Link>
    </FormGroup>
    <Notebook label="Seguimiento de la cita" activePage={tab} onPageChange={setTab}>
      <NotebookPage name="treatments" label="Tratamientos" icon={<ClipboardList size={16} />} badge={treatments?.length || undefined}>
        <FieldOne2many<AppointmentInput, "treatments"> name="treatments" label="Tratamientos realizados" columns={treatmentColumns} createRow={createTreatment} maxRows={100} reorderable addLabel="Agregar tratamiento" emptyText="Aún no hay tratamientos en esta cita." />
      </NotebookPage>
      <NotebookPage name="notes" label="Observaciones" icon={<StickyNote size={16} />}><FormGroup legend="Notas del odontólogo" fullWidth><FieldText<AppointmentInput> name="observations" label="Observaciones de la cita" widget="long" rows={5} maxLength={10000} placeholder="Anota el seguimiento y las observaciones generales…" /></FormGroup></NotebookPage>
      <NotebookPage name="history" label="Historial del paciente" icon={<History size={16} />}>
        <div className="col-span-full min-w-0">{patientId ? <PatientHistory key={patientId} patientId={patientId} revision={revision} enabled={tab === "history"} /> : <p className="rounded-xl bg-base-200/40 p-5 text-sm text-base-content/60">Selecciona un paciente para consultar su historial.</p>}</div>
      </NotebookPage>
    </Notebook>
  </FormView>;
}

export default function AppointmentForm({ id }: { id?: string }) {
  const router = useRouter();
  const returnHref = appointmentReturnHref(useSearchParams().get("returnTo"));
  const navigation = useFormNavigation();
  const alerts = useAlerts();
  const [reloadKey, setReloadKey] = useState(0);
  const load = useCallback(() => readAppointment(id!), [id]);
  const reload = () => {
    void navigation.run(() => setReloadKey(key => key + 1)).catch(() => { void alerts.error({ title: "No se pudo recargar la cita", message: "Intenta nuevamente. Tus cambios siguen en el formulario." }); });
  };
  return <div className="min-h-0 min-w-0 flex-1 overflow-y-auto p-3 sm:p-6"><div className="mx-auto flex w-full min-w-0 max-w-5xl flex-col gap-4">
    <Link href={returnHref} className="inline-flex w-fit items-center gap-1 rounded-sm text-sm text-base-content/60 hover:text-primary focus-visible:outline-2 focus-visible:outline-primary"><ChevronLeft size={16} aria-hidden="true" />Citas odontológicas</Link>
    {id ? <FormViewLoader key={`${router.bfcacheId}:${reloadKey}`} recordKey={id} load={load}>{record => <AppointmentRecordForm record={record} onReload={reload} returnHref={returnHref} />}</FormViewLoader>
      : <AppointmentRecordForm key={router.bfcacheId} record={{ ...newAppointmentDefaults, treatments: [] }} returnHref={returnHref} />}
  </div></div>;
}
