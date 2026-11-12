import "server-only";
import { createModelService } from "@/lib/orm/service";
import { FlotaRecordRepository } from "@/generated/orm/bindings/flota/FlotaRecord.store";
import { recordModel } from "./Record";

// Extend your server behavior here; keep transaction authorization in the shared service.
export const recordService = createModelService(recordModel, FlotaRecordRepository, { list: { fields: ["name", "plate", "active", "createByUser.login"], searchFields: ["name", "plate"], sortable: ["name", "plate", "active", "createByUser.login"], groupable: ["active"], filterable: ["name", "plate", "active", "createByUser.login"] }, audit: true });
