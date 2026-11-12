import "server-only";
import { DisplayRecord, Fields, Model, defineModel } from "@/lib/orm";
import { flotaFabricanteModel } from "./Fabricante";

export class FlotaModelo extends Model {
  name = Fields.Text({
    label: "Nombre",
    required: true,
    maxLength: 120,
    tracking: true,
  });
  active = Fields.Boolean({ label: "Activo", default: true, tracking: true });
  fabricanteId = Fields.Many2one("FlotaFabricante", {
    label: "Fabricante",
    required: true,
    onDelete: "Restrict",
    tracking: true,
  });

  readonly displayFields = ["fabricante.name", "name"] as const;
  readonly displayRelations = {
    fabricante: flotaFabricanteModel,
  };

  displayName(
    record: DisplayRecord<FlotaModelo, "fabricante.name" | "name">,
  ): string {
    return [record.fabricante.name, record.name].filter(Boolean).join("  ·  ");
  }
}

export const flotaModeloModel = defineModel(FlotaModelo, {
  name: "FlotaModelo",
  table: "flota_modelo",
});
