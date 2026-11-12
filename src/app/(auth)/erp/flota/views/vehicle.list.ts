import { modelColumns } from "@/lib/orm/presentation";
import { recordCollectionFields as recordFields } from "../schemas/vehicle.schema";
export const recordChoices = {
  
} as const;
export const recordColumns = modelColumns(recordFields, [{"field":"name","sortable":true,"groupable":true},{"field":"active","sortable":true,"groupable":true}]);
export const recordSearchFields = [] as const;
