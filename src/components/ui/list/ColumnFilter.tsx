"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Many2OneLoader } from "@/lib/many2one/model-lookup";
import RelationFilterValue from "./RelationFilterValue";
import RelationFilterValues from "./RelationFilterValues";
import { Filter, X } from "lucide-react";
import { columnFilterOperators, columnOperatorLabel, filterValueError, many2manyFilterIds, many2manyFilterLabels, many2manyFilterOperators } from "@/lib/list/filters";
import type { ListDataType, ListFilter, ListFilterOperator } from "@/lib/list/types";
import { filterInputValue, temporalFilter } from "./filterInputs";

/** `multiple`: Many2many (tags) column — membership of several records or emptiness. */
type FilterProps = { multiple?: boolean; lookup?: Many2OneLoader; field: string; label: string; type: ListDataType; filter?: ListFilter; onApply: (filter: ListFilter | null) => void; options?: readonly { value: string; label: string }[]; triggerLabel?: string };

function FilterPanel({ field, label, type, filter, onApply, options, lookup, multiple = false, onClose }: FilterProps & { onClose: (restore?: boolean) => void }) {
  const titleId = useId();
  const errorId = useId();
  const root = useRef<HTMLDivElement>(null);
  const temporal = type === "date" || type === "datetime";
  const operators = multiple ? many2manyFilterOperators : columnFilterOperators(type, Boolean(options || lookup));
  const [ids, setIds] = useState<string[]>(multiple ? many2manyFilterIds(filter?.value) : []);
  const [operator, setOperator] = useState<ListFilterOperator>(filter && (operators as readonly string[]).includes(filter.operator) ? filter.operator : operators[0]);
  const [precision, setPrecision] = useState<"day" | "instant">(filter?.precision ?? "day");
  const [value, setValue] = useState(temporal ? filterInputValue(filter?.value, filter?.precision ?? "day") : lookup && filter && !(operators as readonly string[]).includes(filter.operator) ? "" : filter?.value ?? "");
  const [to, setTo] = useState(temporal ? filterInputValue(filter?.to, filter?.precision ?? "day", filter?.precision === "day") : filter?.to ?? "");
  const [error, setError] = useState<string | null>(null);
  const needsValue = operator !== "empty" && operator !== "notEmpty";
  const inputType = temporal ? precision === "day" ? "date" : "datetime-local" : type === "number" || type === "integer" ? "number" : "text";
  const controlClass = "input input-sm w-full min-w-0 rounded-lg border-base-300 bg-base-100 focus:border-base-content/60 focus:outline-none";

  useEffect(() => { root.current?.querySelector<HTMLSelectElement>("select")?.focus(); }, []);

  function apply() {
    try {
      if (multiple) {
        if (needsValue && !ids.length) { setError("Selecciona al menos un registro."); return; }
        onApply({ field, operator, ...(needsValue ? { value: ids.join(",") } : {}) }); onClose(); return;
      }
      const next = temporal && needsValue ? temporalFilter(field, operator, value, to, precision) : { field, operator, ...(needsValue ? { value, ...(operator === "between" ? { to } : {}) } : {}) };
      const message = filterValueError(type, next);
      if (message) { setError(message); return; }
      onApply(next); onClose();
    } catch (error) { setError(error instanceof Error ? error.message : "Revisa el filtro."); }
  }

  // A div, not a <form> (may live inside a record form): Enter applies the filter, never submits the record.
  return <div ref={root} role="dialog" aria-modal="false" aria-labelledby={titleId} className="space-y-3 p-4 text-left text-sm font-normal text-base-content" onKeyDown={event => { if (event.key === "Enter" && event.target instanceof HTMLInputElement) { event.preventDefault(); event.stopPropagation(); apply(); } }}>
    <header className="flex items-center justify-between gap-2"><h3 id={titleId} className="min-w-0 font-semibold wrap-anywhere">Filtrar {label}</h3><button type="button" className="btn btn-circle btn-ghost btn-xs shrink-0" aria-label="Cerrar filtro" onClick={() => onClose()}><X size={15} aria-hidden="true" /></button></header>
    <label className="flex flex-col gap-1.5"><span className="text-xs text-base-content/60">Condición</span><select className="select select-sm w-full rounded-lg border-base-300" autoComplete="off" aria-label={`Condición de ${label}`} value={operator} onChange={event => { setOperator(event.currentTarget.value as ListFilterOperator); setError(null); }}>
      {operators.map(op => <option key={op} value={op}>{(multiple ? many2manyFilterLabels[op] : undefined) ?? columnOperatorLabel(type, op)}</option>)}
    </select></label>
    {type === "datetime" && needsValue && <label className="flex flex-col gap-1.5"><span className="text-xs text-base-content/60">Precisión</span><select className="select select-sm w-full rounded-lg border-base-300" aria-label={`Precisión de ${label}`} autoComplete="off" value={precision} onChange={event => { setPrecision(event.currentTarget.value as "day" | "instant"); setValue(""); setTo(""); setError(null); }}><option value="day">Día completo</option><option value="instant">Fecha y hora exactas</option></select></label>}
    {needsValue && multiple && lookup ? <RelationFilterValues label={label} load={lookup} value={ids} onChange={next => { setIds(next); setError(null); }} /> : needsValue && (lookup ? <RelationFilterValue label={label} load={lookup} value={value} onChange={id => { setValue(id); setError(null); }} /> : options || type === "boolean" ? <label className="flex flex-col gap-1.5"><span className="text-xs text-base-content/60">Valor</span><select className="select select-sm w-full rounded-lg border-base-300" aria-label={`Valor de ${label}`} autoComplete="off" value={value} onChange={event => { setValue(event.currentTarget.value); setError(null); }}><option value="">Selecciona…</option>{(options ?? [{ value: "true", label: "Sí" }, { value: "false", label: "No" }]).map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label> : <>
      <label className="flex flex-col gap-1.5"><span className="text-xs text-base-content/60">{operator === "between" ? temporal ? "Desde" : "Mínimo" : "Valor"}</span><input className={controlClass} type={inputType} step={inputType === "datetime-local" ? "0.001" : type === "integer" ? "1" : "any"} autoComplete="off" maxLength={120} aria-label={`Valor de ${label}`} aria-describedby={error ? errorId : undefined} value={value} onInput={event => { setValue(event.currentTarget.value); setError(null); }} onChange={event => { setValue(event.currentTarget.value); setError(null); }} /></label>
      {operator === "between" && <label className="flex flex-col gap-1.5"><span className="text-xs text-base-content/60">{temporal ? "Hasta" : "Máximo"}</span><input className={controlClass} type={inputType} step={inputType === "datetime-local" ? "0.001" : type === "integer" ? "1" : "any"} autoComplete="off" maxLength={120} aria-label={`Hasta de ${label}`} value={to} onInput={event => { setTo(event.currentTarget.value); setError(null); }} onChange={event => { setTo(event.currentTarget.value); setError(null); }} /></label>}
    </>)}
    {temporal && needsValue && <p className="text-xs leading-relaxed text-base-content/50">{precision === "day" ? "Incluye el día completo en la zona horaria de tu navegador." : "La hora del navegador se convierte a UTC al consultar."}</p>}
    {error && <p id={errorId} role="alert" className="text-xs text-error">{error}</p>}
    <footer className="flex items-center justify-between gap-2 border-t border-base-300 pt-3"><button type="button" className="btn btn-ghost btn-sm" onClick={() => { onApply(null); onClose(); }}>Limpiar</button><button type="button" className="btn btn-primary btn-sm" onClick={apply}>Aplicar filtro</button></footer>
  </div>;
}

export default function ColumnFilter(props: FilterProps) {
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ left: number; top: number; width: number; maxHeight: number } | null>(null);
  const close = useCallback((restore = true) => { setPosition(null); if (restore) button.current?.focus({ preventScroll: true }); }, [setPosition]);

  useEffect(() => {
    if (!position) return;
    const outside = (event: Event) => { if (!panel.current?.contains(event.target as Node) && !button.current?.contains(event.target as Node)) close(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); close(); } };
    document.addEventListener("pointerdown", outside); document.addEventListener("focusin", outside); document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("focusin", outside); document.removeEventListener("keydown", escape); };
  }, [position, close]);

  function toggle() {
    if (position) { close(); return; }
    const rect = button.current?.getBoundingClientRect();
    if (!rect) return;
    const width = Math.min(320, window.innerWidth - 16);
    const preferredHeight = props.type === "datetime" ? 520 : props.type === "date" ? 470 : 350;
    const top = Math.max(8, Math.min(rect.bottom + 8, window.innerHeight - preferredHeight));
    setPosition({ left: Math.max(8, Math.min(rect.right - width, window.innerWidth - width - 8)), top, width, maxHeight: Math.max(120, window.innerHeight - top - 8) });
  }

  return <>
    <button ref={button} type="button" className={`btn btn-ghost shrink-0 ${props.triggerLabel ? "btn-sm border border-base-300" : "btn-circle btn-xs"} ${props.filter ? "bg-primary/10 text-primary" : "text-base-content/65"}`} aria-label={`Filtrar ${props.label}`} aria-haspopup="dialog" aria-expanded={Boolean(position)} title={`Filtrar ${props.label}`} onClick={toggle}><Filter size={13} aria-hidden="true" />{props.triggerLabel}{props.filter && <span className="sr-only">Filtro activo</span>}</button>
    {position && createPortal(<div ref={panel} style={position} className="fixed z-[100] m-0 overflow-y-auto rounded-xl border border-base-300 bg-base-100 shadow-2xl"><FilterPanel key={JSON.stringify(props.filter ?? null)} {...props} onClose={close} /></div>, document.body)}
  </>;
}
