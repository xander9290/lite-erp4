import "server-only";
import { Fields, Model, defineModel } from "@/lib/orm";

export class FlotaRecord extends Model {
  name = Fields.Text({"label":"Nombre","required":true,"unique":false,"tracking":true,"trim":true,"maxLength":120});
  active = Fields.Boolean({"label":"Activo","unique":false,"tracking":true,"default":true});
  // Reglas de negocio: beforeSave(values, context) y afterSave(record, context).
}

export const recordModel = defineModel(FlotaRecord, { name: "FlotaRecord", table: "flota_records" });
