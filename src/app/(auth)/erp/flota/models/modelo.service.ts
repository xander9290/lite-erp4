import "server-only";
import { createModelService } from "@/lib/orm/service";
import { FlotaModeloRepository } from "@/generated/orm/bindings/flota/FlotaModelo.store";
import { flotaModeloModel as recordModel } from "./Modelo";
import { recordColumns, recordSearchFields } from "../views/modelo.list";

export const recordService = createModelService(recordModel, FlotaModeloRepository, { columns: recordColumns, searchFields: recordSearchFields, audit: true });
