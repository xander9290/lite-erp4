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
      view: "card",
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
      views: {
        form: () => import("./views/PartnerForm"),
        card: () => import("./views/PartnerCard"),
        list: true,
      },
    },

    partnertags: PartnerTags,

    businessactivity: {
      model: BusinessActivity,
      views: { form: () => import("./views/BusinessactivityForm") },
    },
  },
  menu: {
    Contactos: "partner",
    Configuración: {
      Etiquetas: "partnertags",
      "Actividad empresarial": "businessactivity",
    },
  },
});
