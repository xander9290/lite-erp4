"use client";
import type { ListColumn } from "@/lib/list/types";
import { scalarGroupingColumn } from "@/lib/list/grouping";

export default function ListGroupingControls({ columns, fields, onChange }: { columns: readonly ListColumn[]; fields: string[]; onChange: (fields: string[]) => void }) {
  const available = columns.filter(scalarGroupingColumn);
  if (!available.length && !fields.length) return null;
  return <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Agrupación de la lista">
    <label className="flex shrink-0 items-center gap-2 whitespace-nowrap text-sm">Agrupar por
      <select autoComplete="off" className="select select-sm max-w-44" aria-label="Añadir nivel de agrupación" value="" disabled={fields.length >= 3} onChange={event => { if (event.target.value) onChange([...fields, event.target.value]); }}>
        <option value="">{fields.length >= 3 ? "Máximo 3 niveles" : "Seleccionar campo"}</option>
        {available.filter(column => !fields.includes(column.field)).map(column => <option key={column.field} value={column.field}>{column.label}</option>)}
      </select>
    </label>
    {fields.map((field, index) => <span key={`${index}:${field}`} className="inline-flex items-center gap-1 rounded-lg border border-base-300 px-2 py-1 text-xs">
      {index + 1}. {columns.find(column => column.field === field)?.label ?? "Campo inválido"}
      <button type="button" className="btn btn-ghost btn-xs" disabled={index === 0} aria-label={`Subir nivel ${index + 1}`} onClick={() => { const next = [...fields]; [next[index - 1], next[index]] = [next[index], next[index - 1]]; onChange(next); }}>↑</button>
      <button type="button" className="btn btn-ghost btn-xs" aria-label={`Quitar nivel ${index + 1}`} onClick={() => onChange(fields.filter((_, position) => position !== index))}>×</button>
    </span>)}
    {!!fields.length && <button type="button" className="btn btn-ghost btn-sm" onClick={() => onChange([])}>Sin agrupar</button>}
  </div>;
}
