import type { ListColumn } from "@/lib/list/types";
export const groupingSampleColumns = [
  { field: "name", label: "Nombre", sortable: true, filterable: false },
  { field: "active", label: "Activo", type: "boolean", groupable: true, sortable: true },
  { field: "insured", label: "Asegurado", type: "boolean", groupable: true, sortable: true },
  { field: "available", label: "Disponible", type: "boolean", groupable: true, sortable: true },
] as const satisfies readonly ListColumn[];
