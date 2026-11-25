import { BusinessActivity } from "./models/businessactivity";
import { PartnerTags } from "./models/partnertags";
import { Partner } from "./models/partner";
import "server-only";
import { defineModule } from "@/lib/modules/define";

export default defineModule({
  id: "directory",
  name: "Directorio",
  icon: "notebook",
  depends: ["ubicaciones"],
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
    },

    partnertags: PartnerTags,

    businessactivity: {
      model: BusinessActivity,
      views: { form: () => import("./views/BusinessactivityForm") },
    },
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
});
