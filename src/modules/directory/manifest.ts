import { Partner } from "./models/partner";
import "server-only";
import { defineModule } from "@/lib/modules/define";

export default defineModule({
  id: "directory",
  name: "Directorio",
  icon: "notebook",
  models: {
    partner: Partner,
  },
});
