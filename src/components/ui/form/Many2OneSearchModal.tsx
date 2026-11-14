"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronLeft, ChevronRight, Search, X } from "lucide-react";
import { readLookupPath, type Many2OneOption, type Many2OneRequest } from "@/lib/many2one/types";
import { useMany2OneSearch } from "./useMany2OneSearch";
import { toggleRelationTag } from "./relationTagValues";

import type { Many2OneLoader } from "@/lib/many2one/model-lookup";
import { useFieldInvisible } from "./FieldVisibility";

export type Many2OneColumn = { field: string; label: string };

type SearchModalProps = {
  title: string;
  request: Many2OneRequest;
  load?: Many2OneLoader;
  initialQuery: string;
  columns?: readonly Many2OneColumn[];
  onClose: () => void;
  onAfterClose: () => void;
} & (
  | { multiple?: false; selectedId: string | null; onSelect: (option: Many2OneOption) => void }
  | { multiple: true; selectedOptions: readonly Many2OneOption[]; maxSelected: number; onConfirm: (options: Many2OneOption[]) => void }
);

export default function Many2OneSearchModal(props: SearchModalProps) {
  const invisible = useFieldInvisible();
  return invisible ? null : <VisibleSearchModal {...props} />;
}

function VisibleSearchModal(props: SearchModalProps) {
  const { title, request, initialQuery, columns = [], onClose, onAfterClose } = props;
  const titleId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState(initialQuery);
  const [page, setPage] = useState(1);
  const [draft, setDraft] = useState<Many2OneOption[]>(() => props.multiple ? [...props.selectedOptions] : []);
  const { data, error, loading, retry } = useMany2OneSearch({ ...request, query, page }, true, 250, props.load);
  const currentPage = data?.page ?? page;
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : currentPage;
  const atLimit = Boolean(props.multiple && draft.length >= props.maxSelected);

  function select(option: Many2OneOption) {
    if (props.multiple) setDraft(current => toggleRelationTag(current, option, props.maxSelected));
    else props.onSelect(option);
  }

  function isSelected(option: Many2OneOption) {
    return props.multiple ? draft.some(current => current.value === option.value) : option.value === props.selectedId;
  }

  useEffect(() => {
    const dialog = dialogRef.current;
    dialog?.showModal();
    searchRef.current?.focus();
    return () => { dialog?.close(); onAfterClose(); };
  }, [onAfterClose]);

  return createPortal(
    <dialog ref={dialogRef} className="modal modal-middle p-2 sm:p-5" aria-labelledby={titleId}
      onCancel={event => { event.preventDefault(); onClose(); }}
      onClick={event => { if (event.target === event.currentTarget) onClose(); }}
      onKeyDown={event => event.stopPropagation()}>
      <div className="modal-box flex max-h-[calc(100dvh-2rem)] w-full max-w-3xl flex-col gap-5 overflow-hidden p-4 sm:p-6">
        <header className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Search size={21} aria-hidden="true" /></span>
            <div className="min-w-0"><p className="text-xs font-medium tracking-wide text-base-content/50">{props.multiple ? "Selección múltiple" : "Seleccionar registro"}</p><h2 id={titleId} className="truncate text-xl font-semibold">{title}</h2></div>
          </div>
          <button type="button" className="btn btn-circle btn-ghost btn-sm shrink-0" aria-label="Cerrar búsqueda" onClick={onClose}><X size={18} aria-hidden="true" /></button>
        </header>

        <label className="input w-full shrink-0 gap-2 rounded-xl border-base-content/15 bg-base-200/50 focus-within:border-base-content/50 focus-within:outline-none">
          <Search size={17} className="shrink-0 text-base-content/45" aria-hidden="true" />
          <input ref={searchRef} value={query} maxLength={120} autoComplete="off" aria-label={`Buscar ${title}`} placeholder="Escribe para buscar…"
            onChange={event => { setQuery(event.currentTarget.value); setPage(1); }} />
          {query && <button type="button" className="btn btn-circle btn-ghost btn-xs" aria-label="Limpiar búsqueda" onClick={() => { setQuery(""); setPage(1); searchRef.current?.focus(); }}><X size={14} aria-hidden="true" /></button>}
        </label>

        {props.multiple && <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="badge badge-soft badge-primary">{draft.length} seleccionado{draft.length === 1 ? "" : "s"}</span>
          <span className="text-base-content/55">{atLimit ? `Límite de ${props.maxSelected} registros` : "Marca registros en una o varias páginas"}</span>
        </div>}

        <div className="min-h-44 min-w-0 overflow-auto rounded-xl border border-base-300" aria-busy={loading}>
          {error ? <div role="alert" className="flex min-h-44 flex-col items-center justify-center gap-3 p-5 text-center text-sm"><p>{error}</p><button type="button" className="btn btn-sm btn-soft" onClick={retry}>Reintentar</button></div> : (
            <table className="table table-sm w-full">
              <caption className="sr-only">Resultados de búsqueda: {title}</caption>
              <thead className="sticky top-0 bg-base-200 text-base-content/60"><tr><th className="px-4 py-3 font-medium">Registro</th>{columns.map(column => <th key={column.field} className="hidden font-medium sm:table-cell">{column.label}</th>)}<th className="w-10"><span className="sr-only">Seleccionado</span></th></tr></thead>
              <tbody>
                {loading ? Array.from({ length: 4 }, (_, index) => <tr key={index} aria-hidden="true"><td colSpan={columns.length + 2} className="px-4 py-4"><div className="skeleton h-4 w-2/3 motion-reduce:animate-none" /></td></tr>) : data?.items.length ? data.items.map(option => (
                  <tr key={option.value} className={`cursor-pointer transition-colors hover:bg-primary/5 ${isSelected(option) ? "bg-primary/5" : ""}`} onClick={() => select(option)}>
                    <td className="max-w-xs px-4 py-0">{props.multiple ? (
                      <div className="flex items-center gap-3 py-4"><input type="checkbox" autoComplete="off" className="checkbox checkbox-primary checkbox-sm shrink-0" checked={isSelected(option)} disabled={atLimit && !isSelected(option)} aria-label={`Seleccionar ${option.label}`} onClick={event => event.stopPropagation()} onChange={() => select(option)} /><span className="min-w-0 text-sm font-medium whitespace-normal wrap-anywhere">{option.label}</span></div>
                    ) : <button type="button" className="w-full py-4 text-left text-sm font-medium whitespace-normal wrap-anywhere focus-visible:outline-2 focus-visible:outline-primary" aria-label={`Seleccionar ${option.label}`}>{option.label}</button>}</td>
                    {columns.map(column => <td key={column.field} className="hidden max-w-48 whitespace-normal wrap-anywhere text-base-content/60 sm:table-cell">{readLookupPath(option.record, column.field) || "—"}</td>)}
                    <td>{isSelected(option) && <Check size={17} className="text-primary" aria-label="Seleccionado" />}</td>
                  </tr>
                )) : <tr><td colSpan={columns.length + 2} className="p-8 text-center"><Search size={25} className="mx-auto mb-3 text-base-content/25" aria-hidden="true" /><p className="font-medium">Sin coincidencias</p><p className="mt-1 text-xs text-base-content/55">Prueba con otro término o limpia la búsqueda.</p></td></tr>}
              </tbody>
            </table>
          )}
        </div>

        <footer className="flex shrink-0 flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-base-content/55" role="status">{loading ? "Buscando registros…" : data ? `${data.total} registro${data.total === 1 ? "" : "s"} · Página ${currentPage} de ${pages}` : "Búsqueda no disponible"}</p>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>Cancelar</button>
            <div className="join">
              <button type="button" className="btn btn-sm join-item" aria-label="Página anterior" disabled={loading || !data || currentPage <= 1} onClick={() => setPage(currentPage - 1)}><ChevronLeft size={16} aria-hidden="true" /></button>
              <button type="button" className="btn btn-sm join-item" aria-label="Página siguiente" disabled={loading || !data || currentPage >= pages} onClick={() => setPage(currentPage + 1)}><ChevronRight size={16} aria-hidden="true" /></button>
            </div>
            {props.multiple && <button type="button" className="btn btn-primary btn-sm" disabled={draft.length > props.maxSelected} onClick={() => props.onConfirm(draft)}>Aplicar selección{draft.length > 0 ? ` (${draft.length})` : ""}</button>}
          </div>
        </footer>
      </div>
    </dialog>, document.body,
  );
}
