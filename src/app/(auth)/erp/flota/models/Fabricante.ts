import "server-only";
import { Fields, Model, defineModel } from "@/lib/orm";

export class FlotaFabricante extends Model {
  name = Fields.Text({
    label: "Nombre",
    required: true,
    maxLength: 120,
    tracking: true,
  });
  active = Fields.Boolean({ label: "Activo", default: true, tracking: true });
  logo = Fields.Image({
    folder: "flota-fabricantes",
    label: "Logotipo",
  });
}

export const flotaFabricanteModel = defineModel(FlotaFabricante, {
  name: "FlotaFabricante",
  table: "flota_fabricante",
});
