"use client";

import { Suspense, useCallback, useEffect, useId, useLayoutEffect, useRef, type ReactNode } from "react";
import { useFieldArray, useFormContext, useFormState, useWatch, type FieldArray, type FieldArrayPath, type FieldPath, type FieldValues } from "react-hook-form";
import { ArrowDown, ArrowUp, ListPlus, Plus, Trash2 } from "lucide-react";
import type { FieldDirection } from "./field.types";
import { fieldDirectionClassName, fieldLabelClassName } from "./field.styles";
import { useFormFieldValidation } from "./formValidation";
import { rowLimits, sameRowData } from "./one2manyValues";
import { formErrorPaths } from "./notebookErrors";

export type One2manyRowContext<TValues extends FieldValues, TName extends FieldArrayPath<TValues>> = {
  index: number;
  row: FieldArray<TValues, TName>;
  fieldName: (field: FieldArray<TValues, TName> extends FieldValues ? FieldPath<FieldArray<TValues, TName>> : never) => FieldPath<TValues>;
  readOnly: boolean;
  disabled: boolean;
};
export type One2manyColumn<TValues extends FieldValues, TName extends FieldArrayPath<TValues>> = {
  key: string;
  label: string;
  width?: string;
  align?: "left" | "right" | "center";
  render: (context: One2manyRowContext<TValues, TName>) => ReactNode;
};
export type FieldOne2manyProps<TValues extends FieldValues, TName extends FieldArrayPath<TValues> = FieldArrayPath<TValues>> = {
  name: TName;
  label?: string;
  direction?: FieldDirection;
  columns: readonly One2manyColumn<TValues, TName>[];
  createRow: () => FieldArray<TValues, TName>;
  onChange?: (rows: FieldArray<TValues, TName>[]) => void;
  minRows?: number;
  maxRows?: number;
  required?: boolean;
  disabled?: boolean;
  readOnly?: boolean;
  reorderable?: boolean;
  addLabel?: string;
  emptyText?: string;
  footer?: ReactNode | ((rows: readonly FieldArray<TValues, TName>[]) => ReactNode);
  id?: string;
  className?: string;
  "aria-label"?: string;
};

const alignments = { left: "text-left", right: "text-right", center: "text-center" };

