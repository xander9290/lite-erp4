import "server-only";
import type { GenerationProfile } from "@/lib/orm/generator/profile";
import { recordModel } from "./models/Record";

export const generationProfile = {
  module: { id: "flota", depends: [], models: [{ model: recordModel, clientFields: ["name", "plate", "active"] }] },
  externalOwners: {},
} satisfies GenerationProfile;
