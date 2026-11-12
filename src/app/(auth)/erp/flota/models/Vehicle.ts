import "server-only";
import {
  Fields,
  Model,
  defineModel,
  displayName,
  type DisplayRecord,
} from "@/lib/orm";
import { flotaModeloModel } from "./Modelo";

export class FlotaVehicle extends Model {
  name = Fields.Many2one("FlotaModelo", {
    label: "Modelo",
    required: true,
    onDelete: "Restrict",
    tracking: true,
  });
  active = Fields.Boolean({ label: "Activo", default: true, tracking: true });
  plate = Fields.Text({
    label: "Matrícula",
    tracking: true,
    maxLength: 50,
    required: true,
  });
  readonly displayRelations = { nameRecord: flotaModeloModel };

  @displayName("nameRecord.fabricante.name", "nameRecord.name")
  vehicleLabel(
    record: DisplayRecord<
      FlotaVehicle,
      "nameRecord.fabricante.name" | "nameRecord.name"
    >,
  ): string {
    return [record.nameRecord.fabricante.name, record.nameRecord.name]
      .filter(Boolean)
      .join(" · ");
  }
  // Define aquí normalize, beforeSave y afterSave cuando tu negocio lo necesite.
}

export const flotaVehicleModel = defineModel(FlotaVehicle, {
  name: "FlotaVehicle",
  table: "flota_vehicle",
});
