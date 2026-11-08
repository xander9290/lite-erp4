import { Suspense } from "react";
import KanbanViewClient from "./KanbanViewClient";
import type { CollectionProps } from "../collection/types";
import type { KanbanGroup, KanbanLoader, KanbanMover } from "@/lib/kanban/types";

export type KanbanViewProps = CollectionProps & { groupField: string; groups: readonly KanbanGroup[]; load: KanbanLoader; onMove?: KanbanMover };
export type { KanbanGroup, KanbanRequest, KanbanMove, KanbanMoveResult } from "@/lib/kanban/types";
export default function KanbanView(props: KanbanViewProps) {
  if (!props.groups.length || props.groups.length > 12 || new Set(props.groups.map(group => group.value)).size !== props.groups.length || props.groups.some(group => !group.value || !group.label)) return <p role="alert" className="rounded-xl bg-error/10 p-4 text-error">Configura entre 1 y 12 columnas con estados únicos.</p>;
  return <Suspense fallback={<div role="status" className="skeleton min-h-80 rounded-2xl motion-reduce:animate-none"><span className="sr-only">Cargando tablero…</span></div>}><KanbanViewClient {...props} /></Suspense>;
}
