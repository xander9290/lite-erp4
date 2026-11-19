"use client";

import { Children, Fragment, isValidElement, lazy, Suspense, useContext, useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { useFieldArray, useFormContext, useFormState, useWatch, type FieldArray, type FieldArrayPath, type FieldPath, type FieldValues } from "react-hook-form";
import { ArrowDown, ArrowUp, ChevronDown, ChevronRight, Plus, Trash2 } from "lucide-react";
import type { FieldDirection } from "./field.types";
import { fieldDirectionClassName, fieldLabelClassName } from "./field.styles";
import { useFormFieldValidation } from "./formValidation";
import { rowLimits, sameRowData } from "./one2manyValues";
import { formErrorPaths } from "./notebookErrors";
import { useFieldDirection } from "./fieldDirection";
import { FormModelContext, lineAt } from "./modelFields";
import FieldText from "./FieldText";
import FieldNumber from "./FieldNumber";
import FieldDate from "./FieldDate";
import FieldBoolean from "./FieldBoolean";
import FieldSelect from "./FieldSelect";
import type { FieldMetadata } from "@/lib/orm/fields";
import FieldVisibility from "./FieldVisibility";

const FieldMany2One = lazy(() => import("./FieldMany2One"));
const FieldImage = lazy(() => import("./FieldImage"));

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
export type FieldOne2manyProps<TValues extends FieldValues = FieldValues, TName extends FieldArrayPath<TValues> = FieldArrayPath<TValues>> = {
  invisible?: boolean;
  name: TName;
  label?: string;
  direction?: FieldDirection;
  columns?: readonly One2manyColumn<TValues, TName>[];
  createRow?: () => FieldArray<TValues, TName>;
  children?: ReactNode;
  canCreate?: boolean;
  canDelete?: (row: FieldArray<TValues, TName>) => boolean;
  rowReadOnly?: (row: FieldArray<TValues, TName>) => boolean;
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
  /** Sub-lines of a row (nested documents): rendered inline under the expanded row. */
  expand?: { label: (row: FieldArray<TValues, TName>) => string; render: (context: One2manyRowContext<TValues, TName>) => ReactNode };
};

const alignments = { left: "text-left", right: "text-right", center: "text-center" };

function One2manyContent<TValues extends FieldValues, TName extends FieldArrayPath<TValues> = FieldArrayPath<TValues>>({
  name, label, direction: requestedDirection = "block", columns, createRow, onChange, minRows = 0, maxRows = 100, required,
  canCreate = true, canDelete, rowReadOnly, disabled = false, readOnly = false, reorderable = false, addLabel = "Agregar línea", emptyText = "Todavía no hay líneas.", footer,
  id, className = "", "aria-label": ariaLabel, expand,
}: FieldOne2manyProps<TValues, TName> & { columns: readonly One2manyColumn<TValues,TName>[]; createRow: () => FieldArray<TValues,TName> }) {
  const direction = useFieldDirection(requestedDirection) ?? "block";
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
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set());
  const toggle = (key: string) => setExpanded(current => { const next = new Set(current); if (next.has(key)) next.delete(key); else next.add(key); return next; });
  const footerContent = typeof footer === "function" ? footer(rows) : footer;

  function canEdit() { return !locked && !root.current?.closest("fieldset:disabled"); }
  function add() {
    if (!canEdit() || !canCreate || getRows().length >= limits.maximum) return;
    append(structuredClone(createRow()), { shouldFocus: true });
  }
  function deleteRow(index: number) {
    if (!canEdit() || canDelete?.(getRows()[index]) === false || getRows().length <= limits.minimum) return;
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
      <fieldset disabled={locked} className="m-0 min-w-0 border-0 p-0">
        <table role="table" aria-label={accessibleLabel} className="table block! w-full @3xl/o2m:[display:table]! @3xl/o2m:table-fixed @3xl/o2m:[&_td_.input]:h-8 @3xl/o2m:[&_td_.input]:text-sm @3xl/o2m:[&_td_.select]:h-8 @3xl/o2m:[&_td_.select]:min-h-8 @3xl/o2m:[&_td_.select]:text-sm [&_td_.input]:border-transparent [&_td_.select]:border-transparent [&_td_.input:hover]:border-base-content/30 [&_td_.select:hover]:border-base-content/30 [&_td_.input:focus]:border-base-content [&_td_.input:focus-within]:border-base-content [&_td_.select:focus]:border-base-content [&_td_.input[aria-invalid=true]]:border-error [&_td_.select[aria-invalid=true]]:border-error">
          <thead role="rowgroup" className="sr-only @3xl/o2m:not-sr-only @3xl/o2m:table-header-group"><tr role="row" className="text-xs text-base-content/50">
            <th scope="col" role="columnheader" className="w-10 px-2 py-2"><span className="sr-only">Línea</span>#</th>
            {columns.map(column => <th key={column.key} scope="col" role="columnheader" style={{ width: column.width }} className={`px-3 py-2 font-medium ${alignments[column.align ?? "left"]}`}>{column.label}</th>)}
            {!readOnly && <th scope="col" role="columnheader" className={reorderable ? "w-28 px-2" : "w-11 px-2"}><span className="sr-only">Acciones de línea</span></th>}
          </tr></thead>
          <tbody role="rowgroup" className="block space-y-3 p-3 @3xl/o2m:table-row-group @3xl/o2m:space-y-0 @3xl/o2m:p-0">
            {fields.map((field, index) => {
              // field.id is only a render key. Business IDs always come from RHF values.
              const row = rows[index] ?? getRows()[index];
              const context: One2manyRowContext<TValues, TName> = { index, row, fieldName: key => `${name}.${index}.${key}` as FieldPath<TValues>, readOnly: readOnly || rowReadOnly?.(row) === true, disabled: disabled || formState.disabled };
              // Rows with errors in their sub-lines open by themselves so the error is visible.
              const nestedError = Boolean(expand) && errorPaths.some(path => path.startsWith(`${name}.${index}.`) && path.split(".").length > `${name}.${index}.x`.split(".").length);
              const open = Boolean(expand) && (expanded.has(field.id) || nestedError);
              const subId = `${inputId}-row-${index}-lines`;
              return <Fragment key={field.id}><tr role="row" data-one2many-row={index} className="block rounded-xl border border-base-300 bg-base-200/15 p-3 @3xl/o2m:table-row @3xl/o2m:rounded-none @3xl/o2m:border-x-0 @3xl/o2m:border-t-0 @3xl/o2m:bg-transparent @3xl/o2m:p-0 @3xl/o2m:hover:bg-primary/3">
                <td role="cell" className="mb-2 block px-0 py-1 align-middle text-xs font-semibold text-base-content/40 @3xl/o2m:table-cell @3xl/o2m:px-2 @3xl/o2m:py-0.5 @3xl/o2m:text-center"><span className="@3xl/o2m:hidden">Línea </span>{index + 1}{errorPaths.some(path => path.startsWith(`${name}.${index}.`) || path === `${name}.${index}`) && <span className="ml-1 text-error" aria-label={`Línea ${index + 1} con errores`}>•</span>}
                  {expand && <button type="button" className="btn btn-ghost btn-xs ml-1 px-1 text-base-content/60" aria-expanded={open} aria-controls={subId} aria-label={`${open ? "Ocultar" : "Mostrar"} ${expand.label(row)} de la línea ${index + 1}`} onClick={() => toggle(field.id)}>{open ? <ChevronDown size={14} aria-hidden="true" /> : <ChevronRight size={14} aria-hidden="true" />}</button>}</td>
                {columns.map(column => <td role="cell" key={column.key} className={`block min-w-0 px-0 py-2 align-middle @3xl/o2m:table-cell @3xl/o2m:px-3 @3xl/o2m:py-0.5 ${alignments[column.align ?? "left"]}`}>
                  <span aria-hidden="true" className="mb-1 block text-left text-xs font-medium text-base-content/55 @3xl/o2m:hidden">{column.label}</span>
                  <fieldset disabled={context.readOnly} className="m-0 min-w-0 border-0 p-0">{column.render(context)}</fieldset>
                </td>)}
                {!readOnly && <td role="cell" className="mt-2 block border-t border-base-300 px-0 pt-2 align-middle @3xl/o2m:table-cell @3xl/o2m:border-t-0 @3xl/o2m:px-2 @3xl/o2m:py-0.5">
                  <div className="flex items-center justify-end gap-0.5">
                    {reorderable && <><button type="button" disabled={locked || index === 0} className="btn btn-square btn-ghost btn-xs text-base-content/45" aria-label={`Subir línea ${index + 1}`} onClick={() => moveRow(index, index - 1)}><ArrowUp size={14} aria-hidden="true" /></button><button type="button" disabled={locked || index === fields.length - 1} className="btn btn-square btn-ghost btn-xs text-base-content/45" aria-label={`Bajar línea ${index + 1}`} onClick={() => moveRow(index, index + 1)}><ArrowDown size={14} aria-hidden="true" /></button></>}
                    <button type="button" disabled={locked || canDelete?.(row) === false || fields.length <= limits.minimum} className="btn btn-square btn-ghost btn-xs text-base-content/40 hover:bg-error/10 hover:text-error" aria-label={`Quitar línea ${index + 1}`} onClick={() => deleteRow(index)}><Trash2 size={15} aria-hidden="true" /></button>
                  </div>
                </td>}
              </tr>
              {expand && <tr role="row" id={subId} hidden={!open} className={open ? "block @3xl/o2m:table-row" : "hidden!"}>
                {/* Kept mounted while hidden: RHF values and validation of sub-lines stay registered. */}
                <td role="cell" colSpan={columns.length + (readOnly ? 1 : 2)} className="block px-0 pb-3 pt-1 @3xl/o2m:table-cell @3xl/o2m:pl-10 @3xl/o2m:pr-3">{expand.render(context)}</td>
              </tr>}
              </Fragment>;
            })}
            {!fields.length && <tr role="row" className="block @3xl/o2m:table-row"><td role="cell" colSpan={columns.length + (readOnly ? 1 : 2)} className="block px-4 py-8 text-center text-sm text-base-content/45 @3xl/o2m:table-cell">{emptyText}</td></tr>}
          </tbody>
        </table>
      </fieldset>
      {(!readOnly && canCreate || errorMessage || footerContent || fields.length >= limits.maximum) && <footer className="space-y-2 rounded-b-xl border-t border-base-300 bg-base-200/25 px-3 py-3">
        {!readOnly && canCreate && <button type="button" disabled={locked || fields.length >= limits.maximum} className="btn btn-primary btn-soft btn-sm gap-1.5" onClick={add}><Plus size={15} aria-hidden="true" />{addLabel}</button>}
        {errorMessage && <p id={`${inputId}-error`} className="text-xs text-error">{errorMessage}</p>}
        {fields.length >= limits.maximum && <p className="text-xs text-base-content/50">Máximo de {limits.maximum} líneas alcanzado.</p>}
        {footerContent}
      </footer>}
    </div>
  </div>;
}


export type One2manyCellContext = {
  index: number; row: Record<string, unknown>; fieldName: (field: string) => string; readOnly: boolean; disabled: boolean;
};
type ColumnDeclaration = {
  name: string; label?: string; width?: string; align?: "left" | "center" | "right";
  widget?: "text" | "long" | "password" | "email" | "phone" | "image" | "avatar" | "statebar";
  render?: (context: One2manyCellContext) => ReactNode;
};
// Stable across Fast Refresh: JSX may briefly retain the previous function identity.
const columnTag = Symbol.for("lite-erp.form.one2many-column");
const LineColumn = Object.assign(function LineColumn(props: ColumnDeclaration): null { void props; return null; }, { [columnTag]: true });
function renderField(field: FieldMetadata, column: ColumnDeclaration, context: One2manyCellContext) {
  const props = { ...(context.readOnly ? { readOnly: true } : {}), name: context.fieldName(column.name), label: "", "aria-label": `${column.label ?? field.label ?? column.name}, línea ${context.index + 1}` };
  if (column.render) return column.render(context);
  switch (field.kind) {
    case "text": return <FieldText {...props} widget={column.widget as "text" | "long" | "password" | "email" | "phone" | undefined} />;
    case "integer": return <FieldNumber {...props} type="integer" />;
    case "datetime": return <FieldDate {...props} type="datetime" />;
    case "boolean": return <FieldBoolean {...props} />;
    case "selection": return <FieldSelect {...props} widget={column.widget as "statebar" | undefined} />;
    case "many2one": return <FieldMany2One {...props} />;
    case "image": return <FieldImage {...props} widget={column.widget as "image" | "avatar" | undefined} />;
  }
}

/** Existing explicit columns/createRow remain supported; declarations use the model contract. */
function FieldOne2many<TValues extends FieldValues = FieldValues, TName extends FieldArrayPath<TValues> = FieldArrayPath<TValues>>(props: FieldOne2manyProps<TValues, TName>) {
  const model = useContext(FormModelContext);
  const line = lineAt(model, props.name);
  let columns = props.columns, createRow = props.createRow;
  if (props.children !== undefined || (!columns && line)) {
    if (!line || columns || createRow) throw new Error("One2many.Column requiere una relación publicada; usa children o columns/createRow, no ambos.");
    const declarations: ColumnDeclaration[] = [];
    const visit = (nodes: ReactNode) => Children.forEach(nodes, node => {
      if (node == null || typeof node === "boolean") return;
      if (isValidElement<{ children?: ReactNode }>(node) && node.type === Fragment) { visit(node.props.children); return; }
      if (!isValidElement<ColumnDeclaration>(node) || typeof node.type !== "function" || Reflect.get(node.type, columnTag) !== true) throw new Error("Sólo se aceptan hijos FieldOne2many.Column.");
      declarations.push(node.props);
    });
    if (props.children === undefined) declarations.push(...Object.keys(line.fields).map(name => ({ name })));
    else visit(props.children);
    if (!declarations.length || declarations.length > 12 || new Set(declarations.map(item => item.name)).size !== declarations.length) throw new Error("Declara entre 1 y 12 columnas de líneas, sin duplicados.");
    columns = declarations.map(column => {
      const field = line.fields[column.name]?.metadata;
      if (!field || field.sensitive) throw new Error(`Columna de línea no publicada: ${column.name}.`);
      const widgets = field.kind === "text" ? ["text", "long", "password", "email", "phone"] : field.kind === "image" ? ["image", "avatar"] : field.kind === "selection" ? ["statebar"] : [];
      if (column.widget && !widgets.includes(column.widget)) throw new Error(`Widget incompatible en ${column.name}.`);
      return { key: column.name, label: column.label ?? field.label ?? column.name, width: column.width, align: column.align, render: context => renderField(field, column, { ...context, row: context.row as Record<string, unknown>, fieldName: name => context.fieldName(name as never) }) };
    });
    createRow = line.createRow as () => FieldArray<TValues, TName>;
  }
  if (!columns || !createRow) throw new Error("One2many requiere columnas y createRow, o una relación declarada en el modelo.");
  if (line && props.reorderable) throw new Error("One2many declarativo aún no persiste orden manual.");
  const { invisible, children: _children, ...controlProps } = props;
  void _children;
  const capabilities = line?.capabilities;
  const noWrites = capabilities && !capabilities.create && !capabilities.write && !capabilities.unlink;
  const persisted = (row: FieldArray<TValues, TName>) => Boolean((row as { id?: string }).id);
  return <FieldVisibility name={props.name} invisible={invisible ?? line?.invisible}>
    <Suspense fallback={<div role="status" className="col-span-full min-w-0 rounded-xl border border-base-300 bg-base-200/30 p-5 text-sm text-base-content/50">Cargando líneas…</div>}>
      <One2manyContent {...controlProps}
        label={props.label ?? line?.label}
        minRows={line?.minRows ?? props.minRows} maxRows={line?.maxRows ?? props.maxRows}
        readOnly={props.readOnly || Boolean(line && !capabilities?.read) || Boolean(noWrites)}
        canCreate={props.canCreate !== false && (!capabilities || capabilities.read && capabilities.create)}
        canDelete={row => (!capabilities || !persisted(row) || capabilities.unlink) && props.canDelete?.(row) !== false}
        rowReadOnly={row => props.rowReadOnly?.(row) === true || Boolean(capabilities && (!capabilities.read || (persisted(row) ? !capabilities.write : !capabilities.create)))}
        columns={columns} createRow={createRow}
        {...(line?.lines && Object.keys(line.lines).length && !props.expand ? { expand: {
          label: (row: FieldArray<TValues, TName>) => Object.entries(line.lines!).map(([sub, child]) => `${child.label ?? sub} (${Array.isArray((row as Record<string, unknown>)[sub]) ? ((row as Record<string, unknown>)[sub] as unknown[]).length : 0})`).join(", "),
          render: (context: One2manyRowContext<TValues, TName>) => <div className="space-y-2">{Object.keys(line.lines!).map(sub => <FieldOne2many key={sub} name={`${props.name}.${context.index}.${sub}` as never} readOnly={context.readOnly || undefined} />)}</div>,
        } } : {})}
      />
    </Suspense>
  </FieldVisibility>;
}
export default Object.assign(FieldOne2many, { Column: LineColumn });
