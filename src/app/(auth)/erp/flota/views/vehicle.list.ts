import { modelColumns } from "@/lib/orm/presentation";
import { recordFields } from "../schemas/vehicle.schema";
export const recordChoices = {
  
} as const;
export const recordColumns = modelColumns(recordFields, [{"field":"name","sortable":true},{"field":"plate","sortable":true},{"field":"active","sortable":true,"groupable":true}]);
export const recordSearchFields = ["plate"] as const;
