import { UsersRound } from "lucide-react";
import { defineApplication } from "@/lib/applications/manifest";

export const contactsManifest = defineApplication({
  id: "contactos",
  name: "Contactos",
  description: "Contactos compartidos de empresas, usuarios, clientes y proveedores.",
  version: "0.1.0",
  icon: UsersRound,
  depends: ["ubicaciones"],
  access: "authenticated",
  models: ["Partner"],
  accessModels: ["core.partner"],
  menus: [
    { id: "contacts", label: "Contactos", href: "/erp/contactos", model: "core.partner" },
    {
      id: "configuracion",
      label: "Configuración",
      items: [
        { id: "paises", label: "Países", href: "/erp/ubicaciones/pais", model: "ubicaciones.pais" },
        { id: "estados", label: "Estados", href: "/erp/ubicaciones/estado", model: "ubicaciones.estado" },
        { id: "municipios", label: "Municipios", href: "/erp/ubicaciones/municipio", model: "ubicaciones.municipio" },
        { id: "localidades", label: "Localidades", href: "/erp/ubicaciones/localidad", model: "ubicaciones.localidad" },
      ],
    },
  ],
});
