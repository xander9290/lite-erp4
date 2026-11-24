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
        fields: ["image", "name", "phones", "street", "streetNumber", "vat", "completeAddress"],
      },
      views: { form: () => import("./views/PartnerForm"), card: () => import("./views/PartnerCard"), list: true },
    },
  },
  menu: {
    Contactos: "partner",
  },
});
