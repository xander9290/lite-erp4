"use client";
import { useCallback, useId, useRef, useState } from "react";
import { DndContext, DragOverlay, KeyboardSensor, PointerSensor, pointerWithin, rectIntersection, useSensor, useSensors, type KeyboardCoordinateGetter } from "@dnd-kit/core";
import { Columns3 } from "lucide-react";
import type { ListRecord } from "@/lib/list/types";
import { useAlerts } from "../alerts/AlertProvider";
import CollectionToolbar from "../collection/CollectionToolbar";
import { CollectionShell } from "../collection/CollectionShell";
import { useCollectionState } from "../collection/useCollectionState";
import RecordCard, { recordCardTitle } from "../collection/RecordCard";
import KanbanColumn from "./KanbanColumn";
import type { KanbanViewProps } from "./KanbanView";

export default function KanbanViewClient(props: KanbanViewProps) {
  const config = { model: props.model, columns: props.columns, searchFields: props.searchFields ?? [], defaultSort: props.defaultSort };
  const query = useCollectionState(config, props.pageSize ?? 10, props.paramPrefix ?? "");
  const [attempt, setAttempt] = useState(0), [pending, setPending] = useState<string | null>(null), [dragging, setDragging] = useState<ListRecord | null>(null), [announcement, setAnnouncement] = useState("");
  const mutex = useRef(false), focus = useRef<string | null>(null);
  const settled = useRef({ version: "", groups: new Set<string>() });
  const alerts = useAlerts(), id = useId();
  const version = JSON.stringify({ ...query.state, page: 1, groupField: props.groupField, attempt });
  const registerHandle = useCallback((recordId: string, node: HTMLButtonElement | null) => { if (node && focus.current === recordId) { node.focus({ preventScroll: true }); focus.current = null; } }, []);
  const onSettled = useCallback((group: string) => { if (settled.current.version !== version) settled.current = { version, groups: new Set() }; settled.current.groups.add(group); if (settled.current.groups.size === props.groups.length) focus.current = null; }, [version, props.groups.length]);
  const coordinates: KeyboardCoordinateGetter = (event, args) => {
    if (!["ArrowLeft", "ArrowRight"].includes(event.code)) return;
    event.preventDefault();
    const current = String(args.context.over?.id ?? args.context.active?.data.current?.group ?? "");
    const index = props.groups.findIndex(group => group.value === current);
    const next = props.groups[index + (event.code === "ArrowRight" ? 1 : -1)];
    const rect = next ? args.context.droppableRects.get(next.value) : null;
    return rect ? { x: rect.left + 12, y: rect.top + 72 } : args.currentCoordinates;
  };
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor, { coordinateGetter: coordinates }));
  async function move(record: ListRecord, from: string, to: string) {
    if (mutex.current || !props.onMove || from === to || typeof record.revision !== "string" || !props.groups.some(group => group.value === to)) return;
    mutex.current = true; setPending(record.id);
    try {
      const result = await props.onMove({ id: record.id, revision: record.revision, from, to });
      if (!result.ok) { setAnnouncement("No se guardó el movimiento."); await (result.kind === "validation" ? alerts.validation : alerts.error)({ message: result.error }); }
      else { setAnnouncement("Movimiento guardado. Se actualizaron las columnas."); }
    } catch { setAnnouncement("No se pudo confirmar el movimiento."); await alerts.error({ message: "No pudimos confirmar el cambio. Se recargará el tablero para mostrar el estado del servidor." }); }
    finally { focus.current = record.id; setAttempt(value => value + 1); setPending(null); mutex.current = false; }
  }
  return <CollectionShell {...props} icon={props.icon ?? <Columns3 size={23} aria-hidden="true" />} busy={Boolean(pending)} refresh={() => setAttempt(value => value + 1)}
    toolbar={slots => <CollectionToolbar {...slots} columns={props.columns} state={query.state} update={query.update} setFilter={query.setFilter} clear={query.clearFilters} disabled={Boolean(pending)} />}
    footer={<div className="flex flex-wrap items-center justify-between gap-2"><p>{props.onMove ? "Arrastra desde el asa o usa el selector de estado. Los cambios se guardan al confirmar el servidor." : "Vista de consulta. Cada columna carga sus tarjetas por páginas."}</p>{props.footer}<span role="status" className="sr-only">{announcement}</span></div>}>
    <DndContext id={id} sensors={sensors} collisionDetection={args => args.pointerCoordinates ? pointerWithin(args) : rectIntersection(args)}
      accessibility={{ screenReaderInstructions: { draggable: "Pulsa espacio o Enter para tomar la tarjeta, flechas izquierda y derecha para cambiar de columna, espacio o Enter para soltar, Escape para cancelar. También puedes usar el selector de estado." }, announcements: { onDragStart: () => "Tarjeta tomada.", onDragOver: ({ over }) => over ? `Columna ${props.groups.find(group => group.value === over.id)?.label ?? ""}.` : "Fuera de las columnas.", onDragEnd: () => "Tarjeta soltada. Espera la confirmación del servidor.", onDragCancel: () => "Movimiento cancelado." } }}
      onDragStart={event => setDragging(event.active.data.current?.record ?? null)} onDragCancel={() => setDragging(null)}
      onDragEnd={event => { setDragging(null); if (event.over) { const record = event.active.data.current?.record as ListRecord | undefined, from = event.active.data.current?.group as string | undefined; if (record && from) void move(record, from, String(event.over.id)); } }}>
      <div className="flex min-h-0 min-w-0 flex-1 gap-4 overflow-x-auto p-4 sm:p-6" aria-label={`Tablero de ${props.title}`}>{props.groups.map(group => <KanbanColumn key={`${group.value}:${version}`} {...props} group={group} state={query.state} currentUrl={query.currentUrl} pending={pending} move={(record, from, to) => { void move(record, from, to); }} registerHandle={registerHandle} onSettled={onSettled} />)}</div>
      <DragOverlay dropAnimation={null}>{dragging && <article style={{ width: "min(20rem, calc(100vw - 5rem))" }} className="pointer-events-none rotate-2 rounded-xl border border-primary/40 bg-base-100 shadow-2xl" aria-label={`Moviendo ${recordCardTitle(dragging, props.titleField, props.columns)}`}><RecordCard {...props} recordHref={undefined} record={dragging} currentUrl={query.currentUrl} /></article>}</DragOverlay>
    </DndContext>
  </CollectionShell>;
}
