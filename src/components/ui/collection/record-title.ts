import { readListDisplayValue, recordDisplayName, type ListColumn, type ListRecord } from "@/lib/list/types";
import { formatListValue } from "../list/listFormat";

/** Shared by cards, kanban, drag announcements and accessible controls. */
export function recordCardTitle(record: ListRecord, titleField?: string, columns: readonly ListColumn[] = []) {
  if (!titleField) return recordDisplayName(record);
  const column = columns.find(column => column.field === titleField) ?? { field: titleField, label: titleField };
  return formatListValue(readListDisplayValue(record, { ...column, displayName: false }), column);
}
