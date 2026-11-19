import Link from "next/link";
import { ArrowUpRight, FileText } from "lucide-react";
import { listDisplayColumn, type ListRecord } from "@/lib/list/types";
import ListCellValue from "../list/ListCellValue";
import { listRecordHref } from "../list/listFormat";
import { internalCollectionHref } from "./CollectionShell";
import type { CollectionField, CollectionProps } from "./types";

import { recordCardTitle } from "./record-title";
export { recordCardTitle } from "./record-title";
const noZones: NonNullable<CollectionProps["cardInsertions"]> = {};

export default function RecordCard({ record, model, titleField, subtitleField, columns, recordHref, currentUrl, renderCard, cardInsertions: zones = noZones }: Pick<CollectionProps, "model" | "titleField" | "subtitleField" | "columns" | "recordHref" | "renderCard" | "cardInsertions"> & { record: ListRecord; currentUrl: string }) {
  const title = recordCardTitle(record, titleField, columns);
  const imageColumn = columns.find(column => column.widget === "image" && column.field !== titleField && column.field !== subtitleField);
  // Fields placed by extensions appear only where they were placed.
  const placed = new Set(Object.values(zones).flatMap(zone => zone ? [...zone.before, ...zone.inside, ...zone.after].map(column => column.field) : []));
  const details = columns.filter(column => column.field !== (titleField ?? "name") && column.field !== subtitleField && column.field !== imageColumn?.field && !placed.has(column.field)).slice(0, 4);
  const href = internalCollectionHref(recordHref) ? listRecordHref(recordHref!, record.id, currentUrl) : null;
  const row = (column: CollectionField) => <div key={column.field} className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-sm"><dt className="text-base-content/50">{column.label}</dt><dd className="min-w-0 text-right font-medium wrap-anywhere"><ListCellValue record={record} column={listDisplayColumn(model, column)} /></dd></div>;
  const rows = (list: readonly CollectionField[] = []) => list.length ? <dl className="space-y-1">{list.map(row)}</dl> : null;
  const zone = (name: "title" | "body" | "footer") => zones[name] ?? { before: [], inside: [], after: [] };
  const footer = [...zone("footer").before, ...zone("footer").inside, ...zone("footer").after];
  // With a custom card, inserted rows (all zones) follow its content.
  const extra = renderCard ? (["title", "body", "footer"] as const).flatMap(name => [...zone(name).before, ...zone(name).inside, ...zone(name).after]) : [];
  return <>
    {renderCard ? <>{renderCard(record)}{extra.length > 0 && <div className="px-3 pb-3">{rows(extra)}</div>}</> : <div className="space-y-2 p-3">{rows(zone("title").before)}<div className="flex items-center gap-3">{imageColumn ? <ListCellValue record={record} column={listDisplayColumn(model, imageColumn)} /> : <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/8 text-primary"><FileText size={18} aria-hidden="true" /></span>}<div className="min-w-0 flex-1"><h3 className="font-semibold leading-snug wrap-anywhere">{href ? <Link className="rounded-sm hover:text-primary hover:underline focus-visible:outline-2 focus-visible:outline-primary" href={href}>{title}</Link> : title}</h3>{subtitleField && <p className="mt-1 text-sm leading-relaxed text-base-content/60 wrap-anywhere">{recordCardTitle(record, subtitleField, columns)}</p>}{zone("title").inside.map(column => <p key={column.field} className="mt-1 text-sm leading-relaxed text-base-content/60 wrap-anywhere"><ListCellValue record={record} column={listDisplayColumn(model, column)} /></p>)}</div></div>
      {rows(zone("title").after)}{rows(zone("body").before)}
      {rows([...details, ...zone("body").inside])}
      {rows(zone("body").after)}
    </div>}
    {!renderCard && footer.length > 0 && <div className="mt-auto border-t border-base-200 px-3 py-2">{rows(footer)}</div>}
    {href && renderCard && <div className="mt-auto border-t border-base-200 px-3 py-2"><Link href={href} className="inline-flex items-center gap-1.5 rounded-sm text-xs font-medium text-base-content/55 hover:text-primary focus-visible:outline-2 focus-visible:outline-primary" aria-label={`Abrir ${title}`}>Abrir registro<ArrowUpRight size={14} aria-hidden="true" /></Link></div>}
  </>;
}
