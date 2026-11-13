import { Modelo } from "./models/modelo";
import { Fabricante } from "./models/fabricante";
import "server-only";
import { defineModule } from "@/lib/modules/define";

export default defineModule({
  id: "flota",
  name: "Flota",
  icon: "car",
  models: {
    fabricante: Fabricante,
  
    modelo: Modelo,
  },
});
