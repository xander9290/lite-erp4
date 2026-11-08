"use client";

import Link from "next/link";
import { CalendarDays, ChevronLeft, UsersRound } from "lucide-react";
import ListView from "@/components/ui/list/ListView";
import { appointmentListConfig } from "../list.config";
import { formatClinicDate } from "../agenda";
import { appointmentStatusOptions } from "../schemas/appointment.schema";
import { dentalClinicTimeZone } from "../settings";

export default function AppointmentList() {
  return <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden p-3 sm:p-6"><div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4">
    <Link href="/erp" className="inline-flex w-fit shrink-0 items-center gap-1 rounded-sm text-sm text-base-content/60 hover:text-primary focus-visible:outline-2 focus-visible:outline-primary"><ChevronLeft size={16} aria-hidden="true" />Aplicaciones</Link>
    <ListView {...appointmentListConfig} title="Citas odontológicas" description="Agenda y seguimiento de tus pacientes." icon={<CalendarDays size={22} />}
      createHref="/erp/citas/nuevo" createLabel="Nueva cita" recordHref="/erp/citas/{id}"
      headerActions={<Link href="/erp/contactos" className="btn btn-ghost btn-sm gap-2"><UsersRound size={16} aria-hidden="true" />Contactos</Link>}
      footer={<span className="text-xs text-base-content/50">Horario del consultorio · {dentalClinicTimeZone}</span>}
      renderCell={(record, column) => {
        if (column.field === "scheduledAt") return <span className="whitespace-nowrap tabular-nums">{formatClinicDate(String(record.scheduledAt))}</span>;
        if (column.field === "reason") return <span className="line-clamp-2" title={String(record.reason)}>{String(record.reason)}</span>;
        if (column.field !== "status") return undefined;
        const agenda = record.agenda as { text: string; tone: string };
        const label = appointmentStatusOptions.find(option => option.value === record.status)?.label;
        const tone = agenda.tone === "error" ? "badge-error" : agenda.tone === "success" ? "badge-success" : agenda.tone === "primary" ? "badge-primary" : "badge-ghost";
        return <div className="flex flex-col items-start gap-1.5"><span className={`badge badge-soft badge-sm whitespace-nowrap ${tone}`}>{agenda.text}</span>{record.status === "SCHEDULED" && <span className="text-xs text-base-content/50">{label}</span>}</div>;
      }} />
  </div></div>;
}
