import type { CollectionField } from "@/components/ui/collection/types";

// Shared presentation. Server authorization and allowed fields remain in the service.
export const recordColumns = [
  { field: "name", label: "Nombre", type: "text", sortable: true },
  { field: "plate", label: "Placas", type: "text", sortable: true },
  { field: "active", label: "Activo", type: "boolean", sortable: true },
  { field: "createByUser.login", label: "Creado por", type: "text", widget: "partner", avatarField: "createByUser.partner.avatarUrl", sortable: true },
] as const satisfies readonly CollectionField[];
export const recordSearchFields = ["name", "plate"] as const;
