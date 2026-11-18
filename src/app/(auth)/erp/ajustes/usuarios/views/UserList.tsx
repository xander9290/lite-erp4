import ModelCollection from "@/components/modules/ModelCollection";
import type { ModelClientConfig } from "@/lib/modules/config";

/** Presentation only; the core.user list policy controls publication, queries and permissions. */
export default function UserList({ config }: { config: ModelClientConfig }) {
  return <ModelCollection config={config} view="list" columns={[
    { field: "avatarUrl", label: "Avatar" },
    { field: "name", label: "Nombre" },
    { field: "login", label: "Usuario" },
    { field: "email", label: "Correo electrónico" },
    { field: "active", label: "Activo" },
    { field: "isAdmin", label: "Administrador" },
    { field: "lastLogin", label: "Último acceso" },
  ]} />;
}
