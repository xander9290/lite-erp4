"use client";

import Link from "next/link";
import { useCallback, useId, useRef, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, CircleAlert, Inbox, Plus, RefreshCw, Search, X } from "lucide-react";
import { listColumnType, listDisplayColumn, listModels, type ListColumn, type ListConfig, type ListModel, type ListRecord, type ListResult, type ListState } from "@/lib/list/types";
import { columnAlignment, visibleListPages } from "./listFormat";
import { useListView } from "./useListView";
import ListRecordPreview from "./ListRecordPreview";
import ColumnFilter from "./ColumnFilter";
import ListRecordRows from "./ListRecordRows";
import ListGroupRows from "./ListGroupRows";
import ListGroupingControls from "./ListGroupingControls";
import { filterDescription } from "./filterInputs";
import ListBreadcrumbs, { type ListBreadcrumb } from "./ListBreadcrumbs";
import { deleteRecords } from "@/lib/list/actions";
import { listDeleteSelectionSchema, type ListDeleteResult, type ListDeleteTarget } from "@/lib/list/selection";
import { emptyListSelection, selectedPageIds, togglePageRecord, toggleWholePage } from "./listSelection";
import SelectionCheckbox from "./SelectionCheckbox";
import { useListDeletion } from "./useListDeletion";
import ListViewActionMenu from "./ListViewActionMenu";

export type ListViewProps = ({ model: ListModel; load?: never } | { model: string; load: (state: ListState) => Promise<ListResult> }) & {
  title: string;
  columns: readonly ListColumn[];
  searchFields?: readonly string[];
  /** Compatibility metadata; the compact header does not render this summary. */
  description?: string;
  /** Compatibility metadata; the compact header has no application icon. */
  icon?: ReactNode;
  breadcrumbs?: readonly ListBreadcrumb[];
  pageSize?: number;
  defaultSort?: ListConfig["defaultSort"];
  paramPrefix?: string;
  createHref?: string;
  create?: boolean;
  delete?: boolean;
  onDelete?: (selection: readonly ListDeleteTarget[]) => Promise<ListDeleteResult>;
  createLabel?: string;
  recordHref?: string;
  headerActions?: ReactNode;
  footer?: ReactNode;
  className?: string;
  /** Client-side presentation only; never part of the query configuration sent to the server. */
  renderCell?: (record: ListRecord, column: ListColumn) => ReactNode;
};

function internalHref(href?: string) { return Boolean(href && /^\/(?![\/\\])/.test(href)); }
const alignmentClasses = { left: "text-left", center: "text-center", right: "text-right" };

