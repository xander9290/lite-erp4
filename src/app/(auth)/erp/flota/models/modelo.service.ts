import "server-only";
import { createModelService } from "@/lib/orm/service";
import { FlotaModeloRepository } from "@/generated/orm/bindings/flota/FlotaModelo.store";
import { flotaModeloModel as recordModel } from "./Modelo";

export const recordService = createModelService(recordModel, FlotaModeloRepository, { list: {"fields":["name","active","fabricanteId"],"searchFields":["name"],"sortable":["name","active","fabricanteId"],"groupable":["active","fabricanteId"],"filterable":["name","active","fabricanteId"]}, audit: true, relations: { fabricanteId: async request => (await import("../schemas/modelo.ui")).recordUI.lookups.fabricanteId(request) } });
