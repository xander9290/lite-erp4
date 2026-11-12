import { modelColumns } from "@/lib/orm/presentation";
import { recordFields } from "../schemas/modelo.schema";
// Optional shared columns for future CardView/KanbanView consumers.
export const recordColumns = modelColumns(recordFields, [
  { field: "name", sortable: true },
  { field: "fabricanteId", sortable: true, groupable: true },
  { field: "vehicleType", sortable: true, groupable: true },
]);
export const recordSearchFields = ["name"] as const;
