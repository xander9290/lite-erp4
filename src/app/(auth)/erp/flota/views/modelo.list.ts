import { modelColumns } from "@/lib/orm/presentation";
import { recordCollectionFields as recordFields } from "../schemas/modelo.schema";
export const recordChoices = {
  
} as const;
export const recordColumns = modelColumns(recordFields, [{"field":"name","sortable":true},{"field":"active","sortable":true,"groupable":true},{"field":"fabricanteId","sortable":true,"groupable":true}]);
export const recordSearchFields = ["name"] as const;
