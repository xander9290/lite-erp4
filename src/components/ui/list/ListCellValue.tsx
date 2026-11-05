import { readListValue, type ListColumn, type ListRecord } from "@/lib/list/types";
import { PartnerIdentity } from "../PartnerAvatar";
import { formatListValue } from "./listFormat";

export default function ListCellValue({ record, column }: { record: ListRecord; column: ListColumn }) {
  const value = readListValue(record, column.field);
  const formatted = formatListValue(value, column);
  if (column.widget === "partner") {
    const avatar = column.avatarField ? readListValue(record, column.avatarField) : null;
    return <PartnerIdentity name={formatted} avatarUrl={typeof avatar === "string" ? avatar : null} />;
  }
  if (column.format === "boolean" && typeof value === "boolean") return <span className={`badge badge-soft badge-sm ${value ? "badge-success" : "badge-ghost"}`}>{formatted}</span>;
  return formatted;
}
