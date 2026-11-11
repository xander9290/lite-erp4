import { readListDisplayValue, readListValue, type ListColumn, type ListRecord } from "@/lib/list/types";
import { PartnerIdentity } from "../PartnerAvatar";
import { formatListValue } from "./listFormat";
import CollectionImage from "../collection/CollectionImage";

export default function ListCellValue({ record, column }: { record: ListRecord; column: ListColumn }) {
  const value = readListDisplayValue(record, column);
  if (column.widget === "image") return <CollectionImage value={value} label={column.label} size={column.imageSize} shape={column.imageShape} />;
  const formatted = formatListValue(value, column);
  if (column.widget === "partner") {
    const avatar = column.avatarField ? readListValue(record, column.avatarField) : null;
    return <PartnerIdentity name={formatted} avatarUrl={typeof avatar === "string" ? avatar : null} />;
  }
  if (column.format === "boolean" && typeof value === "boolean") return <span className={`badge badge-soft badge-sm ${value ? "badge-success" : "badge-ghost"}`}>{formatted}</span>;
  return formatted;
}
