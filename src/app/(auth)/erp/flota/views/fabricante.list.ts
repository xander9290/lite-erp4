import { modelColumns } from "@/lib/orm/presentation";
import { recordFields } from "../schemas/fabricante.schema";
export const recordColumns = modelColumns(recordFields, [
  { field: "name", sortable: true },
  { field: "avatar", label: "Imagen", imageShape: "squared", imageSize: "sm", sortable: false, filterable: false },
]);
export const recordSearchFields = ["name"] as const;
