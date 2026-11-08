"use client";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useListView } from "../list/useListView";
import { CollectionMessage, CollectionShell } from "../collection/CollectionShell";
import CollectionToolbar from "../collection/CollectionToolbar";
import RecordCard from "../collection/RecordCard";
import type { CardViewProps } from "../collection/types";

export default function CardViewClient({ pageSize = 12, paramPrefix = "", ...props }: CardViewProps) {
  const config = { model: props.model, columns: props.columns, searchFields: props.searchFields ?? [], defaultSort: props.defaultSort };
  const list = useListView(config, pageSize, paramPrefix, props.load);
  const { data, state, loading, error } = list;
  const page = data?.page ?? state.page, pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  return <CollectionShell {...props} busy={loading} count={data?.total} refresh={list.refresh}
    toolbar={<CollectionToolbar columns={props.columns} state={state} update={list.update} setFilter={list.setFilter} clear={list.clearFilters} />}
    footer={<div className="space-y-3"><div className="flex flex-wrap items-center justify-between gap-3"><p role="status" className="tabular-nums">{loading ? "Cargando tarjetas…" : error ? "Consulta no disponible" : `${data?.total ? (page - 1) * data.pageSize + 1 : 0}–${data ? Math.min(page * data.pageSize, data.total) : 0} de ${data?.total ?? 0} registros`}</p><div className="flex flex-wrap items-center gap-3"><label className="flex items-center gap-2">Tarjetas<select aria-label="Tarjetas por página" autoComplete="off" className="select select-sm w-20 rounded-lg border-base-300" value={state.pageSize} onChange={event => list.update({ pageSize: Number(event.currentTarget.value) })}>{[...new Set([12, 24, 48, state.pageSize])].sort((a, b) => a - b).map(size => <option key={size} value={size}>{size}</option>)}</select></label><nav className="flex items-center gap-1" aria-label={`Paginación de ${props.title}`}><button type="button" className="btn btn-square btn-ghost btn-sm" aria-label="Página anterior de tarjetas" disabled={loading || !data || page <= 1} onClick={() => list.update({ page: page - 1 })}><ChevronLeft size={16} aria-hidden="true" /></button><span className="tabular-nums">{page} / {pages}</span><button type="button" className="btn btn-square btn-ghost btn-sm" aria-label="Página siguiente de tarjetas" disabled={loading || !data || page >= pages} onClick={() => list.update({ page: page + 1 })}><ChevronRight size={16} aria-hidden="true" /></button></nav></div></div>{props.footer && <div className="border-t border-base-300 pt-3">{props.footer}</div>}</div>}>
    <div aria-label={`Tarjetas de ${props.title}`} aria-busy={loading} className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
      {error ? <CollectionMessage error={error} retry={list.refresh} /> : loading ? <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,18rem),1fr))] gap-4">{[1, 2, 3].map(id => <div key={id} aria-hidden="true" className="skeleton h-48 rounded-2xl motion-reduce:animate-none" />)}</div> : !data?.rows.length ? <CollectionMessage empty="Sin tarjetas para mostrar" /> : <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,18rem),1fr))] items-stretch gap-4">{data.rows.map(record => <article key={record.id} className="card flex min-w-0 flex-col overflow-hidden rounded-2xl border border-base-300 bg-base-100 shadow-xs transition hover:border-primary/30 hover:shadow-md motion-reduce:transition-none"><RecordCard {...props} record={record} currentUrl={list.currentUrl} /></article>)}</div>}
    </div>
  </CollectionShell>;
}
