import { modelColumns } from "@/lib/orm/presentation";
import { recordCollectionFields as recordFields } from "../schemas/fabricante.schema";
export const recordChoices = {} as const;
export const recordColumns = modelColumns(recordFields, [
  { field: "name", sortable: true },
  { field: "logo", widget: "image", sortable: false },
]);
export const recordSearchFields = ["name"] as const;
