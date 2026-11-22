import type { ApplicationManifest } from "@/lib/applications/manifest";

/** Shared metadata, without React/icons, also consumed by Grupos. */
export const contactsNavigation = {
  id: "contactos",
  name: "Contactos",
  accessModels: ["core.partner"],
  menus: [
    {
      id: "contacts",
      label: "Contactos",
      href: "/erp/contactos",
      model: "core.partner",
    },
    {
      id: "configuracion",
      label: "Configuración",
      items: [
        {
          id: "paises",
          label: "Países",
          href: "/erp/ubicaciones/pais",
          model: "ubicaciones.pais",
        },
        {
          id: "estados",
          label: "Estados",
          href: "/erp/ubicaciones/estado",
          model: "ubicaciones.estado",
        },
        {
          id: "municipios",
          label: "Municipios",
          href: "/erp/ubicaciones/municipio",
          model: "ubicaciones.municipio",
        },
        {
          id: "localidades",
          label: "Localidades",
          href: "/erp/ubicaciones/localidad",
          model: "ubicaciones.localidad",
        },
      ],
    },
  ],
} satisfies Pick<ApplicationManifest, "id" | "name" | "accessModels" | "menus">;
