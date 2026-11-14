"use client";

import { useCallback, useEffect, useId, useRef, useState, type ComponentPropsWithoutRef } from "react";
import { useController, useFormContext, type FieldValues } from "react-hook-form";
import { Check, ChevronDown, Search, X } from "lucide-react";
import { lookupModels, type Many2OneModel, type Many2OneOption, type Many2OneRecord } from "@/lib/many2one/types";
import type { Many2OneLoader } from "@/lib/many2one/model-lookup";
import { useModelField } from "./modelFields";
import { useFieldDirection } from "./fieldDirection";
import FieldVisibility from "./FieldVisibility";
import type { BaseFieldProps } from "./field.types";
import { fieldDirectionClassName, fieldInputClassName, fieldLabelClassName } from "./field.styles";
import { useFormFieldValidation } from "./formValidation";
import { useMany2OneSearch } from "./useMany2OneSearch";
import Many2OneSearchModal, { type Many2OneColumn } from "./Many2OneSearchModal";
import { PartnerIdentity } from "../PartnerAvatar";

export type { Many2OneModel, Many2OneRecord } from "@/lib/many2one/types";
type EditableProps<TFieldValues extends FieldValues = FieldValues> =
  Omit<BaseFieldProps<TFieldValues>, "onChange"> &
  Omit<ComponentPropsWithoutRef<"input">, keyof BaseFieldProps<TFieldValues> | "type" | "value" | "defaultValue" | "children" | "onChange" | "onKeyDown" | "size" | "role"> & {
    mode?: "edit";
    columns?: readonly Many2OneColumn[];
    pageSize?: 5 | 10 | 20 | 25;
    clearable?: boolean;
    onChange?: (id: string | null, record: Many2OneRecord | null) => void;
  } & (
    | { model: Many2OneModel; load?: never; searchFields?: readonly string[]; displayName?: string }
    | { load?: Many2OneLoader; model?: never; searchFields?: never; displayName?: never }
  );

export type FieldMany2OneDisplayProps = {
  invisible?: boolean;
  mode: "display";
  value: { id: string; label: string; avatarUrl?: string | null } | null;
  label?: string;
  direction?: BaseFieldProps["direction"];
  emptyText?: string;
  id?: string;
  className?: string;
  "aria-label"?: string;
};
export type FieldMany2OneProps<TFieldValues extends FieldValues = FieldValues> = EditableProps<TFieldValues> | FieldMany2OneDisplayProps;

function DisplayRelation({ value, label, direction: requestedDirection = "block", emptyText = "Sin información", id, className = "", "aria-label": ariaLabel }: FieldMany2OneDisplayProps) {
  const direction = useFieldDirection(requestedDirection) ?? "block";
  const generatedId = useId();
  const labelId = `${id ?? generatedId}-label`;
  const fieldLabel = label?.trim();
  return <div role="group" aria-labelledby={fieldLabel ? labelId : undefined} aria-label={fieldLabel ? undefined : ariaLabel} className={fieldDirectionClassName(direction, fieldLabel)}>
    {fieldLabel && <span id={labelId} className={fieldLabelClassName(direction)}>{fieldLabel}</span>}
    <div id={id} className={`flex min-h-10 min-w-0 items-center rounded-lg bg-base-200/40 px-3 py-2 text-sm ${className}`}>
      {value ? <PartnerIdentity name={value.label} avatarUrl={value.avatarUrl} /> : <span className="text-base-content/45">{emptyText}</span>}
    </div>
  </div>;
}

export default function FieldMany2One<TFieldValues extends FieldValues = FieldValues>(props: FieldMany2OneProps<TFieldValues>) {
  const { invisible, ...controlProps } = props;
  return <FieldVisibility name={"name" in props ? props.name : undefined} invisible={invisible}>
    {controlProps.mode === "display" ? <DisplayRelation {...controlProps} /> : <EditableRelation<TFieldValues> {...controlProps} />}
  </FieldVisibility>;
}

