"use client";

import { useCallback, useEffect, useId, useRef, useState, type ComponentPropsWithoutRef } from "react";
import { useController, useFormContext, type FieldValues } from "react-hook-form";
import { Check, ChevronDown, Plus, Search, X } from "lucide-react";
import { lookupModels, type Many2OneCreator, type Many2OneModel, type Many2OneOption, type Many2OneRecord } from "@/lib/many2one/types";
import type { BaseFieldProps } from "./field.types";
import { fieldDirectionClassName, fieldInputClassName, fieldLabelClassName } from "./field.styles";
import { useFormFieldValidation } from "./formValidation";
import { useMany2OneSearch } from "./useMany2OneSearch";
import Many2OneSearchModal, { type Many2OneColumn } from "./Many2OneSearchModal";
import { relationTagIds, resolveRelationTags } from "./relationTagValues";
import { useModelField } from "./modelFields";
import type { Many2OneLoader } from "@/lib/many2one/model-lookup";
import { useFieldDirection } from "./fieldDirection";
import FieldVisibility from "./FieldVisibility";
import { useRelationDomainLoad } from "./useRelationDomainLoad";
import RelationDropdown from "./RelationDropdown";

export type FieldRelationTagProps<TFieldValues extends FieldValues = FieldValues> =
  Omit<BaseFieldProps<TFieldValues>, "onChange"> &
  Omit<ComponentPropsWithoutRef<"input">, keyof BaseFieldProps<TFieldValues> | "type" | "value" | "defaultValue" | "children" | "onChange" | "onKeyDown" | "size" | "role"> & {
    model?: Many2OneModel;
    load?: Many2OneLoader;
    searchFields?: readonly string[];
    displayName?: string;
    columns?: readonly Many2OneColumn[];
    pageSize?: 5 | 10 | 20 | 25;
    maxSelected?: number;
    clearable?: boolean;
    onChange?: (ids: string[], records: Many2OneRecord[]) => void;
    /** Offer «Crear "texto"» when nothing matches (Many2many `create: true`; the server fixes the target). */
    onCreate?: Many2OneCreator;
  };

/** Same comparison as the server: trimmed, single spaces, case-insensitive. */
const sameName = (a: string, b: string) => a.trim().replace(/\s+/g, " ").toLocaleLowerCase("es-MX") === b.trim().replace(/\s+/g, " ").toLocaleLowerCase("es-MX");

export default function FieldRelationTag<TFieldValues extends FieldValues = FieldValues>(props: FieldRelationTagProps<TFieldValues>) {
  const { invisible, ...controlProps } = useModelField(props, "many2many");
  if (!controlProps.model && !controlProps.load) throw new Error(`Configura un lookup autorizado para ${props.name}.`);
  return <FieldVisibility name={props.name} invisible={invisible}><RelationTagControl {...controlProps} /></FieldVisibility>;
}

