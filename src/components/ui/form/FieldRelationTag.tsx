"use client";

import { useCallback, useEffect, useId, useRef, useState, type ComponentPropsWithoutRef } from "react";
import { useController, useFormContext, type FieldValues } from "react-hook-form";
import { Check, ChevronDown, Search, X } from "lucide-react";
import { lookupModels, type Many2OneModel, type Many2OneOption, type Many2OneRecord } from "@/lib/many2one/types";
import type { BaseFieldProps } from "./field.types";
import { fieldDirectionClassName, fieldInputClassName, fieldLabelClassName } from "./field.styles";
import { useFormFieldValidation } from "./formValidation";
import { useMany2OneSearch } from "./useMany2OneSearch";
import Many2OneSearchModal, { type Many2OneColumn } from "./Many2OneSearchModal";
import { relationTagIds, resolveRelationTags } from "./relationTagValues";

export type FieldRelationTagProps<TFieldValues extends FieldValues = FieldValues> =
  Omit<BaseFieldProps<TFieldValues>, "onChange"> &
  Omit<ComponentPropsWithoutRef<"input">, keyof BaseFieldProps<TFieldValues> | "type" | "value" | "defaultValue" | "children" | "onChange" | "onKeyDown" | "size" | "role"> & {
    model: Many2OneModel;
    searchFields?: readonly string[];
    displayName?: string;
    columns?: readonly Many2OneColumn[];
    pageSize?: 5 | 10 | 20 | 25;
    maxSelected?: number;
    clearable?: boolean;
    onChange?: (ids: string[], records: Many2OneRecord[]) => void;
  };

