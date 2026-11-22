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
  groups: { gestor: "Gestor", admin: "Administrador" },
  access: [
    {
      group: "gestor",
      models: ["pais", "estado", "municipio"],
      perms: "crud",
      import: true,
      export: true,
    },
    { group: "gestor", models: "localidad", perms: "crud" },
    {
      group: "admin",
      perms: "crud",
      models: ["pais", "estado", "municipio", "localidad"],
      import: true,
      export: true,
    },
  ],
  models: {
    pais: {
      model: Pais,
      transfer: { key: "codigo", fields: ["codigo", "name", "active"] },
    },

    estado: {
      model: Estado,
      transfer: {
        key: ["paisId", "codigo"],
        fields: ["paisId", "codigo", "name", "active"],
        relations: { paisId: { key: "codigo" } },
      },
    },

    municipio: {
      model: Municipio,
      transfer: {
        key: ["estadoId", "codigo"],
        fields: ["estadoId", "codigo", "name", "active"],
        relations: {
          estadoId: {
            key: ["paisId", "codigo"],
            relations: { paisId: { key: "codigo" } },
          },
        },
      },
    },

    localidad: Localidad,
  },
});