function One2manyContent<TValues extends FieldValues, TName extends FieldArrayPath<TValues> = FieldArrayPath<TValues>>({
  name, label, direction = "block", columns, createRow, onChange, minRows = 0, maxRows = 100, required,
  disabled = false, readOnly = false, reorderable = false, addLabel = "Agregar línea", emptyText = "Todavía no hay líneas.", footer,
  id, className = "", "aria-label": ariaLabel,
}: FieldOne2manyProps<TValues, TName>) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const fieldLabel = label?.trim();
  const accessibleLabel = ariaLabel || fieldLabel || name;
  const root = useRef<HTMLDivElement>(null);
  const methods = useFormContext<TValues>();
  const { control, getValues, subscribe } = methods;
  const path = name as unknown as FieldPath<TValues>;
  const getRows = useCallback(() => {
    const value = getValues(path);
    return (Array.isArray(value) ? value : []) as FieldArray<TValues, TName>[];
  }, [getValues, path]);
  const formState = useFormState({ control, name: path });
  const locked = disabled || readOnly || formState.disabled;
  const limits = rowLimits(required ? Math.max(1, Number.isFinite(minRows) ? minRows : 0) : minRows, maxRows);
  const { fields, append, remove, move } = useFieldArray({ name, control, shouldUnregister: false });
  const watched = useWatch({ control, name: path });
  const rows = (Array.isArray(watched) ? watched : []) as FieldArray<TValues, TName>[];
  const callback = useRef(onChange);
  useLayoutEffect(() => { callback.current = onChange; }, [onChange]);

  useEffect(() => {
    let previous = structuredClone(getRows());
    let current = true;
    let queued = false;
    let pending: FieldArray<TValues, TName>[] | null = null;
    const unsubscribe = subscribe({ name: path, formState: { values: true }, callback: ({ name: changed }) => {
      const next = getRows();
      const different = !sameRowData(previous, next);
      previous = structuredClone(next) as typeof previous;
      // A whole-form reset updates the baseline without emitting a business change.
      if (!changed) { pending = null; return; }
      if (!different) return;
      pending = structuredClone(next) as FieldArray<TValues, TName>[];
      if (queued) return;
      queued = true;
      queueMicrotask(() => {
        queued = false;
        if (current && pending) { const value = pending; pending = null; callback.current?.(value); }
      });
    } });
    return () => { current = false; unsubscribe(); };
  }, [path, subscribe, getRows]);

  const validate = useCallback((value: unknown) => {
    if (locked) return null;
    if (!Array.isArray(value) || value.some(row => !row || typeof row !== "object" || Array.isArray(row))) return "Las líneas deben ser un arreglo de objetos.";
    if (value.length < limits.minimum) return `${accessibleLabel}: agrega al menos ${limits.minimum} línea${limits.minimum === 1 ? "" : "s"}.`;
    if (value.length > limits.maximum) return `${accessibleLabel}: el máximo es de ${limits.maximum} líneas.`;
    return null;
  }, [locked, limits.minimum, limits.maximum, accessibleLabel]);
  useFormFieldValidation(name, validate, "fieldOne2many");
  const error = methods.getFieldState(path, formState).error;
  const errorMessage = error?.message || (error as typeof error & { root?: { message?: string } })?.root?.message;
  const errorPaths = formErrorPaths(formState.errors);
  const footerContent = typeof footer === "function" ? footer(rows) : footer;

  function canEdit() { return !locked && !root.current?.closest("fieldset:disabled"); }
  function add() {
    if (!canEdit() || getRows().length >= limits.maximum) return;
    append(structuredClone(createRow()), { shouldFocus: true });
  }
  function deleteRow(index: number) {
    if (!canEdit() || getRows().length <= limits.minimum) return;
    remove(index);
    requestAnimationFrame(() => {
      const target = root.current?.querySelector<HTMLElement>(`[data-one2many-row="${Math.min(index, fields.length - 2)}"] input:not(:disabled), [data-one2many-row="${Math.min(index, fields.length - 2)}"] select:not(:disabled)`);
      (target ?? root.current)?.focus();
    });
  }
  function moveRow(from: number, to: number) { if (canEdit() && to >= 0 && to < fields.length) move(from, to); }

  return <div data-form-field={name} className={`${fieldDirectionClassName(direction, fieldLabel)} col-span-full ${className}`}>
    {fieldLabel && <span id={`${inputId}-label`} className={fieldLabelClassName(direction)}>{fieldLabel}</span>}
    <div ref={root} id={inputId} role="group" tabIndex={0} data-one2many-root aria-label={!fieldLabel || ariaLabel ? accessibleLabel : undefined}
      aria-labelledby={fieldLabel && !ariaLabel ? `${inputId}-label` : undefined} aria-disabled={disabled || undefined}
      aria-describedby={errorMessage ? `${inputId}-error` : undefined} className="@container/o2m min-w-0 rounded-xl border border-base-300 bg-base-100 outline-offset-2 focus-visible:outline-2 focus-visible:outline-primary">
      <header className="flex flex-wrap items-center justify-between gap-2 rounded-t-xl border-b border-base-300 bg-base-200/45 px-3 py-2.5">
        <span className="flex items-center gap-2 text-xs font-medium text-base-content/60"><ListPlus size={16} aria-hidden="true" />{fields.length} línea{fields.length === 1 ? "" : "s"}</span>
        {!readOnly && <button type="button" disabled={locked || fields.length >= limits.maximum} className="btn btn-primary btn-soft btn-sm gap-1.5" onClick={add}><Plus size={15} aria-hidden="true" />{addLabel}</button>}
      </header>
      <fieldset disabled={locked} className="m-0 min-w-0 border-0 p-0">
        <table role="table" aria-label={accessibleLabel} className="table block w-full @3xl/o2m:table @3xl/o2m:table-fixed">
          <thead role="rowgroup" className="sr-only @3xl/o2m:not-sr-only @3xl/o2m:table-header-group"><tr role="row" className="text-xs text-base-content/50">
            <th scope="col" role="columnheader" className="w-10 px-2 py-3"><span className="sr-only">Línea</span>#</th>
            {columns.map(column => <th key={column.key} scope="col" role="columnheader" style={{ width: column.width }} className={`px-3 py-3 font-medium ${alignments[column.align ?? "left"]}`}>{column.label}</th>)}
            {!readOnly && <th scope="col" role="columnheader" className={reorderable ? "w-28 px-2" : "w-11 px-2"}><span className="sr-only">Acciones de línea</span></th>}
          </tr></thead>
          <tbody role="rowgroup" className="block space-y-3 p-3 @3xl/o2m:table-row-group @3xl/o2m:space-y-0 @3xl/o2m:p-0">
            {fields.map((field, index) => {
              // field.id is only a render key. Business IDs always come from RHF values.
              const row = rows[index] ?? getRows()[index];
              const context: One2manyRowContext<TValues, TName> = { index, row, fieldName: key => `${name}.${index}.${key}` as FieldPath<TValues>, readOnly, disabled: disabled || formState.disabled };
              return <tr key={field.id} role="row" data-one2many-row={index} className="block rounded-xl border border-base-300 bg-base-200/15 p-3 @3xl/o2m:table-row @3xl/o2m:rounded-none @3xl/o2m:border-x-0 @3xl/o2m:border-t-0 @3xl/o2m:bg-transparent @3xl/o2m:p-0 @3xl/o2m:hover:bg-primary/3">
                <td role="cell" className="mb-2 block px-0 py-1 align-middle text-xs font-semibold text-base-content/40 @3xl/o2m:table-cell @3xl/o2m:px-2 @3xl/o2m:py-3 @3xl/o2m:text-center"><span className="@3xl/o2m:hidden">Línea </span>{index + 1}{errorPaths.some(path => path.startsWith(`${name}.${index}.`) || path === `${name}.${index}`) && <span className="ml-1 text-error" aria-label={`Línea ${index + 1} con errores`}>•</span>}</td>
                {columns.map(column => <td role="cell" key={column.key} className={`block min-w-0 px-0 py-2 align-middle @3xl/o2m:table-cell @3xl/o2m:px-3 @3xl/o2m:py-3 ${alignments[column.align ?? "left"]}`}>
                  <span aria-hidden="true" className="mb-1 block text-left text-xs font-medium text-base-content/55 @3xl/o2m:hidden">{column.label}</span>
                  {column.render(context)}
                </td>)}
                {!readOnly && <td role="cell" className="mt-2 block border-t border-base-300 px-0 pt-2 align-middle @3xl/o2m:table-cell @3xl/o2m:border-t-0 @3xl/o2m:px-2 @3xl/o2m:py-3">
                  <div className="flex items-center justify-end gap-0.5">
                    {reorderable && <><button type="button" disabled={locked || index === 0} className="btn btn-square btn-ghost btn-xs text-base-content/45" aria-label={`Subir línea ${index + 1}`} onClick={() => moveRow(index, index - 1)}><ArrowUp size={14} aria-hidden="true" /></button><button type="button" disabled={locked || index === fields.length - 1} className="btn btn-square btn-ghost btn-xs text-base-content/45" aria-label={`Bajar línea ${index + 1}`} onClick={() => moveRow(index, index + 1)}><ArrowDown size={14} aria-hidden="true" /></button></>}
                    <button type="button" disabled={locked || fields.length <= limits.minimum} className="btn btn-square btn-ghost btn-xs text-base-content/40 hover:bg-error/10 hover:text-error" aria-label={`Quitar línea ${index + 1}`} onClick={() => deleteRow(index)}><Trash2 size={15} aria-hidden="true" /></button>
                  </div>
                </td>}
              </tr>;
            })}
            {!fields.length && <tr role="row" className="block @3xl/o2m:table-row"><td role="cell" colSpan={columns.length + (readOnly ? 1 : 2)} className="block px-4 py-8 text-center text-sm text-base-content/45 @3xl/o2m:table-cell">{emptyText}</td></tr>}
          </tbody>
        </table>
      </fieldset>
      {(errorMessage || footerContent || fields.length >= limits.maximum) && <footer className="space-y-2 rounded-b-xl border-t border-base-300 bg-base-200/25 px-3 py-3">
        {errorMessage && <p id={`${inputId}-error`} className="text-xs text-error">{errorMessage}</p>}
        {fields.length >= limits.maximum && <p className="text-xs text-base-content/50">Máximo de {limits.maximum} líneas alcanzado.</p>}
        {footerContent}
      </footer>}
    </div>
  </div>;
}

/** RHF generates random row keys; own the Suspense boundary required by Next's prerender. */
export default function FieldOne2many<TValues extends FieldValues, TName extends FieldArrayPath<TValues> = FieldArrayPath<TValues>>(props: FieldOne2manyProps<TValues, TName>) {
  return <Suspense fallback={<div role="status" className="col-span-full min-w-0 rounded-xl border border-base-300 bg-base-200/30 p-5 text-sm text-base-content/50">Cargando líneas…</div>}><One2manyContent {...props} /></Suspense>;
}
