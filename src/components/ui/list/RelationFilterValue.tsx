"use client";

import { useState } from "react";
import type { Many2OneLoader } from "@/lib/many2one/model-lookup";
import { useMany2OneSearch } from "../form/useMany2OneSearch";

/** Uses the same authorized, paged lookup as Fields; only the selected ID enters the filter. */
export default function RelationFilterValue({ label, load, value, onChange }: { label: string; load: Many2OneLoader; value: string; onChange: (id: string) => void }) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const request = { model: "user" as const, searchFields: [], displayName: "{id}" };
  const search = useMany2OneSearch({ ...request, query, page, pageSize: 5 }, true, 250, load);
  const selected = useMany2OneSearch({ ...request, id: value, pageSize: 1 }, Boolean(value), 0, load);
  const data = search.data;
  return <div className="space-y-2">
    <label className="flex flex-col gap-1.5"><span className="text-xs text-base-content/60">Buscar y seleccionar</span><input type="search" autoComplete="off" aria-label={`Buscar ${label}`} maxLength={120} className="input input-sm w-full rounded-lg border-base-300" value={query} onChange={event => { setQuery(event.currentTarget.value); setPage(1); }} /></label>
    {value && <p className="text-xs">Seleccionado: {selected.data?.items.find(item => item.value === value)?.label ?? "Registro seleccionado"}<button type="button" className="btn btn-ghost btn-xs" aria-label={`Quitar selección de ${label}`} onClick={() => onChange("")}>Quitar</button></p>}
    {search.loading ? <p role="status" className="text-xs">Buscando…</p> : search.error ? <div role="alert" className="text-xs text-error">{search.error}<button type="button" className="btn btn-ghost btn-xs" onClick={search.retry}>Reintentar búsqueda</button></div> : <>
      <ul aria-label={`Resultados de ${label}`} className="space-y-1">{data?.items.map(item => <li key={item.value}><button type="button" aria-pressed={value === item.value} className={`btn btn-sm h-auto min-h-8 w-full justify-start whitespace-normal text-left wrap-anywhere ${value === item.value ? "btn-soft btn-primary" : "btn-ghost"}`} onClick={() => onChange(item.value)}>{item.label}</button></li>)}</ul>
      {!data?.items.length && <p role="status" className="text-xs">Sin coincidencias.</p>}
      <div className="flex items-center justify-between"><button type="button" className="btn btn-ghost btn-xs" disabled={!data || data.page <= 1} onClick={() => setPage((data?.page ?? 1) - 1)} aria-label={`Resultados anteriores de ${label}`}>Anterior</button><span className="text-xs">{data?.page ?? page}</span><button type="button" className="btn btn-ghost btn-xs" disabled={!data || data.page * data.pageSize >= data.total} onClick={() => setPage((data?.page ?? page) + 1)} aria-label={`Más resultados de ${label}`}>Siguiente</button></div>
    </>}
  </div>;
}
