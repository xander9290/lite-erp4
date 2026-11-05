"use client";

import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { FileText, X } from "lucide-react";
import { readListValue, type ListColumn, type ListRecord } from "@/lib/list/types";
import { formatListValue } from "./listFormat";
import ListCellValue from "./ListCellValue";

export default function ListRecordPreview({ record, columns, onClose, onAfterClose }: {
  record: ListRecord; columns: readonly ListColumn[]; onClose: () => void; onAfterClose: () => void;
}) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const title = formatListValue(readListValue(record, columns[0].field), columns[0]);
  useEffect(() => {
    const dialog = dialogRef.current;
    dialog?.showModal(); titleRef.current?.focus();
    return () => { dialog?.close(); onAfterClose(); };
  }, [onAfterClose]);
  return createPortal(<dialog ref={dialogRef} className="modal modal-middle p-2 sm:p-5" aria-labelledby={titleId}
    onCancel={event => { event.preventDefault(); onClose(); }} onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="modal-box w-full max-w-xl space-y-5 p-4 sm:p-6">
      <header className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3"><span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><FileText size={20} aria-hidden="true" /></span><div className="min-w-0"><p className="text-xs text-base-content/50">Vista rápida · Solo lectura</p><h2 ref={titleRef} id={titleId} tabIndex={-1} className="text-lg font-semibold wrap-anywhere outline-none">{title}</h2></div></div>
        <button type="button" className="btn btn-circle btn-ghost btn-sm shrink-0" aria-label="Cerrar registro" onClick={onClose}><X size={18} aria-hidden="true" /></button>
      </header>
      <dl className="divide-y divide-base-300 rounded-xl bg-base-200/50 px-4">{columns.map(column => <div key={column.field} className="grid grid-cols-1 gap-1 py-3 sm:grid-cols-[1fr_2fr] sm:gap-4"><dt className="text-xs font-medium text-base-content/55">{column.label}</dt><dd className="text-sm wrap-anywhere"><ListCellValue record={record} column={column} /></dd></div>)}</dl>
      <div className="flex justify-end"><button type="button" className="btn btn-soft btn-sm" onClick={onClose}>Volver a la lista</button></div>
    </div>
  </dialog>, document.body);
}
