import "server-only";
import { createModelService } from "@/lib/orm/service";
import { FlotaRecordRepository } from "@/generated/orm/bindings/flota/FlotaRecord.store";
import { recordModel } from "./Record";

// Extend your server behavior here; keep transaction authorization in the shared service.
export const recordService = createModelService(recordModel, FlotaRecordRepository, { list: { fields: ["name", "active"], searchFields: ["name"], sortable: ["name", "active"], groupable: ["active"], filterable: ["name", "active"] } });
