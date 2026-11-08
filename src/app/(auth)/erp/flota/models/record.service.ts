import "server-only";
import { createModelService } from "@/lib/orm/service";
import { FlotaRecordRepository } from "@/generated/orm/bindings/flota/FlotaRecord.store";
import { recordModel } from "./Record";
import { recordColumns, recordSearchFields } from "../views/record.list";

// Extend your server behavior here; keep transaction authorization in the shared service.
export const recordService = createModelService(recordModel, FlotaRecordRepository, { columns: recordColumns, searchFields: recordSearchFields, audit: true });
