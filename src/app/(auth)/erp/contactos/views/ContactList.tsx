import ModelCollection from "@/components/modules/ModelCollection";
import type { ModelClientConfig } from "@/lib/modules/config";

export default function ContactList({ config }: { config: ModelClientConfig }) {
  return <ModelCollection config={config} view="list" columns={[
    { field: "avatarUrl", label: "Avatar" },
    { field: "name", label: "Nombre" },
    { field: "email", label: "Correo electrónico" },
    { field: "phone", label: "Teléfono" },
  ]} />;
}
