import "server-only";
import { defineModule } from "@/lib/modules/define";
import { PartnerExtra } from "./model/partner";

export default defineModule({
  id: "contactosextra",
  name: "Contactosextra",
  icon: "boxes",
  models: {},
  extends: {
    "core.partner": PartnerExtra,
  },
});
