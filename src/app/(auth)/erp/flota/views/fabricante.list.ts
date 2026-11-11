import type { CollectionField } from "@/components/ui/collection/types";

export const recordColumns = [
  { field: "name", label: "Nombre", type: "text", sortable: true },
  {
    field: "avatar",
    label: "Imagen",
    type: "text",
    widget: "image",
    imageShape: "squared",
    imageSize: "sm",
    sortable: false,
    filterable: false,
  },
] as const satisfies readonly CollectionField[];
export const recordSearchFields = ["name"] as const;
