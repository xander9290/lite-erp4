import ListView from "@/components/ui/list/ListView";
import { usersManifest } from "./manifest";

export default function UsersPage() {
  const Icon = usersManifest.icon;
  return <ListView model="user" title={usersManifest.name} description={usersManifest.description} icon={<Icon size={22} />} createHref="/erp/usuarios/nuevo" createLabel="Nuevo usuario" recordHref="/erp/usuarios/{id}"
    breadcrumbs={[{ label: "Aplicaciones", href: "/erp" }, { label: usersManifest.name }]}
    searchFields={["login", "partner.name"]} columns={[{ field: "login", label: "Usuario", sortable: true }, { field: "partner.name", label: "Nombre", widget: "partner", avatarField: "partner.avatarUrl", sortable: true }, { field: "active", label: "Activo", sortable: true }, { field: "isAdmin", label: "Administrador", sortable: true }, { field: "lastLogin", label: "Último acceso", sortable: true }]} />;
}
