"use client";

import { useId, useSyncExternalStore } from "react";
import { History } from "lucide-react";
import type { RecordAudit } from "@/lib/orm/audit";
import FieldMany2One from "./FieldMany2One";

const subscribe = () => () => {};
const clientSnapshot = () => true;
const serverSnapshot = () => false;

/** Authorized read metadata only; never register audit information with RHF. */
export default function FormAuditPanel({ audit, creating = false }: { audit: RecordAudit | null; creating?: boolean }) {
  const titleId = useId();
  const ready = useSyncExternalStore(subscribe, clientSnapshot, serverSnapshot);
  function timestamp(value: string) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return <span>Sin información</span>;
    return <time dateTime={value}>{ready ? date.toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" }) : "…"}</time>;
  }
  return <aside aria-labelledby={titleId} className="m-4 min-w-0 self-start rounded-xl border border-base-300 bg-base-200/30 p-4 sm:m-6 @4xl/form:sticky @4xl/form:top-6 @4xl/form:ml-0">
    <h3 id={titleId} className="mb-5 flex items-center gap-2 text-sm font-semibold"><History size={16} aria-hidden="true" className="text-base-content/50" />Auditoría</h3>
    {audit ? <div className="space-y-5">
      <FieldMany2One mode="display" label="Creado por" emptyText="Creador no registrado" value={audit.createBy ? { id: audit.createBy.id, label: `[${audit.createBy.login}] ${audit.createBy.name}`, avatarUrl: audit.createBy.avatarUrl } : null} />
      <dl className="space-y-4 text-sm"><div><dt className="mb-1 text-xs text-base-content/55">Creado el</dt><dd className="wrap-anywhere">{timestamp(audit.createdAt)}</dd></div><div><dt className="mb-1 text-xs text-base-content/55">Última actualización</dt><dd className="wrap-anywhere">{timestamp(audit.updatedAt)}</dd></div></dl>
    </div> : <p className="text-sm leading-relaxed text-base-content/55">{creating ? "La información estará disponible después de guardar el registro." : "No hay información de auditoría disponible."}</p>}
  </aside>;
}