export default function ListViewClient({
  model, load, title, columns, searchFields = Object.hasOwn(listModels, model) ? listModels[model as ListModel].searchFields : [],
  pageSize = 25, defaultSort, paramPrefix = "",
  createHref, create = true, delete: deleteEnabled = true, onDelete, createLabel = "Nuevo", recordHref, breadcrumbs, headerActions, footer, className = "", renderCell,
}: ListViewProps) {
  const titleId = useId();
  const config = { model, columns, searchFields, defaultSort };
  const list = useListView(config, pageSize, paramPrefix, load);
  const { state, data, loading, error } = list;
  const [selection, setSelection] = useState(emptyListSelection);
  const selectedIds = selectedPageIds(selection, data);
  const selectedRows = data?.rows.filter(row => selectedIds.includes(row.id)) ?? [];
  const parsedSelection = listDeleteSelectionSchema.safeParse(selectedRows.map(row => ({ id: row.id, revision: row.revision })));
  const deletion = useListDeletion(data);
  const deleteAction = onDelete ?? (!load && Object.hasOwn(listModels, model) ? (targets: readonly ListDeleteTarget[]) => deleteRecords(model as ListModel, targets) : undefined);
  const [preview, setPreview] = useState<{ model: string; record: ListRecord } | null>(null);
  const trigger = useRef<HTMLElement | null>(null);
  const restoreFocus = useCallback(() => { trigger.current?.focus({ preventScroll: true }); }, []);
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const page = data?.page ?? state.page;
  const first = data?.total ? (page - 1) * data.pageSize + 1 : 0;
  const last = data ? Math.min(page * data.pageSize, data.total) : 0;
  const sizes = [...new Set([10, 25, 50, state.pageSize])].sort((a, b) => a - b);
  const canCreate = create && internalHref(createHref);
  const filterCount = state.filters.length + (state.query ? 1 : 0) + (state.invalidFilters ? 1 : 0);
  const displayColumns = columns.map(column => listDisplayColumn(model, column));

  function openRecord(record: ListRecord, element: HTMLElement) {
    trigger.current = element;
    setPreview({ model, record });
  }

  return <section aria-labelledby={titleId} className={`card flex w-full min-h-0 min-w-0 flex-1 flex-col rounded-2xl border border-base-300 bg-base-100 shadow-sm ${className}`}>
    <h2 id={titleId} className="sr-only">{title}</h2>
    <header data-slot="header" className="flex shrink-0 flex-wrap items-center justify-between gap-3 rounded-t-2xl border-b border-base-300 bg-linear-to-r from-primary/5 to-transparent px-4 py-3 sm:px-6">
      {!!breadcrumbs?.length && <div className="min-w-0 flex-1 basis-48"><ListBreadcrumbs items={breadcrumbs} /></div>}
      <div className="ml-auto flex min-w-0 flex-wrap items-center gap-2">
        {selectedIds.length > 0 && <span role="status" className="badge badge-soft badge-primary badge-sm tabular-nums">{selectedIds.length} seleccionado{selectedIds.length === 1 ? "" : "s"} en esta página</span>}
        {selectedIds.length > 0 && <button type="button" className="btn btn-ghost btn-sm" disabled={deletion.busy} onClick={() => setSelection(emptyListSelection)}>Deseleccionar</button>}
        {state.query && <span className="badge badge-soft badge-sm">Búsqueda: {state.query}</span>}
        {filterCount > 0 && <button type="button" className="btn btn-ghost btn-sm gap-1.5 text-primary" onClick={list.clearFilters} aria-label="Limpiar filtros"><X size={14} aria-hidden="true" />{filterCount} filtro{filterCount === 1 ? "" : "s"}</button>}
        {(load || !!state.groupBy?.length) && <ListGroupingControls columns={load ? columns : []} fields={state.groupBy ?? []} onChange={groupBy => list.update({ groupBy })} />}
        {headerActions}
        {deleteEnabled && selectedIds.length > 0 && <ListViewActionMenu disabled={loading || deletion.busy}
          deleteDisabled={!deleteAction || !parsedSelection.success} deleteUnavailable={!deleteAction}
          onDelete={() => { if (deleteAction && parsedSelection.success) void deletion.run(parsedSelection.data, deleteAction, list.refresh); }} />}
        <button type="button" className="btn btn-ghost btn-sm gap-2" disabled={loading || deletion.busy} onClick={list.refresh} aria-label={`Actualizar ${title}`}><RefreshCw size={15} className={loading ? "animate-spin motion-reduce:animate-none" : ""} aria-hidden="true" /><span>Actualizar</span></button>
        {canCreate && <Link href={createHref!} className="btn btn-primary btn-sm gap-1.5"><Plus size={16} aria-hidden="true" />{createLabel}</Link>}
      </div>
    </header>

    <div data-slot="body" className="flex min-h-0 min-w-0 flex-1 flex-col p-0">
      <div role="region" aria-label={`Tabla de ${title}`} tabIndex={0} aria-busy={loading} className="@container/list-table min-h-0 min-w-0 flex-1 overflow-auto focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary">
        <table className="table table-sm w-full min-w-[30rem]">
          <caption className="sr-only">Listado de {title}</caption>
          <thead className="bg-base-200/70 text-base-content/60"><tr>
            <th scope="col" className="w-12 px-4 py-3"><SelectionCheckbox label="Seleccionar todos los registros de esta página" checked={Boolean(data?.rows.length && selectedIds.length === data.rows.length)}
              mixed={selectedIds.length > 0 && selectedIds.length < (data?.rows.length ?? 0)} disabled={loading || deletion.busy || !data?.rows.length}
              onChange={() => { if (data) setSelection(current => toggleWholePage(current, data)); }} /></th>
            {columns.map(column => {
              const align = columnAlignment(column);
              const current = state.sort === column.field;
              const SortIcon = current ? state.direction === "asc" ? ArrowUp : ArrowDown : ArrowUpDown;
              const activeFilter = state.filters.find(filter => filter.field === column.field);
              const description = activeFilter ? filterDescription(listColumnType(model, column), activeFilter) : "";
              return <th key={column.field} scope="col" aria-sort={column.sortable ? current ? state.direction === "asc" ? "ascending" : "descending" : "none" : undefined} className={`px-4 py-3 font-medium ${alignmentClasses[align]}`}>
                <div className={`flex items-center gap-1 ${align === "right" ? "justify-end" : align === "center" ? "justify-center" : ""}`}>
                  {column.sortable ? <button type="button" className={`inline-flex cursor-pointer items-center gap-2 rounded-sm py-1 transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-primary ${current ? "text-base-content" : ""}`} aria-label={`Ordenar por ${column.label}`} onClick={() => list.update({ sort: column.field, direction: current && state.direction === "asc" ? "desc" : "asc" })}>{column.label}<SortIcon size={14} aria-hidden="true" /></button> : column.label}
                  {column.filterable !== false && <ColumnFilter field={column.field} label={column.label} type={listColumnType(model, column)} filter={activeFilter} onApply={filter => list.setFilter(column.field, filter)} />}
                </div>
                {activeFilter && <span className="mt-1 block max-w-48 truncate text-xs font-normal text-primary" title={description}>{description}</span>}
              </th>;
            })}
            <th scope="col" className="w-12 px-3"><span className="sr-only">Abrir registro</span></th>
          </tr></thead>
          <tbody>
            {loading ? [1, 2, 3].map(row => <tr key={row} aria-hidden="true"><td className="px-4"><div className="skeleton size-4 motion-reduce:animate-none" /></td>{columns.map(column => <td key={column.field} className="px-4 py-3"><div className="skeleton h-4 w-3/4 motion-reduce:animate-none" /></td>)}<td /></tr>) : error ? <tr><td colSpan={columns.length + 2}><div role="alert" className="sticky left-0 flex min-h-40 w-[calc(100cqw-1rem)] flex-col items-center justify-center gap-3 p-6 text-center"><CircleAlert size={28} className="text-base-content/40" aria-hidden="true" /><p className="max-w-sm text-sm text-base-content/70">{error}</p><button type="button" className="btn btn-soft btn-sm" onClick={list.refresh}>Reintentar</button></div></td></tr> : data?.groups ? <ListGroupRows key={JSON.stringify({ state, data })} data={data} state={state} load={load!} columns={displayColumns} recordHref={recordHref} currentUrl={list.currentUrl} renderCell={renderCell} openRecord={openRecord} deleteAction={deleteEnabled ? deleteAction : undefined} refresh={list.refresh} /> : !data?.rows.length ? <tr><td colSpan={columns.length + 2}><div className="sticky left-0 flex min-h-40 w-[calc(100cqw-1rem)] flex-col items-center justify-center gap-2 p-6 text-center"><span className="mb-1 flex size-12 items-center justify-center rounded-2xl bg-base-200 text-base-content/35">{filterCount ? <Search size={24} aria-hidden="true" /> : <Inbox size={24} aria-hidden="true" />}</span><p className="font-semibold">{filterCount ? "Sin coincidencias" : "Aún no hay registros"}</p><p className="max-w-sm text-sm text-base-content/55">{filterCount ? "Prueba con otros filtros o limpia la selección." : "Los registros aparecerán aquí cuando estén disponibles."}</p>{filterCount > 0 && <button type="button" className="btn btn-ghost btn-sm mt-1" onClick={list.clearFilters}>Quitar filtros</button>}</div></td></tr> : <ListRecordRows data={data} displayColumns={displayColumns} selectedIds={selectedIds} busy={deletion.busy} recordHref={recordHref} currentUrl={list.currentUrl} renderCell={renderCell} openRecord={openRecord} toggle={id => setSelection(current => togglePageRecord(current, data, id))} />}
          </tbody>
        </table>
      </div>

    </div>
      <footer data-slot="footer" className="shrink-0 space-y-3 rounded-b-2xl border-t border-base-300 bg-base-200/20 px-4 py-3 text-xs text-base-content/60 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <p role="status" className="tabular-nums">{loading ? "Cargando registros…" : error ? "Consulta no disponible" : data?.groups ? `${data.total.toLocaleString("es-MX")} registros · Página ${page} de grupos` : `${first.toLocaleString("es-MX")}–${last.toLocaleString("es-MX")} de ${(data?.total ?? 0).toLocaleString("es-MX")} registros`}</p>
          <label className="flex items-center gap-2"><span>Filas</span><select className="select select-sm w-19 rounded-lg border-base-300 bg-base-100" autoComplete="off" aria-label="Filas por página" value={state.pageSize} onChange={event => list.update({ pageSize: Number(event.currentTarget.value) })}>{sizes.map(size => <option key={size} value={size}>{size}</option>)}</select></label>
        </div>
        <nav aria-label={`Paginación de ${title}`} className="flex items-center gap-1">
          <button type="button" className="btn btn-ghost btn-sm btn-square" aria-label="Página anterior de la lista" disabled={loading || !data || page <= 1} onClick={() => list.update({ page: page - 1 })}><ChevronLeft size={17} aria-hidden="true" /></button>
          <span className="px-2 tabular-nums sm:hidden">{data ? data.groups ? `${page}` : `${page} / ${pages}` : "—"}</span>
          <div className="hidden items-center gap-1 sm:flex">{!data?.groups && visibleListPages(page, pages).map(number => <button key={number} type="button" className={`btn btn-sm min-w-8 px-2 ${number === page ? "btn-soft btn-primary" : "btn-ghost"}`} aria-label={`Ir a página ${number}`} aria-current={number === page ? "page" : undefined} disabled={loading || !data || number === page} onClick={() => list.update({ page: number })}>{number}</button>)}</div>
          <button type="button" className="btn btn-ghost btn-sm btn-square" aria-label="Página siguiente de la lista" disabled={loading || !data || (data?.groups ? !data.hasMoreGroups : page >= pages)} onClick={() => list.update({ page: page + 1 })}><ChevronRight size={17} aria-hidden="true" /></button>
        </nav>
        </div>
        {footer && <div className="border-t border-base-300 pt-3">{footer}</div>}
      </footer>
    {preview?.model === model && <ListRecordPreview record={preview.record} columns={displayColumns} onClose={() => setPreview(null)} onAfterClose={restoreFocus} />}
  </section>;
}
