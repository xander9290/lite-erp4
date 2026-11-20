import { Localidad } from "./models/localidad";
import { Municipio } from "./models/municipio";
import { Estado } from "./models/estado";
import { Pais } from "./models/pais";
import "server-only";
import { defineModule } from "@/lib/modules/define";

export default defineModule({
  id: "ubicaciones",
  name: "Ubicaciones",
  icon: "globe",
  models: {
    pais: Pais,

    estado: Estado,

    municipio: Municipio,

    localidad: Localidad,
  },
  access: [
    {
      group: "core.internal",
      models: ["pais", "estado", "municipio", "localidad"],
      perms: "r",
    },
  ],
});
