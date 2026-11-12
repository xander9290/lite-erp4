import type { Field, FieldMetadata } from "./fields";
import type { ListColumn } from "../list/types";

/** Browser-safe descriptors from the published contract, never a server Model. */
export type PublishedFields = Readonly<Record<string, Pick<Field, "metadata">>>;
export function fieldColumn(name: string, field: FieldMetadata): ListColumn {
  if (field.sensitive) throw new Error(`No se puede presentar el campo sensible ${name}.`);
  return { field: name, label: field.label ?? name,
    ...(field.readOnly ? {sortable:false,filterable:false,groupable:false} : {}),
    type: field.kind === "integer" ? "integer" : field.kind === "boolean" ? "boolean" : field.kind === "datetime" ? "datetime" : "text",
    ...(field.kind === "selection" ? { options: field.choices } : {}),
    ...(field.kind === "many2one" ? { widget: "many2one" as const } : {}),
    ...(field.kind === "image" ? { widget: "image" as const, imageSize: "sm" as const, imageShape: "rounded" as const, filterable: false } : {}),
  };
}
export function modelColumns<F extends PublishedFields>(fields: F, columns: readonly (Omit<Partial<ListColumn>, "field"> & { field: Extract<keyof F, string> })[]): ListColumn[] {
  return columns.map(column => {
    if (!Object.hasOwn(fields, column.field)) throw new Error(`Campo no publicado: ${column.field}.`);
    if (fields[column.field].metadata.readOnly && (column.sortable || column.filterable || column.groupable)) throw new Error(`El campo de lectura ${column.field} no permite orden, filtros ni agrupación.`);
    return { ...fieldColumn(column.field, fields[column.field].metadata), ...column };
  });
}
