"use client";

import ListView from "@/components/ui/list/ListView";
import { kindLabel, moduleKinds, moduleStatuses, statusLabel } from "@/lib/module-manager/types";
import { loadModules } from "./actions";

export default function ModuleList() {
  return <ListView
    model="module-catalogue" title="Módulos" load={loadModules}
    breadcrumbs={[{ label: "Aplicaciones", href: "/erp" }, { label: "Módulos" }]}
    create={false} delete={false} recordHref="/erp/modulos/{id}"
    searchFields={["name", "id"]} defaultSort={{ field: "name", direction: "asc" }}
    columns={[
      { field: "name", label: "Nombre", sortable: true, filterable: true },
      { field: "id", label: "Identificador", sortable: true, filterable: true },
      { field: "kind", label: "Tipo", options: moduleKinds, sortable: true, filterable: true },
      { field: "version", label: "Versión", sortable: true, filterable: true },
      { field: "status", label: "Estado", options: moduleStatuses, sortable: true, filterable: true },
    ]}
    renderCell={(record, column) => column.field === "status"
      ? <span className={`badge badge-sm h-auto whitespace-normal py-1 ${record.status === "installed" ? "badge-success badge-soft" : record.status === "review" || record.status === "pending" ? "badge-warning badge-soft" : "badge-ghost"}`}>{statusLabel(String(record.status))}</span>
      : column.field === "kind" ? kindLabel(String(record.kind)) : undefined}
    footer={<p>Abre un módulo para revisar y aplicar una operación. Los cambios de esquema se realizan en desarrollo.</p>}
  />;
}