function EditableRelation<TFieldValues extends FieldValues = FieldValues>(props: EditableProps<TFieldValues>) {
  const {
  name, label, direction = "block", model = "partner", load, searchFields = lookupModels[model as Many2OneModel].searchFields,
  displayName = lookupModels[model as Many2OneModel].displayName, columns, pageSize = 10, clearable = true,
  onChange, onBlur, onFocus, disabled, readOnly, required, id, className = "", placeholder = "Buscar y seleccionar…",
  "aria-label": ariaLabel, "aria-describedby": describedBy, ...inputProps
} = useModelField(props, "many2one");
  delete inputProps.mode;
  if (!props.model && !load) throw new Error(`Configura un lookup autorizado para ${name}.`);
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const listId = `${inputId}-list`, errorId = `${inputId}-error`, statusId = `${inputId}-status`;
  const root = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const skipFocus = useRef(false);
  const { control, watch } = useFormContext<TFieldValues>();
  const { field, fieldState } = useController({ name, control, disabled });
  const value = typeof field.value === "string" && field.value ? field.value : null;
  const [open, setOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [cached, setCached] = useState<{ context: string; load?: Many2OneLoader; option: Many2OneOption } | null>(null);
  const request = { model, searchFields, displayName };
  const context = JSON.stringify(request);
  const savedOption = cached?.load === load && cached?.context === context && cached.option.value === value ? cached.option : null;
  const resolution = useMany2OneSearch({ ...request, id: value ?? "", pageSize: 1 }, Boolean(value && !savedOption), 0, load);
  const selected = savedOption ?? resolution.data?.items[0] ?? null;
  const locked = field.disabled || readOnly;
  const expanded = open && !locked && !modalOpen;
  const suggestions = useMany2OneSearch({ ...request, query, pageSize: 5 }, expanded, 250, load);
  const options = suggestions.data?.items ?? [];
  const activeIndex = Math.min(active, options.length);
  const fieldLabel = label?.trim();
  const accessibleLabel = ariaLabel || fieldLabel || name;
  const errorMessage = fieldState.error?.message || `${fieldLabel || name}: selecciona un registro válido.`;

  const restoreFocus = useCallback(() => {
    skipFocus.current = true;
    input.current?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
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
    if (field.disabled || readOnly) return null;
    if (current == null || current === "") return required ? "Selecciona un registro." : null;
    if (typeof current !== "string") return "El valor debe ser el ID de un registro.";
    if (resolution.loading) return "Espera a que termine de cargar la selección.";
    if (resolution.error) return "No se pudo verificar la selección. Reintenta la búsqueda.";
    return selected ? null : "El registro seleccionado ya no está disponible.";
  }, [field.disabled, readOnly, required, resolution.loading, resolution.error, selected]);
  useFormFieldValidation(name, validate, "fieldMany2One");

  function choose(option: Many2OneOption | null) {
    if (locked) return;
    setCached(option ? { context, load, option } : null);
    field.onChange(option?.value ?? null);
    field.onBlur();
    setQuery(""); setOpen(false); setModalOpen(false); setActive(0);
    onChange?.(option?.value ?? null, option?.record ?? null);
  }

  function openModal() {
    if (locked) return;
    setOpen(false); setModalOpen(true);
  }

  return (
    <div data-form-field={name} className={fieldDirectionClassName(direction, fieldLabel)}>
      {fieldLabel && <label htmlFor={inputId} className={fieldLabelClassName(direction)}>{fieldLabel}</label>}
      <div ref={root} className="relative min-w-0" onBlur={event => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}>
        <div className="relative flex min-w-0 items-center">
          <Search size={16} className="pointer-events-none absolute left-1 z-10 text-base-content/40" aria-hidden="true" />
          <input {...inputProps} id={inputId} name={field.name} ref={element => { input.current = element; field.ref(element); }}
            type="text" role="combobox" autoComplete="off" disabled={field.disabled} readOnly={readOnly}
            value={expanded ? query : selected?.label ?? (value ? resolution.loading ? "Cargando selección…" : "Selección no disponible" : "")}
            placeholder={placeholder} maxLength={120} className={`${fieldInputClassName} pl-7 pr-18 ${className}`}
            aria-label={inputProps["aria-labelledby"] ? ariaLabel : accessibleLabel}
            aria-expanded={expanded} aria-controls={expanded ? listId : undefined} aria-autocomplete="list" aria-haspopup="listbox"
            aria-activedescendant={expanded ? `${listId}-${activeIndex}` : undefined}
            aria-required={required} aria-invalid={fieldState.invalid || inputProps["aria-invalid"]}
            aria-describedby={[describedBy, value && !selected && !resolution.loading ? statusId : undefined, fieldState.invalid ? errorId : undefined].filter(Boolean).join(" ") || undefined}
            onFocus={event => {
              if (skipFocus.current) skipFocus.current = false;
              else if (!locked) { setQuery(""); setActive(0); setOpen(true); }
              onFocus?.(event);
            }}
            onClick={() => { if (!locked && !expanded) { setQuery(""); setActive(0); setOpen(true); } }}
            onBlur={event => { field.onBlur(); onBlur?.(event); }}
            onChange={event => { setQuery(event.currentTarget.value); setActive(0); setOpen(true); }}
            onKeyDown={event => {
              if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                if (locked) return;
                event.preventDefault();
                if (!expanded) { setQuery(""); setActive(0); setOpen(true); }
                else setActive(index => (Math.min(index, options.length) + (event.key === "ArrowDown" ? 1 : options.length)) % (options.length + 1));
              } else if (event.key === "Enter" && expanded) {
                event.preventDefault();
                if (activeIndex === options.length) openModal();
                else choose(options[activeIndex]);
              } else if (event.key === "Escape" && expanded) {
                event.preventDefault(); event.stopPropagation(); setOpen(false);
              } else if (event.key === "Tab") setOpen(false);
            }} />
          <div className="absolute right-0 flex items-center gap-0.5">
            {value && clearable && !locked && <button type="button" className="btn btn-circle btn-ghost btn-xs" aria-label={`Limpiar ${accessibleLabel}`} onClick={() => { choose(null); restoreFocus(); }}><X size={14} aria-hidden="true" /></button>}
            <button type="button" className="btn btn-circle btn-ghost btn-xs" disabled={Boolean(locked)} aria-label={`Buscar más: ${accessibleLabel}`} aria-haspopup="dialog" onClick={openModal}><ChevronDown size={16} aria-hidden="true" /></button>
          </div>
        </div>

        {expanded && <div className="absolute inset-x-0 top-full z-40 mt-2 overflow-hidden rounded-xl border border-base-300 bg-base-100 shadow-lg">
          <div id={listId} role="listbox" aria-label={`Resultados: ${accessibleLabel}`} aria-busy={suggestions.loading}>
            {suggestions.loading && <p role="status" className="flex items-center gap-2 px-4 py-3 text-sm text-base-content/55"><span className="loading loading-spinner loading-xs" aria-hidden="true" />Buscando…</p>}
            {suggestions.error && <div role="alert" className="space-y-2 p-3 text-sm"><p>{suggestions.error}</p><button type="button" className="btn btn-soft btn-xs" onClick={suggestions.retry}>Reintentar</button></div>}
            {!suggestions.loading && !suggestions.error && !options.length && <p role="status" className="px-4 py-4 text-sm text-base-content/55">Sin coincidencias</p>}
            {options.map((option, index) => <div key={option.value} id={`${listId}-${index}`} role="option" aria-selected={option.value === value}
              className={`flex cursor-pointer items-center justify-between gap-2 px-4 py-3 text-sm transition-colors ${activeIndex === index ? "bg-primary/10 text-primary" : "hover:bg-base-200"}`}
              onMouseDown={event => event.preventDefault()} onMouseEnter={() => setActive(index)} onClick={() => choose(option)}>
              <span className="min-w-0 wrap-anywhere">{option.label}</span>{option.value === value && <Check size={15} className="shrink-0 text-primary" aria-hidden="true" />}
            </div>)}
            <div id={`${listId}-${options.length}`} role="option" aria-selected="false" className={`border-t border-base-300 ${activeIndex === options.length ? "bg-primary/5" : ""}`}>
              <button type="button" tabIndex={-1} className="flex w-full cursor-pointer items-center gap-2 px-4 py-3 text-left text-sm font-medium text-primary hover:bg-primary/5" onMouseDown={event => event.preventDefault()} onMouseEnter={() => setActive(options.length)} onClick={openModal}><Search size={15} aria-hidden="true" />Buscar más…</button>
            </div>
          </div>
        </div>}

        {value && !selected && !resolution.loading && <p id={statusId} role="status" className="mt-1 text-xs text-base-content/60">{resolution.error || "El registro ya no está disponible."}{resolution.error && <button type="button" className="ml-2 cursor-pointer underline" onClick={resolution.retry}>Reintentar</button>}</p>}
        {fieldState.invalid && <span id={errorId} className="sr-only">{errorMessage}</span>}
        {modalOpen && !locked && <Many2OneSearchModal load={load} title={fieldLabel || "Registros"} request={{ ...request, pageSize }} initialQuery={query} selectedId={value} columns={columns}
          onSelect={choose} onClose={() => setModalOpen(false)} onAfterClose={restoreFocus} />}
      </div>
    </div>
  );
}
