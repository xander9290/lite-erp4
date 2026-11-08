"use client";

import { startTransition, useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, History, RefreshCw } from "lucide-react";
import { readPatientHistory } from "../actions/appointment.actions";
import type { PatientHistoryPage } from "../models/appointment.service";
import type { FormViewLoadResult } from "@/components/ui/form/FormViewLoader";
import { formatClinicDate } from "../agenda";

export default function PatientHistory({ patientId, revision, enabled }: { patientId: string; revision: string; enabled: boolean }) {
  const [page, setPage] = useState(1);
  const [attempt, setAttempt] = useState(0);
  const [response, setResponse] = useState<{ key: string; result: FormViewLoadResult<PatientHistoryPage> } | null>(null);
  const key = JSON.stringify([patientId, revision, page, attempt]);
  useEffect(() => {
    if (!enabled) return;
    let current = true;
    startTransition(() => {
      void readPatientHistory({ patientId, page, pageSize: 5 }).catch((): FormViewLoadResult<PatientHistoryPage> => ({ ok: false, error: "No se pudo cargar el historial. Intenta nuevamente." }))
        .then(result => { if (current) setResponse({ key, result }); });
    });
    return () => { current = false; };
  }, [key, patientId, page, enabled]);
  const result = response?.key === key ? response.result : null;
  if (!result) return <div role="status" className="flex items-center justify-center gap-3 py-10 text-sm text-base-content/60"><span className="loading loading-spinner loading-sm text-primary" aria-hidden="true" />Cargando historial…</div>;
  if (!result.ok) return <div role="alert" className="space-y-3 rounded-xl bg-base-200/50 p-5 text-sm"><p>{result.error}</p><button type="button" className="btn btn-soft btn-sm" onClick={() => setAttempt(value => value + 1)}>Reintentar</button></div>;
  const data = result.values;
  return <section aria-label="Historial de tratamientos" className="min-w-0 space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-semibold">Historial de {data.patient.name}</h3><p className="mt-1 text-xs text-base-content/55">Tratamientos guardados de todas sus citas. Los cambios de esta cita aparecerán al guardar.</p></div><button type="button" aria-label="Actualizar historial" className="btn btn-ghost btn-sm gap-2" onClick={() => setAttempt(value => value + 1)}><RefreshCw size={14} aria-hidden="true" />Actualizar</button></div>
    {data.rows.length ? <ol className="space-y-3">{data.rows.map(row => <li key={row.id} className="rounded-xl border border-base-300 bg-base-200/30 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2"><h4 className="min-w-0 flex-1 text-sm font-semibold wrap-anywhere">{row.procedure}</h4><time dateTime={row.performedAt!} className="text-xs text-base-content/55 tabular-nums">{formatClinicDate(row.performedAt!)}</time></div>
      {row.observations && <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-base-content/65 wrap-anywhere">{row.observations}</p>}
      <Link href={`/erp/citas/${encodeURIComponent(row.appointment.id)}`} className="mt-3 inline-block rounded-sm text-xs font-medium text-primary hover:underline focus-visible:outline-2 focus-visible:outline-primary">Ver cita · {formatClinicDate(row.appointment.scheduledAt)}</Link>
    </li>)}</ol> : <div className="flex flex-col items-center gap-2 rounded-xl bg-base-200/40 px-5 py-10 text-center"><History size={26} aria-hidden="true" className="text-base-content/35" /><p className="text-sm text-base-content/60">Este paciente todavía no tiene tratamientos guardados.</p></div>}
    <footer className="flex flex-wrap items-center justify-between gap-3 text-xs text-base-content/55"><span role="status">{data.total} tratamiento{data.total === 1 ? "" : "s"} · Horario del consultorio</span><div className="flex items-center gap-2"><button type="button" className="btn btn-ghost btn-square btn-sm" aria-label="Página anterior del historial" disabled={data.page <= 1} onClick={() => setPage(data.page - 1)}><ChevronLeft size={16} aria-hidden="true" /></button><span className="tabular-nums">{data.page} / {data.pageCount}</span><button type="button" className="btn btn-ghost btn-square btn-sm" aria-label="Página siguiente del historial" disabled={data.page >= data.pageCount} onClick={() => setPage(data.page + 1)}><ChevronRight size={16} aria-hidden="true" /></button></div></footer>
  </section>;
}
