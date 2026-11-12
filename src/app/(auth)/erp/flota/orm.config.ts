import { flotaVehicleModel } from "./models/Vehicle";
import { flotaModeloModel } from "./models/Modelo";
import { flotaFabricanteModel } from "./models/Fabricante";
import "server-only";
import type { GenerationProfile } from "@/lib/orm/generator/profile";
import { recordModel } from "./models/Record";

export const generationProfile = {
  module: {
    id: "flota",
    depends: [],
    models: [
      {
        model: recordModel,
        clientFields: ["name", "plate", "brand", "active"],
      },

      {
        model: flotaFabricanteModel,
        clientFields: ["name", "active", "avatar", "logo"],
      },

      {
        model: flotaModeloModel,
        clientFields: ["name", "active", "fabricanteId", "vehicleType"],
      },

      { model: flotaVehicleModel, clientFields: ["name", "active", "plate"] },
    ],
  },
  externalOwners: {},
} satisfies GenerationProfile;
