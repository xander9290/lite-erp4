import "server-only";
import { createModelService } from "@/lib/orm/service";
import { FlotaFabricanteRepository } from "@/generated/orm/bindings/flota/FlotaFabricante.store";
import { flotaFabricanteModel as recordModel } from "./Fabricante";

export const recordService = createModelService(recordModel, FlotaFabricanteRepository, { list: {"fields":["name","active",
    "logo",
  ],"searchFields":["name"],"sortable":["name","active"],"groupable":["active"],"filterable":["name","active"]}, audit: true });
