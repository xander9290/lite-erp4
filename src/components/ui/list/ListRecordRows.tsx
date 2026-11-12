"use client";
import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import type { ListColumn, ListPage, ListRecord } from "@/lib/list/types";
import { readListDisplayValue, recordDisplayName } from "@/lib/list/types";
import { formatListValue, listRecordHref, columnAlignment } from "./listFormat";
import ListCellValue from "./ListCellValue";
import SelectionCheckbox from "./SelectionCheckbox";
const alignmentClasses = { left: "text-left", center: "text-center", right: "text-right" };
export default function ListRecordRows({ data, displayColumns, selectedIds, busy, recordHref, currentUrl, renderCell, openRecord, toggle }: {
  data: ListPage; displayColumns: readonly ListColumn[]; selectedIds: readonly string[]; busy: boolean;
  recordHref?: string; currentUrl: string; renderCell?: (record: ListRecord, column: ListColumn) => ReactNode;
  openRecord: (record: ListRecord, element: HTMLElement) => void; toggle: (id: string) => void;
}) {
  const canNavigate = Boolean(recordHref && /^\/(?![\/\\])/.test(recordHref));
  return <>{data.rows.map(record => {
              const titleColumn = displayColumns.find(column => column.widget !== "image");
              const fieldTitle = titleColumn ? formatListValue(readListDisplayValue(record, titleColumn), titleColumn) : record.id;
              const recordTitle = titleColumn?.displayName === false ? fieldTitle : recordDisplayName(record, fieldTitle);
              const href = canNavigate ? listRecordHref(recordHref!, record.id, currentUrl) : "";
              return <tr key={record.id} aria-selected={selectedIds.includes(record.id)} className={`transition-colors hover:bg-primary/5 ${selectedIds.includes(record.id) ? "bg-primary/5" : ""}`}>
                <td className="px-4 py-2"><SelectionCheckbox label={`Seleccionar ${recordTitle}`} checked={selectedIds.includes(record.id)} disabled={busy}
                  onChange={() => toggle(record.id)} /></td>
                {displayColumns.map((column, index) => {
                  const text = renderCell?.(record, column) ?? <ListCellValue record={record} column={column} />;
                  return <td key={column.field} className={`max-w-sm ${column.widget === "partner" ? "min-w-48" : ""} px-4 py-2 whitespace-normal wrap-anywhere ${alignmentClasses[columnAlignment(column)]} ${index === 0 ? "font-medium text-base-content" : "text-base-content/65"}`}>
                    {index === 0 || column.widget === "partner" || column.widget === "image" ? canNavigate ? <Link href={href} className="inline-block max-w-full rounded-sm text-left hover:text-primary hover:underline focus-visible:outline-2 focus-visible:outline-primary">{text}</Link> : <button type="button" className="max-w-full cursor-pointer rounded-sm text-left hover:text-primary hover:underline focus-visible:outline-2 focus-visible:outline-primary" onClick={event => openRecord(record, event.currentTarget)}>{text}</button> : text}
                  </td>;
                })}
                <td className="px-3 py-2">{canNavigate ? <Link href={href} className="btn btn-circle btn-ghost btn-xs" aria-label={`Abrir ${recordTitle}`}><ChevronRight size={17} aria-hidden="true" /></Link> : <button type="button" className="btn btn-circle btn-ghost btn-xs" aria-label={`Ver ${recordTitle}`} onClick={event => openRecord(record, event.currentTarget)}><ChevronRight size={17} aria-hidden="true" /></button>}</td>
              </tr>;
            })}</>;
}
