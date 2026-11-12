import "server-only";
import { createModelService } from "@/lib/orm/service";
import { FlotaFabricanteRepository } from "@/generated/orm/bindings/flota/FlotaFabricante.store";
import { flotaFabricanteModel as recordModel } from "./Fabricante";

export const recordService = createModelService(recordModel, FlotaFabricanteRepository, { list: { fields: ["name", "avatar"], searchFields: ["name"], sortable: ["name"], groupable: [], filterable: ["name"] }, audit: true });
