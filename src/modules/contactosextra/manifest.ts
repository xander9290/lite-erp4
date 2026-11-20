import "server-only";
import { defineModule } from "@/lib/modules/define";
import { PartnerTags } from "./models/partnertags";
import { PartnerExtra } from "./models/partner";

export default defineModule({
  id: "contactosextra",
  name: "Contactosextra",
  icon: "boxes",
  depends: ["ubicaciones"],
  models: {
    partnertags: PartnerTags,
  },
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
