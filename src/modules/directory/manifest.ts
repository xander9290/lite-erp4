import { PartnerPhones } from "./models/partnerphones";
import { PartnerEmails } from "./models/partneremails";
import { BusinessActivity } from "./models/businessactivity";
import { PartnerTags } from "./models/partnertags";
import { Partner } from "./models/partner";
import "server-only";
import { defineModule } from "@/lib/modules/define";
import { UserDirectory } from "./models/user";

export default defineModule({
  id: "directory",
  name: "Directorio",
  icon: "notebook",
  depends: ["ubicaciones"],
  extends: {
    "core.user": {
      model: UserDirectory,
      insertions: {
        form: () => import("./views/UserDirectoryForm"),
      },
    },
  },
  models: {
    partner: {
      model: Partner,
      list: {
        fields: [
          "image",
          "name",
          "phones",
          "street",
          "streetNumber",
          "vat",
          "provinceId",
          "countyId",
        ],
      },
      defaultScreen: "contacts",
      screens: {
        contacts: {
          label: "Contactos",
          view: "card",
          domain: (d) => d.eq("type", "contact"),
          defaults: { type: "contact" },
          views: {
            form: () => import("./views/PartnerForm"),
            card: () => import("./views/PartnerCard"),
            list: true,
            modal: () => import("./views/PartnerModal"),
          },
        },
        addresses: {
          label: "Direcciones",
          view: "list",
          domain: (d) => d.in("type", ["delivery", "invoice"]),
          defaults: { type: "delivery" },
          views: {
            list: true,
            form: () => import("./views/PartnerForm"),
            modal: () => import("./views/PartnerModal"),
          },
        },
      },
      // Pestañas de PartnerForm que Ajustes → Grupos → Páginas puede ocultar (sólo presentación).
      pages: {
        additionalInfo: {
          otherAddresses: "Otras direcciones",
          salesPurchase: "Venta y compra",
          otherInfo: "Otra información",
          emails: "Correos adicionales",
          phones: "Teléfonos adicionales",
        },
      },
    },

    partnertags: PartnerTags,

    businessactivity: {
      model: BusinessActivity,
      views: { form: () => import("./views/BusinessactivityForm") },
    },

    partneremails: PartnerEmails,

    partnerphones: PartnerPhones,
  },
  menu: {
    Catálogos: {
      Contactos: {
        model: "partner",
        screen: "contacts",
      },
      Direcciones: { model: "partner", screen: "addresses" },
    },
    Configuración: {
      Etiquetas: "partnertags",
      "Actividad empresarial": "businessactivity",
    },
  },
  groups: { admin: "Administrador", auxiliar: "Auxiliar", read: "Consulta" },
  access: [
    {
      group: "admin",
      models: ["partner", "businessactivity", "partnertags"],
      perms: "crud",
      import: true,
      export: true,
    },
    {
      group: "auxiliar",
      models: ["partner", "businessactivity", "partnertags"],
      perms: "cru",
    },
    {
      group: "read",
      models: ["partner", "businessactivity", "partnertags"],
      perms: "r",
    },
  ],
});
