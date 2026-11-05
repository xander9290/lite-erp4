import Link from "next/link";
import { ChevronLeft, ShieldCheck } from "lucide-react";
import ListView from "@/components/ui/list/ListView";

export default function UsersPage() {
  return <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden p-3 sm:p-6"><div className="flex w-full min-h-0 min-w-0 flex-1 flex-col gap-4">
    <Link href="/erp" className="inline-flex w-fit shrink-0 items-center gap-1 text-sm text-base-content/60 hover:text-primary"><ChevronLeft size={16} aria-hidden="true" />Aplicaciones</Link>
    <ListView model="user" title="Usuarios" description="Cuentas de acceso y permisos del ERP." icon={<ShieldCheck size={22} />} createHref="/erp/usuarios/nuevo" createLabel="Nuevo usuario" recordHref="/erp/usuarios/{id}"
      searchFields={["login", "partner.name"]} columns={[{ field: "login", label: "Usuario", sortable: true }, { field: "partner.name", label: "Nombre", widget: "partner", avatarField: "partner.avatarUrl", sortable: true }, { field: "active", label: "Activo", sortable: true }, { field: "isAdmin", label: "Administrador", sortable: true }, { field: "lastLogin", label: "Último acceso", sortable: true }]} />
  </div></div>;
}
