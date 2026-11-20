import { readListDisplayValue, readListValue, type ListColumn, type ListRecord } from "@/lib/list/types";
import { PartnerIdentity } from "../PartnerAvatar";
import { formatListValue } from "./listFormat";
import CollectionImage from "../collection/CollectionImage";
import { badgeColorClass, selectionTextColorClass } from "@/lib/list/badge";

/** Many2many names resolved by the server (`$labels[field]`): up to 3 chips and «+N». */
function TagChips({ record, column }: { record: ListRecord; column: ListColumn }) {
  const labels = Object.hasOwn(record, "$labels") ? (record.$labels as Record<string, unknown> | null)?.[column.field] : null;
  const tags = Array.isArray(labels) ? labels.filter((item): item is { value: string; label: string } => Boolean(item) && typeof item === "object" && typeof (item as { label?: unknown }).label === "string") : [];
  if (!tags.length) return null;
  const shown = tags.slice(0, 3);
  return <span className="flex flex-wrap gap-1" aria-label={`${column.label}: ${tags.map(tag => tag.label).join(", ")}`}>
    {shown.map(tag => <span key={tag.value} className="badge badge-soft badge-primary badge-sm h-auto max-w-full whitespace-normal break-words py-0.5">{tag.label}</span>)}
    {tags.length > shown.length && <span className="badge badge-ghost badge-sm" title={tags.slice(3).map(tag => tag.label).join(", ")}>+{tags.length - shown.length}</span>}
  </span>;
}

export default function ListCellValue({ record, column }: { record: ListRecord; column: ListColumn }) {
  if (column.widget === "tags") return <TagChips record={record} column={column} />;
  const value = readListDisplayValue(record, column);
  if (column.widget === "image") return <CollectionImage value={value} label={column.label} size={column.imageSize} shape={column.imageShape} />;
  const formatted = formatListValue(value, column);
  if (column.widget === "badge") return <span className={`badge badge-sm h-auto max-w-full whitespace-normal break-words py-1 ${badgeColorClass(readListValue(record, column.field), column.colors)}`}>{formatted}</span>;
  const textColor = column.widget === undefined ? selectionTextColorClass(readListValue(record, column.field), column.colors) : "";
  if (textColor) return <span className={textColor}>{formatted}</span>;
  if (column.widget === "partner") {
    const avatar = column.avatarField ? readListValue(record, column.avatarField) : null;
    return <PartnerIdentity name={formatted} avatarUrl={typeof avatar === "string" ? avatar : null} />;
  }
  if (column.format === "boolean" && typeof value === "boolean") return <span className={`badge badge-soft badge-sm ${value ? "badge-success" : "badge-ghost"}`}>{formatted}</span>;
  return formatted;
}
