import Link from "next/link";
import ListView from "@/components/ui/list/ListView";
import ColumnFilterSample from "./ColumnFilterSample";
import ListSelectionSample from "./ListSelectionSample";

export default function ListViewSample() {
  return <section id="list-view" aria-labelledby="list-view-example-title" className="min-w-0 scroll-mt-6 space-y-3">
    <header className="flex flex-wrap items-center justify-between gap-3 px-1"><div><h2 id="list-view-example-title" className="text-xl font-semibold">ListView</h2><p className="mt-1 text-sm text-base-content/60">Card con acciones, filtros por columna y footer extensible. Los filtros se combinan y se conservan en la URL.</p></div><Link href="/erp/ajustes/usuarios" className="btn btn-ghost btn-sm">Abrir Usuarios</Link></header>
    <ListView delete={false} create={false} model="user" title="Usuarios de ejemplo" description="Usa el icono de filtro junto a cada encabezado." pageSize={1} paramPrefix="profiles"
      breadcrumbs={[{ label: "Aplicaciones", href: "/erp" }, { label: "Usuarios de ejemplo" }]}
      headerActions={<details className="dropdown dropdown-end"><summary className="btn btn-ghost btn-sm">Opciones</summary><ul className="menu dropdown-content z-30 mt-2 w-48 rounded-xl border border-base-300 bg-base-100 p-2 shadow-lg"><li><Link href="/erp/ajustes/usuarios">Abrir aplicación</Link></li></ul></details>}
      footer={<p>Una fila por página para probar la navegación con pocos registros.</p>}
      searchFields={["name", "login"]} columns={[{ field: "name", label: "Nombre", widget: "partner", avatarField: "avatarUrl", sortable: true }, { field: "login", label: "Usuario", sortable: true }]} />
    <ListView delete={false} create={false} model="user" title="Usuarios y fechas" description="Prueba días completos, rangos o fecha y hora exactas en Último acceso." paramPrefix="users"
      footer={<p>Las horas se muestran en la zona del navegador. «Está vacío» encuentra usuarios que aún no registran un acceso.</p>}
      columns={[{ field: "login", label: "Usuario", sortable: true }, { field: "name", label: "Nombre", widget: "partner", avatarField: "avatarUrl", sortable: true }, { field: "lastLogin", label: "Último acceso", type: "datetime", sortable: true }]}/>
    <ListSelectionSample />
    <ColumnFilterSample />
  </section>;
}
