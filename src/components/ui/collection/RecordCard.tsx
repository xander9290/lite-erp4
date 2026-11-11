import Link from "next/link";
import { ArrowUpRight, FileText } from "lucide-react";
import { listDisplayColumn, readListValue, type ListRecord } from "@/lib/list/types";
import ListCellValue from "../list/ListCellValue";
import { listRecordHref } from "../list/listFormat";
import { internalCollectionHref } from "./CollectionShell";
import type { CollectionProps } from "./types";

export function recordCardTitle(record: ListRecord, titleField: string) { return String(readListValue(record, titleField) ?? "Sin nombre"); }
export default function RecordCard({ record, model, titleField, subtitleField, columns, recordHref, currentUrl, renderCard }: Pick<CollectionProps, "model" | "titleField" | "subtitleField" | "columns" | "recordHref" | "renderCard"> & { record: ListRecord; currentUrl: string }) {
  const title = recordCardTitle(record, titleField);
  const imageColumn = columns.find(column => column.widget === "image" && column.field !== titleField && column.field !== subtitleField);
  const details = columns.filter(column => column.field !== titleField && column.field !== subtitleField && column.field !== imageColumn?.field).slice(0, 4);
  const href = internalCollectionHref(recordHref) ? listRecordHref(recordHref!, record.id, currentUrl) : null;
  return <>
    {renderCard ? renderCard(record) : <div className="space-y-2 p-3"><div className="flex items-center gap-3">{imageColumn ? <ListCellValue record={record} column={listDisplayColumn(model, imageColumn)} /> : <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/8 text-primary"><FileText size={18} aria-hidden="true" /></span>}<div className="min-w-0 flex-1"><h3 className="font-semibold leading-snug wrap-anywhere">{href ? <Link className="rounded-sm hover:text-primary hover:underline focus-visible:outline-2 focus-visible:outline-primary" href={href}>{title}</Link> : title}</h3>{subtitleField && <p className="mt-1 text-sm leading-relaxed text-base-content/60 wrap-anywhere">{String(readListValue(record, subtitleField) ?? "")}</p>}</div></div>
      {details.length > 0 && <dl className="space-y-1">{details.map(column => { const display = listDisplayColumn(model, column); const value = readListValue(record, column.field); const option = column.options?.find(option => option.value === value); return <div key={column.field} className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-sm"><dt className="text-base-content/50">{column.label}</dt><dd className="min-w-0 text-right font-medium wrap-anywhere">{option ? option.label : <ListCellValue record={record} column={display} />}</dd></div>; })}</dl>}
    </div>}
    {href && renderCard && <div className="mt-auto border-t border-base-200 px-3 py-2"><Link href={href} className="inline-flex items-center gap-1.5 rounded-sm text-xs font-medium text-base-content/55 hover:text-primary focus-visible:outline-2 focus-visible:outline-primary" aria-label={`Abrir ${title}`}>Abrir registro<ArrowUpRight size={14} aria-hidden="true" /></Link></div>}
  </>;
}
