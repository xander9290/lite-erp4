import type { CollectionField } from "@/components/ui/collection/types";

// Shared presentation. Server authorization and allowed fields remain in the service.
export const recordColumns = [
  { field: "name", label: "Nombre", type: "text", sortable: true },
  { field: "active", label: "Activo", type: "boolean", sortable: true, groupable: true },
] as const satisfies readonly CollectionField[];
export const recordSearchFields = ["name"] as const;