export default function FieldRelationTag<TFieldValues extends FieldValues = FieldValues>({
  name, label, direction = "block", model, searchFields = lookupModels[model].searchFields,
  displayName = lookupModels[model].displayName, columns, pageSize = 10, maxSelected = 100, clearable = true,
  onChange, onBlur, onFocus, disabled, readOnly, required, id, className = "", placeholder = "Buscar y agregar…",
  "aria-label": ariaLabel, "aria-describedby": describedBy, ...inputProps
}: FieldRelationTagProps<TFieldValues>) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const listId = `${inputId}-list`, errorId = `${inputId}-error`, statusId = `${inputId}-status`;
  const root = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const skipFocus = useRef(false);
  const { control, watch } = useFormContext<TFieldValues>();
  const { field, fieldState } = useController({ name, control, disabled });
  const ids = relationTagIds(field.value);
  const maximum = Number.isFinite(maxSelected) ? Math.min(100, Math.max(1, Math.trunc(maxSelected))) : 100;
  const [open, setOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [cached, setCached] = useState<{ context: string; options: Many2OneOption[] } | null>(null);
  const request = { model, searchFields, displayName };
  const context = JSON.stringify(request);
  const cachedOptions = cached?.context === context ? cached.options : [];
  const pendingIds = ids.filter(value => !cachedOptions.some(option => option.value === value));
  const resolution = useMany2OneSearch({ ...request, ids: pendingIds }, pendingIds.length > 0 && pendingIds.length <= 100, 0);
  const available = [...cachedOptions, ...(resolution.data?.items ?? [])];
  const byId = new Map(available.map(option => [option.value, option]));
  const selected = resolveRelationTags(ids, available);
  const selectionValid = selected !== null;
  const missing = ids.filter(value => !byId.has(value));
  const locked = Boolean(field.disabled || readOnly);
  const editingBlocked = locked || resolution.loading || missing.length > 0;
  const expanded = open && !editingBlocked && !modalOpen;
  const suggestions = useMany2OneSearch({ ...request, query, pageSize: 5 }, expanded);
  const options = suggestions.data?.items ?? [];
  const activeIndex = Math.min(active, options.length);
  const fieldLabel = label?.trim();
  const accessibleLabel = ariaLabel || fieldLabel || name;
  const atLimit = ids.length >= maximum;

  const restoreFocus = useCallback(() => {
    setOpen(false);
    skipFocus.current = document.activeElement !== input.current;
    input.current?.focus({ preventScroll: true });
  }, [setOpen]);

  useEffect(() => {
    const outside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, []);

  useEffect(() => {
    const subscription = watch((_values, metadata) => {
      if (!metadata.name) { setOpen(false); setModalOpen(false); setQuery(""); setCached(null); }
    });
    return () => subscription.unsubscribe();
  }, [watch]);

  const validate = useCallback((current: unknown) => {
    if (locked) return null;
    if (!Array.isArray(current) || current.some(value => typeof value !== "string" || !value)) return "El valor debe ser un arreglo de IDs.";
    if (new Set(current).size !== current.length) return "La selección contiene registros duplicados.";
    if (current.length > maximum) return `Selecciona como máximo ${maximum} registros.`;
    if (!current.length) return required ? "Selecciona al menos un registro." : null;
    if (resolution.loading) return "Espera a que terminen de cargar los registros.";
    if (resolution.error) return "No se pudo verificar la selección. Reintenta la búsqueda.";
    return selectionValid ? null : "Hay registros que ya no están disponibles. Revisa la selección.";
  }, [locked, maximum, required, resolution.loading, resolution.error, selectionValid]);
  useFormFieldValidation(name, validate, "fieldRelationTag");

  function commit(next: readonly Many2OneOption[]) {
    if (locked || next.length > maximum) return;
    const unique = [...new Map(next.map(option => [option.value, option])).values()];
    setCached({ context, options: unique });
    field.onChange(unique.map(option => option.value));
    field.onBlur();
    setQuery(""); setOpen(false); setModalOpen(false); setActive(0);
    onChange?.(unique.map(option => option.value), unique.map(option => option.record));
  }

  function toggle(option: Many2OneOption) {
    if (editingBlocked || !selected) return;
    if (ids.includes(option.value)) commit(selected.filter(current => current.value !== option.value));
    else if (!atLimit) commit([...selected, option]);
  }

  function remove(value: string) {
    const remaining = resolveRelationTags(ids.filter(id => id !== value), available);
    if (remaining) { commit(remaining); restoreFocus(); }
  }

  function openModal() {
    if (!editingBlocked) { setOpen(false); setModalOpen(true); }
  }

  return (
    <div data-form-field={name} className={fieldDirectionClassName(direction, fieldLabel)}>
      {fieldLabel && <label htmlFor={inputId} className={fieldLabelClassName(direction)}>{fieldLabel}</label>}
      <div ref={root} className="relative min-w-0" onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}>
        <div className={`${fieldInputClassName} h-auto! min-h-11 flex-col items-stretch gap-0 px-1 py-1 ${locked ? "opacity-55" : ""} ${className}`}>
          {ids.length > 0 && <ul aria-label={`${accessibleLabel}: seleccionados`} className="m-0 flex min-w-0 list-none flex-wrap gap-1.5 p-0 pb-1.5">
            {ids.map(value => {
              const option = byId.get(value);
              const canRemove = !locked && !resolution.loading && Boolean(resolveRelationTags(ids.filter(id => id !== value), available));
              return <li key={value} className={`badge badge-soft h-auto min-h-7 max-w-full gap-1 rounded-lg px-2 py-1 ${option ? "badge-primary" : "badge-ghost"}`}>
                <span className="min-w-0 text-xs leading-relaxed whitespace-normal wrap-anywhere">{option?.label ?? (resolution.loading ? "Cargando…" : "Registro no disponible")}</span>
                {!locked && <button type="button" disabled={!canRemove} className="flex size-5 shrink-0 cursor-pointer items-center justify-center rounded-md transition-colors hover:bg-primary/15 focus-visible:outline-2 focus-visible:outline-primary disabled:cursor-default disabled:opacity-40" aria-label={`Quitar ${option?.label ?? value}`} onClick={() => remove(value)}><X size={12} aria-hidden="true" /></button>}
              </li>;
            })}
          </ul>}
          <div className="flex min-w-0 items-center gap-1">
            <Search size={15} className="shrink-0 text-base-content/40" aria-hidden="true" />
            <input {...inputProps} id={inputId} name={field.name} ref={element => { input.current = element; field.ref(element); }} type="text" role="combobox" autoComplete="off"
              disabled={field.disabled} readOnly={editingBlocked} value={query} maxLength={120} placeholder={locked ? ids.length ? "" : "Sin selección" : placeholder}
              className="h-8 w-full min-w-0 flex-1 border-0 bg-transparent text-sm shadow-none outline-none placeholder:text-base-content/40 focus:outline-none"
              aria-label={inputProps["aria-labelledby"] ? ariaLabel : accessibleLabel} aria-expanded={expanded} aria-controls={expanded ? listId : undefined} aria-autocomplete="list" aria-haspopup="listbox"
              aria-activedescendant={expanded ? `${listId}-${activeIndex}` : undefined} aria-required={required} aria-invalid={fieldState.invalid || inputProps["aria-invalid"]}
              aria-describedby={[describedBy, statusId, fieldState.invalid ? errorId : undefined].filter(Boolean).join(" ")}
              onFocus={event => { if (skipFocus.current) skipFocus.current = false; else if (!editingBlocked) { setQuery(""); setActive(0); setOpen(true); } onFocus?.(event); }}
              onClick={() => { if (!editingBlocked) setOpen(true); }}
              onBlur={event => { field.onBlur(); onBlur?.(event); }}
              onChange={event => { if (!editingBlocked) { setQuery(event.currentTarget.value); setActive(0); setOpen(true); } }}
              onKeyDown={event => {
                if (event.key === "Tab") { setOpen(false); return; }
                if (event.key === "Escape" && expanded) { event.preventDefault(); event.stopPropagation(); setOpen(false); return; }
                if (editingBlocked) return;
                if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                  event.preventDefault();
                  if (!expanded) { setOpen(true); setActive(0); }
                  else setActive(index => (Math.min(index, options.length) + (event.key === "ArrowDown" ? 1 : options.length)) % (options.length + 1));
                } else if (event.key === "Enter" && expanded) {
                  event.preventDefault();
                  if (activeIndex === options.length) openModal(); else toggle(options[activeIndex]);
                } else if (event.key === "Backspace" && !query && ids.length) { event.preventDefault(); remove(ids[ids.length - 1]); }
              }} />
            {ids.length > 0 && clearable && !locked && <button type="button" className="btn btn-circle btn-ghost btn-xs shrink-0" aria-label={`Limpiar ${accessibleLabel}`} onClick={() => { commit([]); restoreFocus(); }}><X size={14} aria-hidden="true" /></button>}
            <button type="button" className="btn btn-circle btn-ghost btn-xs shrink-0" disabled={editingBlocked} aria-label={`Buscar más: ${accessibleLabel}`} aria-haspopup="dialog" onClick={openModal}><ChevronDown size={16} aria-hidden="true" /></button>
          </div>
        </div>

        <div id={statusId} role="status" className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-base-content/50">
          {resolution.loading ? "Cargando selección…" : resolution.error ? <>{resolution.error}<button type="button" className="cursor-pointer underline" onClick={resolution.retry}>Reintentar</button></> : missing.length ? <>
            {missing.length} registro{missing.length === 1 ? " no disponible" : "s no disponibles"}.
            {!locked && <button type="button" className="cursor-pointer underline" onClick={() => commit(ids.flatMap(value => byId.get(value) ? [byId.get(value)!] : []))}>Quitar no disponibles</button>}
          </> : ids.length > 0 ? `${ids.length} seleccionado${ids.length === 1 ? "" : "s"}${atLimit ? ` · Máximo ${maximum}` : ""}` : "Puedes seleccionar varios registros"}
        </div>

        {expanded && <div className="absolute inset-x-0 top-full z-40 mt-2 overflow-hidden rounded-xl border border-base-300 bg-base-100 shadow-lg">
          <div id={listId} role="listbox" aria-multiselectable="true" aria-label={`Resultados: ${accessibleLabel}`} aria-busy={suggestions.loading}>
            {suggestions.loading && <p role="status" className="flex items-center gap-2 px-4 py-3 text-sm text-base-content/55"><span className="loading loading-spinner loading-xs" aria-hidden="true" />Buscando…</p>}
            {suggestions.error && <div role="alert" className="space-y-2 p-3 text-sm"><p>{suggestions.error}</p><button type="button" className="btn btn-soft btn-xs" onClick={suggestions.retry}>Reintentar</button></div>}
            {!suggestions.loading && !suggestions.error && !options.length && <p role="status" className="px-4 py-4 text-sm text-base-content/55">Sin coincidencias</p>}
            {options.map((option, index) => <div key={option.value} id={`${listId}-${index}`} role="option" aria-selected={ids.includes(option.value)} aria-disabled={atLimit && !ids.includes(option.value)}
              className={`flex cursor-pointer items-center justify-between gap-2 px-4 py-3 text-sm transition-colors ${atLimit && !ids.includes(option.value) ? "opacity-40" : ""} ${activeIndex === index ? "bg-primary/10 text-primary" : "hover:bg-base-200"}`}
              onMouseDown={event => event.preventDefault()} onMouseEnter={() => setActive(index)} onClick={() => toggle(option)}>
              <span className="min-w-0 wrap-anywhere">{option.label}</span>{ids.includes(option.value) && <Check size={15} className="shrink-0 text-primary" aria-hidden="true" />}
            </div>)}
            <div id={`${listId}-${options.length}`} role="option" aria-selected="false" className={`border-t border-base-300 ${activeIndex === options.length ? "bg-primary/5" : ""}`}>
              <button type="button" tabIndex={-1} className="flex w-full cursor-pointer items-center gap-2 px-4 py-3 text-left text-sm font-medium text-primary hover:bg-primary/5" onMouseDown={event => event.preventDefault()} onMouseEnter={() => setActive(options.length)} onClick={openModal}><Search size={15} aria-hidden="true" />Buscar más…</button>
            </div>
          </div>
        </div>}
        {fieldState.invalid && <span id={errorId} className="sr-only">{fieldState.error?.message || `${accessibleLabel}: selección inválida.`}</span>}
        {modalOpen && !editingBlocked && selected && <Many2OneSearchModal key={`${context}:${JSON.stringify(ids)}`} title={fieldLabel || "Registros"} request={{ ...request, pageSize }} initialQuery={query}
          multiple selectedOptions={selected} maxSelected={maximum} columns={columns} onConfirm={commit} onClose={() => setModalOpen(false)} onAfterClose={restoreFocus} />}
      </div>
    </div>
  );
}
