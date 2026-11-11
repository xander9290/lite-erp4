import "server-only";
import { createModelService } from "@/lib/orm/service";
import { FlotaFabricanteRepository } from "@/generated/orm/bindings/flota/FlotaFabricante.store";
import { flotaFabricanteModel as recordModel } from "./Fabricante";
import { recordColumns, recordSearchFields } from "../views/fabricante.list";

export const recordService = createModelService(recordModel, FlotaFabricanteRepository, { columns: recordColumns, searchFields: recordSearchFields, audit: true });
