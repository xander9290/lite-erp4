"use client";
import { useCallback, useRef, useState } from "react";
import { CalendarDays, FolderKanban, LayoutGrid, ShieldCheck } from "lucide-react";
import CardView from "@/components/ui/card/CardView";
import KanbanView from "@/components/ui/kanban/KanbanView";
import type { KanbanMove, KanbanMoveResult, KanbanRequest } from "@/lib/kanban/types";
import type { ListRecord, ListState } from "@/lib/list/types";
import { createDemoRecords, demoColumns, demoGroups, demoMoveSchema, demoPage } from "./collection-demo";

function ProjectCard({ record }: { record: ListRecord }) {
  const status = demoGroups.find(group => group.value === record.status);
  return <div className="space-y-4 p-4"><div className="flex items-center justify-between gap-2"><span className={`badge badge-sm badge-soft ${record.status === "done" ? "badge-success" : record.status === "progress" ? "badge-info" : "badge-ghost"}`}>{status?.label}</span>{record.locked === true && <span className="badge badge-sm badge-soft badge-warning" title="Requiere validación antes de finalizar"><ShieldCheck size={12} aria-hidden="true" />Revisión</span>}</div><h3 className="font-semibold leading-snug wrap-anywhere">{String(record.name)}</h3><p className="text-sm text-base-content/55">{String(record.client)}</p><div className="flex flex-wrap items-center justify-between gap-2 border-t border-base-200 pt-3 text-xs"><span className="inline-flex items-center gap-1.5 text-base-content/50"><CalendarDays size={13} aria-hidden="true" />{new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short" }).format(new Date(String(record.deadline)))}</span><span className="font-semibold tabular-nums">{new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(Number(record.amount))}</span></div></div>;
}
const renderProject = (record: ListRecord) => <ProjectCard record={record} />;
export default function CollectionViewsSample() {
  const records = useRef(createDemoRecords()), [version, setVersion] = useState(0);
  const load = useCallback(async (state: ListState) => demoPage(records.current, state), []);
  const loadColumn = useCallback(async ({ group, state }: KanbanRequest) => demoPage(records.current, state, group), []);
  const move = useCallback(async (input: KanbanMove): Promise<KanbanMoveResult> => {
    const parsed = demoMoveSchema.safeParse(input);
    if (!parsed.success) return { ok: false, kind: "validation", error: "Movimiento inválido." };
    const current = records.current.find(record => record.id === parsed.data.id);
    if (!current || current.revision !== parsed.data.revision || current.status !== parsed.data.from) return { ok: false, kind: "validation", error: "La tarjeta cambió. Actualiza el tablero antes de moverla." };
    if (current.locked === true && parsed.data.to === "done") return { ok: false, kind: "validation", error: "Esta tarjeta requiere revisión antes de pasar a Finalizado. Su estado se conserva." };
    records.current = records.current.map(record => record.id === current.id ? { ...record, status: parsed.data.to, revision: new Date(Math.max(Date.now(), Date.parse(String(current.revision)) + 1)).toISOString() } : record);
    setVersion(value => value + 1); return { ok: true };
  }, []);
  return <>
    <section id="card-view" className="min-w-0 scroll-mt-6 space-y-3"><header className="px-1"><h2 className="text-xl font-semibold">CardView</h2><p className="mt-1 text-sm text-base-content/60">Tarjetas en cuadrícula, búsqueda, filtros por tipo y paginación. Los cambios de esta demo son locales y se reinician al recargar.</p></header><CardView key={version} model="ProjectDemo" title="Proyectos" description="Una vista compacta de cada registro." icon={<LayoutGrid size={23} />} columns={demoColumns} searchFields={["name", "client"]} titleField="name" load={load} renderCard={renderProject} pageSize={6} paramPrefix="cards" className="h-[42rem]" /></section>
    <section id="kanban-view" className="min-w-0 scroll-mt-6 space-y-3"><header className="px-1"><h2 className="text-xl font-semibold">KanbanView</h2><p className="mt-1 text-sm text-base-content/60">Arrastra desde el asa, utiliza el teclado o el selector de estado. «Validar permisos» demuestra el rechazo de una regla de negocio.</p></header><KanbanView model="ProjectDemo" title="Tablero de proyectos" description="Cada columna tiene su propio contador y carga por páginas." icon={<FolderKanban size={23} />} columns={demoColumns} searchFields={["name", "client"]} titleField="name" groupField="status" groups={demoGroups} load={loadColumn} onMove={move} renderCard={renderProject} pageSize={3} paramPrefix="board" className="h-[46rem]" footer={<span className="badge badge-sm badge-ghost">Demo local · sin base de datos</span>} /></section>
  </>;
}
