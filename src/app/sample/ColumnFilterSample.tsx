"use client";

import { useState } from "react";
import ColumnFilter from "@/components/ui/list/ColumnFilter";
import type { ListFilter } from "@/lib/list/types";

const examples = [{ id: 1, quantity: 2, amount: 249.9, active: true }, { id: 2, quantity: 10, amount: 1200.5, active: false }, { id: 3, quantity: 25, amount: 2800, active: true }];

function matches(value: number | boolean, filter?: ListFilter) {
  if (!filter) return true;
  const target = typeof value === "boolean" ? filter.value === "true" : Number(filter.value);
  switch (filter.operator) {
    case "eq": return value === target;
    case "neq": return value !== target;
    case "gt": return value > target;
    case "gte": return value >= target;
    case "lt": return value < target;
    case "lte": return value <= target;
    case "between": return value >= target && Number(value) <= Number(filter.to);
    default: return true;
  }
}

export default function ColumnFilterSample() {
  const [filters, setFilters] = useState<ListFilter[]>([]);
  const rows = examples.filter(row => matches(row.quantity, filters.find(filter => filter.field === "quantity")) && matches(row.amount, filters.find(filter => filter.field === "amount")) && matches(row.active, filters.find(filter => filter.field === "active")));
  return <section aria-labelledby="column-filter-example-title" className="card min-w-0 rounded-2xl border border-base-300 bg-base-100 shadow-sm">
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-base-300 p-4 sm:px-6"><div><h3 id="column-filter-example-title" className="text-lg font-semibold">Controles numéricos y booleanos</h3><p className="mt-1 text-sm text-base-content/55">Datos de demostración para probar operadores. No se guardan en la base de datos.</p></div>{filters.length > 0 && <button type="button" className="btn btn-ghost btn-sm" onClick={() => setFilters([])}>Restablecer demo</button>}</header>
    <div className="min-w-0 overflow-x-auto p-4 sm:px-6"><table className="table table-sm min-w-96"><caption className="sr-only">Ejemplos numéricos y booleanos</caption><thead><tr>{([{ field: "quantity", label: "Cantidad", type: "integer" }, { field: "amount", label: "Importe", type: "number" }, { field: "active", label: "Activo", type: "boolean" }] as const).map(column => <th key={column.field}><div className="flex items-center gap-1">{column.label}<ColumnFilter {...column} filter={filters.find(filter => filter.field === column.field)} onApply={filter => setFilters(current => [...current.filter(item => item.field !== column.field), ...(filter ? [filter] : [])])} /></div></th>)}</tr></thead><tbody>{rows.length ? rows.map(row => <tr key={row.id}><td>{row.quantity}</td><td>{row.amount.toLocaleString("es-MX", { style: "currency", currency: "MXN" })}</td><td><span className={`badge badge-soft badge-sm ${row.active ? "badge-success" : "badge-ghost"}`}>{row.active ? "Sí" : "No"}</span></td></tr>) : <tr><td colSpan={3} className="p-6 text-center text-base-content/55">Sin coincidencias</td></tr>}</tbody></table></div>
    <footer className="rounded-b-2xl border-t border-base-300 bg-base-200/20 px-4 py-3 text-xs text-base-content/55 sm:px-6">{rows.length} ejemplos · Los modelos actuales de Prisma no tienen campos numéricos; sus controles quedan listos para registrarlos cuando existan.</footer>
  </section>;
}
