"use client";
import { useId, useState } from "react";
import { ArrowDownWideNarrow, Filter, Search, X } from "lucide-react";
import type { ListFilter, ListState } from "@/lib/list/types";
import ColumnFilter from "../list/ColumnFilter";
import { filterDescription } from "../list/filterInputs";
import type { CollectionField } from "./types";

function SearchBox({ query, search, disabled }: { query: string; search: (query: string) => void; disabled: boolean }) {
  const [draft, setDraft] = useState(query);
  return <form role="search" aria-label="Buscar registros" autoComplete="off" className="flex min-w-0 flex-1 basis-full items-center gap-2 sm:max-w-md sm:basis-0" onSubmit={event => { event.preventDefault(); search(draft.trim()); }}>
    <label className="input input-sm flex min-w-0 flex-1 items-center gap-2 rounded-xl border-base-300 bg-base-100"><Search size={16} className="shrink-0 text-base-content/45" aria-hidden="true" /><input type="search" className="min-w-0 grow" autoComplete="off" aria-label="Buscar registros" placeholder="Buscar registros…" maxLength={120} value={draft} disabled={disabled} onChange={event => setDraft(event.currentTarget.value)} /></label>
    <button type="submit" className="btn btn-sm btn-primary" disabled={disabled}>Buscar</button>
  </form>;
}

export default function CollectionToolbar({ columns, state, update, setFilter, clear, disabled = false }: { columns: readonly CollectionField[]; state: ListState; update: (patch: Partial<ListState>) => void; setFilter: (field: string, filter: ListFilter | null) => void; clear: () => void; disabled?: boolean }) {
  const [open, setOpen] = useState(false), panelId = useId();
  const sortable = columns.filter(column => column.sortable);
  const count = state.filters.length + (state.query ? 1 : 0) + (state.invalidFilters ? 1 : 0);
  return <div className="shrink-0 space-y-3 border-b border-base-300 bg-base-100 p-4 sm:px-6">
    <div className="flex min-w-0 flex-wrap items-center gap-2">
      <SearchBox key={state.query} query={state.query} search={query => update({ query })} disabled={disabled} />
      <button type="button" className={`btn btn-sm ${open || state.filters.length ? "btn-soft btn-primary" : "btn-ghost"}`} disabled={disabled} aria-expanded={open} aria-controls={panelId} onClick={() => setOpen(value => !value)}><Filter size={15} aria-hidden="true" />Filtros{state.filters.length > 0 && <span className="badge badge-xs">{state.filters.length}</span>}</button>
      {sortable.length > 0 && <div className="ml-auto flex w-full min-w-0 items-center gap-1 sm:w-auto"><ArrowDownWideNarrow size={15} className="shrink-0 text-base-content/50" aria-hidden="true" /><select aria-label="Ordenar por" autoComplete="off" className="select select-sm min-w-0 flex-1 rounded-lg border-base-300 sm:w-40 sm:flex-none" value={state.sort} disabled={disabled} onChange={event => update({ sort: event.currentTarget.value })}>{sortable.map(column => <option key={column.field} value={column.field}>{column.label}</option>)}</select><select aria-label="Dirección del orden" autoComplete="off" className="select select-sm w-24 shrink-0 rounded-lg border-base-300" value={state.direction} disabled={disabled} onChange={event => update({ direction: event.currentTarget.value as "asc" | "desc" })}><option value="asc" aria-label="Ascendente">↑ Asc.</option><option value="desc" aria-label="Descendente">↓ Desc.</option></select></div>}
    </div>
    {open && <fieldset id={panelId} disabled={disabled} className="rounded-xl bg-base-200/65 p-3"><legend className="sr-only">Filtros disponibles</legend><p className="mb-2 text-xs text-base-content/60">Elige el campo que quieres filtrar.</p><div className="flex flex-wrap gap-2">{columns.filter(column => column.filterable !== false).map(column => <ColumnFilter key={column.field} field={column.field} label={column.label} triggerLabel={column.label} type={column.type ?? "text"} options={column.options} filter={state.filters.find(filter => filter.field === column.field)} onApply={filter => setFilter(column.field, filter)} />)}</div></fieldset>}
    {count > 0 && <div aria-label="Filtros activos" className="flex flex-wrap items-center gap-2">
      {state.query && <button type="button" disabled={disabled} className="badge badge-soft badge-primary h-auto max-w-full cursor-pointer gap-1 py-1.5 text-left wrap-anywhere" onClick={() => update({ query: "" })} aria-label="Quitar búsqueda">Búsqueda: {state.query}<X size={12} className="shrink-0" aria-hidden="true" /></button>}
      {state.filters.map(filter => { const column = columns.find(column => column.field === filter.field); return <button key={filter.field} type="button" disabled={disabled} className="badge badge-soft h-auto max-w-full cursor-pointer gap-1 py-1.5 text-left wrap-anywhere" onClick={() => setFilter(filter.field, null)} aria-label={`Quitar filtro ${column?.label ?? filter.field}`}>{column?.label ?? filter.field}: {column?.options && filter.value ? `${filter.operator === "neq" ? "Distinto de " : ""}${column.options.find(option => option.value === filter.value)?.label ?? filter.value}` : filterDescription(column?.type ?? "text", filter)}<X size={12} className="shrink-0" aria-hidden="true" /></button>; })}
      {state.invalidFilters && <span role="alert" className="text-xs text-error">El enlace contiene filtros inválidos.</span>}
      <button type="button" disabled={disabled} className="btn btn-ghost btn-xs" onClick={clear}>Limpiar todo</button>
    </div>}
  </div>;
}
