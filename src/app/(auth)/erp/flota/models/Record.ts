import "server-only";
import { Fields, Model, defineModel } from "@/lib/orm";

export class FlotaRecord extends Model {
  name = Fields.Text({ label: "Nombre", required: true, unique: false, trim: true, maxLength: 120 });
  plate = Fields.Text({
    label: "Placas",
    required: true,
    unique: true,
    maxLength: 20,
  });
  active = Fields.Boolean({ label: "Activo", unique: false, default: true });
  // Reglas de negocio: beforeSave(values, context) y afterSave(record, context).
}

export const recordModel = defineModel(FlotaRecord, { name: "FlotaRecord", table: "flota_records" });
