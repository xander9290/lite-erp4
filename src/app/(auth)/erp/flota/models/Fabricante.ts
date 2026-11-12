import "server-only";
import { Fields, Model, defineModel, displayName, type DisplayRecord } from "@/lib/orm";

export class FlotaFabricante extends Model {
  name = Fields.Text({
    label: "Nombre",
    required: true,
    maxLength: 120,
    tracking: true,
  });
  logo = Fields.Text({ label: "Logotipo" });
  avatar = Fields.Image({
    folder: "fabricantes",
  });
  active = Fields.Boolean({ label: "Activo", default: true, tracking: true });
  @displayName("name")
  fabricanteLabel(record:DisplayRecord<FlotaFabricante,"name">):string {return record.name;}

}

export const flotaFabricanteModel = defineModel(FlotaFabricante, {
  name: "FlotaFabricante",
  table: "flota_fabricante",
});
