import "server-only";
import type { GenerationProfile } from "@/lib/orm/generator/profile";
import { recordModel } from "./models/Record";
import { fabricanteFlotaModel } from "./models/Fabricante";

export const generationProfile = {
  module: {
    id: "flota",
    depends: [],
    models: [
      {
        model: recordModel,
        clientFields: ["name", "plate", "brand", "active"],
      },
      { model: fabricanteFlotaModel, clientFields: [] },
    ],
  },
  externalOwners: {},
} satisfies GenerationProfile;
