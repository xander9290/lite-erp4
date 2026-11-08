import ListView from "@/components/ui/list/ListView";
import { getCurrentUser } from "@/lib/auth/access";
import { contactsManifest } from "../manifest";

export default async function ContactList() {
  const user = await getCurrentUser();
  const Icon = contactsManifest.icon;
  return <ListView model="partner" title={contactsManifest.name} description="Filtra cada columna para encontrar tus contactos." icon={<Icon size={22} />}
        breadcrumbs={[{ label: "Aplicaciones", href: "/erp" }, { label: contactsManifest.name }]}
        createHref={user?.isAdmin ? "/erp/contactos/nuevo" : undefined} createLabel="Nuevo contacto" recordHref="/erp/contactos/{id}"
        searchFields={["name", "email", "phone", "user.login"]}
        columns={[
          { field: "name", label: "Nombre", widget: "partner", avatarField: "avatarUrl", sortable: true },
          { field: "email", label: "Correo electrónico", sortable: true },
          { field: "phone", label: "Teléfono", sortable: true },
          { field: "user.login", label: "Usuario", sortable: true },
        ]} />;
}