function RelationTagControl<TFieldValues extends FieldValues = FieldValues>({
  name, label, direction: requestedDirection = "block", model = "user", load: baseLoad, searchFields = lookupModels[model].searchFields,
  displayName = lookupModels[model].displayName, columns, pageSize = 10, maxSelected = 100, clearable = true,
  onChange, onCreate, onBlur, onFocus, disabled, readOnly, required, id, className = "", placeholder = "Buscar y agregar…",
  "aria-label": ariaLabel, "aria-describedby": describedBy, ...inputProps
}: FieldRelationTagProps<TFieldValues>) {
  const load = useRelationDomainLoad(name, baseLoad);
  const direction = useFieldDirection(requestedDirection) ?? "block";
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const listId = `${inputId}-list`, errorId = `${inputId}-error`, statusId = `${inputId}-status`;
  const root = useRef<HTMLDivElement>(null);
  const anchor = useRef<HTMLDivElement>(null);
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
  const [cached, setCached] = useState<{ context: string; load?: Many2OneLoader; options: Many2OneOption[] } | null>(null);
  const request = { model, searchFields, displayName };
  const context = JSON.stringify(request);
  const cachedOptions = cached?.load === load && cached?.context === context ? cached.options : [];
  const pendingIds = ids.filter(value => !cachedOptions.some(option => option.value === value));
  const resolution = useMany2OneSearch({ ...request, ids: pendingIds }, pendingIds.length > 0 && pendingIds.length <= 100, 0, load);
  const available = [...cachedOptions, ...(resolution.data?.items ?? [])];
  const byId = new Map(available.map(option => [option.value, option]));
  const selected = resolveRelationTags(ids, available);
  const selectionValid = selected !== null;
  const domainInvalid = selected?.some(option => option.domainValid === false) ?? false;
  const missing = ids.filter(value => !byId.has(value));
  const locked = Boolean(field.disabled || readOnly);
  const editingBlocked = locked || resolution.loading || missing.length > 0;
  const expanded = open && !editingBlocked && !modalOpen;
  const suggestions = useMany2OneSearch({ ...request, query, pageSize: 5 }, expanded, 250, load);
  const options = suggestions.data?.items ?? [];
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const text = query.trim().replace(/\s+/g, " ");
  // «Crear» only when the search finished and no readable option already has that name.
  const canCreate = Boolean(onCreate && text && !suggestions.loading && !suggestions.error && !options.some(option => sameName(option.label, text)) && ids.length < Math.min(100, Math.max(1, Math.trunc(maxSelected))));
  const extra = canCreate ? 1 : 0;
  const moreIndex = options.length + extra;
  const activeIndex = Math.min(active, moreIndex);
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

  function validate(current: unknown) {
    if (locked) return null;
    if (!Array.isArray(current) || current.some(value => typeof value !== "string" || !value)) return "El valor debe ser un arreglo de IDs.";
    if (new Set(current).size !== current.length) return "La selección contiene registros duplicados.";
    if (current.length > maximum) return `Selecciona como máximo ${maximum} registros.`;
    if (!current.length) return required ? "Selecciona al menos un registro." : null;
    if (resolution.loading) return "Espera a que terminen de cargar los registros.";
    if (resolution.error) return "No se pudo verificar la selección. Reintenta la búsqueda.";
    if (domainInvalid) return "Hay selecciones que no cumplen el dominio vigente. Revisa sus dependencias o retíralas.";
    return selectionValid ? null : "Hay registros que ya no están disponibles. Revisa la selección.";
  }
  useFormFieldValidation(name, validate, "fieldRelationTag");

  function commit(next: readonly Many2OneOption[]) {
    if (locked || next.length > maximum) return;
    const unique = [...new Map(next.map(option => [option.value, option])).values()];
    setCached({ context, load, options: unique });
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

  async function create() {
    if (!onCreate || !canCreate || creating || editingBlocked || !selected) return;
    setCreating(true); setCreateError(null);
    try {
      const result = await onCreate(text);
      if (!result.ok) { setCreateError(result.error); return; }
      // An existing record with the same name may come back (created: false): just select it.
      commit(ids.includes(result.item.value) ? selected : [...selected, result.item]);
    } catch {
      setCreateError("No se pudo crear el registro. Revisa tu conexión e intenta de nuevo.");
    } finally {
      setCreating(false);
    }
  }

  function openModal() {
    if (!editingBlocked) { setOpen(false); setModalOpen(true); }
  }

  return (
    <div data-form-field={name} className={fieldDirectionClassName(direction, fieldLabel)}>
      {fieldLabel && <label htmlFor={inputId} className={fieldLabelClassName(direction)}>{fieldLabel}</label>}
      <div ref={root} className="relative min-w-0" onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}>
        <div ref={anchor} className={`${fieldInputClassName} h-auto! min-h-[var(--form-tags-min-height,2.75rem)] flex-wrap items-end gap-1 px-1 py-1 ${locked ? "opacity-55" : ""} ${className}`}>
          <div className="flex min-w-0 basis-48 flex-1 flex-wrap items-center gap-1.5">
            {ids.length > 0 && <ul role="list" aria-label={`${accessibleLabel}: seleccionados`} className="contents">
              {ids.map(value => {
                const option = byId.get(value);
                const canRemove = !locked && !resolution.loading && Boolean(resolveRelationTags(ids.filter(id => id !== value), available));
                return <li key={value} className={`badge badge-soft h-auto min-h-[var(--form-tag-min-height,1.75rem)] max-w-full gap-1 rounded-lg px-2 py-[var(--form-tag-py,0.25rem)] ${option ? "badge-primary" : "badge-ghost"}`}>
                  <span className="min-w-0 text-xs leading-relaxed whitespace-normal wrap-anywhere">{option?.label ?? (resolution.loading ? "Cargando…" : "Registro no disponible")}</span>
                  {!locked && <button type="button" disabled={!canRemove} className="flex size-5 shrink-0 cursor-pointer items-center justify-center rounded-md transition-colors hover:bg-primary/15 focus-visible:outline-2 focus-visible:outline-primary disabled:cursor-default disabled:opacity-40" aria-label={`Quitar ${option?.label ?? value}`} onClick={() => remove(value)}><X size={12} aria-hidden="true" /></button>}
                </li>;
              })}
            </ul>}
            <div className="flex min-w-0 basis-20 flex-1 items-center gap-1">
              <Search size={15} className="shrink-0 text-base-content/40" aria-hidden="true" />
              <input {...inputProps} id={inputId} name={field.name} ref={element => { input.current = element; field.ref(element); }} type="text" role="combobox" autoComplete="off"
                disabled={field.disabled} readOnly={editingBlocked} value={query} maxLength={120} placeholder={locked ? ids.length ? "" : "Sin selección" : placeholder}
                className="h-[var(--form-tags-input-height,2rem)] w-full min-w-0 flex-1 border-0 bg-transparent text-sm shadow-none outline-none placeholder:text-base-content/40 focus:outline-none"
                aria-label={inputProps["aria-labelledby"] ? ariaLabel : accessibleLabel} aria-expanded={expanded} aria-controls={expanded ? listId : undefined} aria-autocomplete="list" aria-haspopup="listbox"
                aria-activedescendant={expanded ? `${listId}-${activeIndex}` : undefined} aria-required={required} aria-invalid={fieldState.invalid || inputProps["aria-invalid"]}
                aria-describedby={[describedBy, statusId, fieldState.invalid ? errorId : undefined].filter(Boolean).join(" ")}
                onFocus={event => { if (skipFocus.current) skipFocus.current = false; else if (!editingBlocked) { setQuery(""); setActive(0); setOpen(true); } onFocus?.(event); }}
                onClick={() => { if (!editingBlocked) setOpen(true); }}
                onBlur={event => { field.onBlur(); onBlur?.(event); }}
                onChange={event => { if (!editingBlocked) { setQuery(event.currentTarget.value); setActive(0); setOpen(true); setCreateError(null); } }}
                onKeyDown={event => {
                  if (event.key === "Tab") { setOpen(false); return; }
                  if (event.key === "Escape" && expanded) { event.preventDefault(); event.stopPropagation(); setOpen(false); return; }
                  if (editingBlocked) return;
                  if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                    event.preventDefault();
                    if (!expanded) { setOpen(true); setActive(0); }
                    else setActive(index => (Math.min(index, moreIndex) + (event.key === "ArrowDown" ? 1 : moreIndex)) % (moreIndex + 1));
                  } else if (event.key === "Enter" && expanded) {
                    event.preventDefault();
                    if (activeIndex === moreIndex) openModal(); else if (canCreate && activeIndex === options.length) void create(); else toggle(options[activeIndex]);
                  } else if (event.key === "Backspace" && !query && ids.length) { event.preventDefault(); remove(ids[ids.length - 1]); }
                }} />
            </div>
          </div>
          <div className="flex h-[var(--form-tags-input-height,2rem)] shrink-0 items-center gap-1">
            {ids.length > 0 && clearable && !locked && <button type="button" className="btn btn-circle btn-ghost btn-xs shrink-0" aria-label={`Limpiar ${accessibleLabel}`} onClick={() => { commit([]); restoreFocus(); }}><X size={14} aria-hidden="true" /></button>}
            <button type="button" className="btn btn-circle btn-ghost btn-xs shrink-0" disabled={editingBlocked} aria-label={`Buscar más: ${accessibleLabel}`} aria-haspopup="dialog" onClick={openModal}><ChevronDown size={16} aria-hidden="true" /></button>
          </div>
        </div>

        {/* Only exceptional states below the control; empty (and without margin) in normal use. */}
        <div id={statusId} role="status" className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-base-content/50 empty:mt-0">
          {resolution.loading ? "Cargando selección…" : resolution.error ? <>{resolution.error}<button type="button" className="cursor-pointer underline" onClick={resolution.retry}>Reintentar</button></> : missing.length ? <>
            {missing.length} registro{missing.length === 1 ? " no disponible" : "s no disponibles"}.
            {!locked && <button type="button" className="cursor-pointer underline" onClick={() => commit(ids.flatMap(value => byId.get(value) ? [byId.get(value)!] : []))}>Quitar no disponibles</button>}
          </> : domainInvalid ? <span className="text-error">Hay selecciones que no cumplen el filtro actual. Puedes retirarlas o corregir sus dependencias.</span> : null}
        </div>

        {expanded && <RelationDropdown anchorRef={anchor} activeId={`${listId}-${activeIndex}`}>
          <div id={listId} role="listbox" aria-multiselectable="true" aria-label={`Resultados: ${accessibleLabel}`} aria-busy={suggestions.loading}>
            {suggestions.loading && <p role="status" className="flex items-center gap-2 px-4 py-3 text-sm text-base-content/55"><span className="loading loading-spinner loading-xs" aria-hidden="true" />Buscando…</p>}
            {suggestions.error && <div role="alert" className="space-y-2 p-3 text-sm"><p>{suggestions.error}</p><button type="button" className="btn btn-soft btn-xs" onClick={suggestions.retry}>Reintentar</button></div>}
            {!suggestions.loading && !suggestions.error && !options.length && <p role="status" className="px-4 py-4 text-sm text-base-content/55">Sin coincidencias</p>}
            {options.map((option, index) => <div key={option.value} id={`${listId}-${index}`} role="option" aria-selected={ids.includes(option.value)} aria-disabled={atLimit && !ids.includes(option.value)}
              className={`flex cursor-pointer items-center justify-between gap-2 px-4 py-3 text-sm transition-colors ${atLimit && !ids.includes(option.value) ? "opacity-40" : ""} ${activeIndex === index ? "bg-primary/10 text-primary" : "hover:bg-base-200"}`}
              onMouseDown={event => event.preventDefault()} onMouseEnter={() => setActive(index)} onClick={() => toggle(option)}>
              <span className="min-w-0 wrap-anywhere">{option.label}</span>{ids.includes(option.value) && <Check size={15} className="shrink-0 text-primary" aria-hidden="true" />}
            </div>)}
            {canCreate && <div id={`${listId}-${options.length}`} role="option" aria-selected="false" aria-disabled={creating} className={`border-t border-base-300 ${activeIndex === options.length ? "bg-primary/5" : ""}`}>
              <button type="button" tabIndex={-1} disabled={creating} className="flex w-full cursor-pointer items-center gap-2 px-4 py-3 text-left text-sm font-medium text-primary hover:bg-primary/5 disabled:cursor-wait disabled:opacity-60" onMouseDown={event => event.preventDefault()} onMouseEnter={() => setActive(options.length)} onClick={() => void create()}>
                {creating ? <span className="loading loading-spinner loading-xs" aria-hidden="true" /> : <Plus size={15} aria-hidden="true" />}<span className="min-w-0 wrap-anywhere">{creating ? "Creando…" : <>Crear «{text}»</>}</span>
              </button>
            </div>}
            {createError && <p role="alert" className="border-t border-base-300 px-4 py-2 text-xs text-error">{createError}</p>}
            <div id={`${listId}-${moreIndex}`} role="option" aria-selected="false" className={`border-t border-base-300 ${activeIndex === moreIndex ? "bg-primary/5" : ""}`}>
              <button type="button" tabIndex={-1} className="flex w-full cursor-pointer items-center gap-2 px-4 py-3 text-left text-sm font-medium text-primary hover:bg-primary/5" onMouseDown={event => event.preventDefault()} onMouseEnter={() => setActive(moreIndex)} onClick={openModal}><Search size={15} aria-hidden="true" />Buscar más…</button>
            </div>
          </div>
        </RelationDropdown>}
        {fieldState.invalid && <span id={errorId} className="sr-only">{fieldState.error?.message || `${accessibleLabel}: selección inválida.`}</span>}
        {modalOpen && !editingBlocked && selected && <Many2OneSearchModal load={load} key={`${context}:${JSON.stringify(ids)}`} title={fieldLabel || "Registros"} request={{ ...request, pageSize }} initialQuery={query}
          multiple selectedOptions={selected} maxSelected={maximum} columns={columns} onConfirm={commit} onClose={() => setModalOpen(false)} onAfterClose={restoreFocus} />}
      </div>
    </div>
  );
}
