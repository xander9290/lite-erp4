"use client";

import { useState } from "react";
import { X } from "lucide-react";
import type { Many2OneLoader } from "@/lib/many2one/model-lookup";
import { useMany2OneSearch } from "../form/useMany2OneSearch";

/** Several records for a Many2many filter (1–10), through the same authorized lookup; only IDs enter the filter. */
export default function RelationFilterValues({ label, load, value, onChange, maximum = 10 }: { label: string; load: Many2OneLoader; value: readonly string[]; onChange: (ids: string[]) => void; maximum?: number }) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const request = { model: "user" as const, searchFields: [], displayName: "{id}" };
  const search = useMany2OneSearch({ ...request, query, page, pageSize: 5 }, true, 250, load);
  const selected = useMany2OneSearch({ ...request, ids: [...value], pageSize: Math.max(1, Math.min(25, value.length)) }, value.length > 0, 0, load);
  const data = search.data;
  const nameOf = (id: string) => selected.data?.items.find(item => item.value === id)?.label ?? data?.items.find(item => item.value === id)?.label ?? "Registro";
  const toggle = (id: string) => onChange(value.includes(id) ? value.filter(current => current !== id) : value.length < maximum ? [...value, id] : [...value]);
  return <div className="space-y-2">
    {value.length > 0 && <ul aria-label={`${label}: seleccionados`} className="flex flex-wrap gap-1">{value.map(id => <li key={id} className="badge badge-soft badge-primary badge-sm h-auto gap-1 py-0.5">
      <span className="wrap-anywhere">{nameOf(id)}</span>
      <button type="button" className="cursor-pointer" aria-label={`Quitar ${nameOf(id)}`} onClick={() => toggle(id)}><X size={11} aria-hidden="true" /></button>
    </li>)}</ul>}
    <label className="flex flex-col gap-1.5"><span className="text-xs text-base-content/60">Buscar y seleccionar (hasta {maximum})</span><input type="search" autoComplete="off" aria-label={`Buscar ${label}`} maxLength={120} className="input input-sm w-full rounded-lg border-base-300" value={query} onChange={event => { setQuery(event.currentTarget.value); setPage(1); }} /></label>
    {search.loading ? <p role="status" className="text-xs">Buscando…</p> : search.error ? <div role="alert" className="text-xs text-error">{search.error}<button type="button" className="btn btn-ghost btn-xs" onClick={search.retry}>Reintentar búsqueda</button></div> : <>
      <ul aria-label={`Resultados de ${label}`} className="space-y-1">{data?.items.map(item => <li key={item.value}><button type="button" aria-pressed={value.includes(item.value)} disabled={!value.includes(item.value) && value.length >= maximum} className={`btn btn-sm h-auto min-h-8 w-full justify-start whitespace-normal text-left wrap-anywhere ${value.includes(item.value) ? "btn-soft btn-primary" : "btn-ghost"}`} onClick={() => toggle(item.value)}>{item.label}</button></li>)}</ul>
      {!data?.items.length && <p role="status" className="text-xs">Sin coincidencias.</p>}
      <div className="flex items-center justify-between"><button type="button" className="btn btn-ghost btn-xs" disabled={!data || data.page <= 1} onClick={() => setPage((data?.page ?? 1) - 1)} aria-label={`Resultados anteriores de ${label}`}>Anterior</button><span className="text-xs">{data?.page ?? page}</span><button type="button" className="btn btn-ghost btn-xs" disabled={!data || data.page * data.pageSize >= data.total} onClick={() => setPage((data?.page ?? page) + 1)} aria-label={`Más resultados de ${label}`}>Siguiente</button></div>
    </>}
  </div>;
}
