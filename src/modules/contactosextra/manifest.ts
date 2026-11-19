import "server-only";
import { defineModule } from "@/lib/modules/define";
import { PartnerExtra } from "./model/partner";

export default defineModule({
  id: "contactosextra",
  name: "Contactosextra",
  icon: "boxes",
  depends: ["ubicaciones"],
  models: {},
  extends: {
    "core.partner": {
      model: PartnerExtra,
      insertions: {
        form: () => import("./views/PartnerInsertions"),
        list: () => import("./views/PartnerListInsertions"),
      },
    },
  },
});
