import type { CollectionField } from "@/components/ui/collection/types";
import { recordFields } from "../schemas/modelo.schema";
export const recordChoices = {
  vehicleType:
    recordFields.vehicleType.metadata.kind === "selection"
      ? recordFields.vehicleType.metadata.choices
      : [],
} as const;

export const recordColumns = [
  { field: "name", label: "Nombre", type: "text", sortable: true },
  {
    field: "fabricanteId",
    label: "Fabricante",
    widget: "many2one",
    type: "text",
    sortable: true,
    groupable: true,
  },
  {
    field: "vehicleType",
    label: "Tipo",
    type: "text",
    sortable: true,
    groupable: true,
    options: recordChoices.vehicleType,
  },
] as const satisfies readonly CollectionField[];
export const recordSearchFields = ["name"] as const;
