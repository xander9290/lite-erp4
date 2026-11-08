import type { ListConfig } from "@/lib/list/types";

export const appointmentListConfig = {
  model: "dentalAppointment",
  searchFields: ["patient.name", "patient.phone", "reason"],
  defaultSort: { field: "scheduledAt", direction: "asc" },
  columns: [
    { field: "patient.name", label: "Paciente", widget: "partner", sortable: true },
    { field: "patient.phone", label: "Teléfono", sortable: true },
    { field: "scheduledAt", label: "Fecha y hora", sortable: true },
    { field: "reason", label: "Motivo", sortable: true },
    { field: "status", label: "Seguimiento", sortable: true, filterable: false },
  ],
} as const satisfies ListConfig;
