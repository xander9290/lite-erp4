import "server-only";
import { Fields, Model, defineModel } from "@/lib/orm";

export class FlotaModelo extends Model {
  name = Fields.Text({
    label: "Nombre",
    required: true,
    maxLength: 120,
    tracking: true,
  });
  fabricanteId = Fields.Many2one("FlotaFabricante", {
    label: "Fabricante",
    required: true,
    onDelete: "Restrict",
  });
  vehicleType = Fields.Selection(
    [
      { label: "Automóvil", value: "car" },
      { label: "Bicicleta", value: "bike" },
    ],
    {
      required: true,
      label: "Tipo",
    },
  );
  active = Fields.Boolean({ label: "Activo", default: true, tracking: true });
  // Define aquí normalize, beforeSave y afterSave cuando tu negocio lo necesite.

  displayFields = ["name", "fabricante.name"] as const;

  displayName(
    record: Readonly<{
      name: string;
      fabricante: Readonly<{ name: string }> | null;
    }>,
  ) {
    return [record.fabricante?.name, record.name].filter(Boolean).join(" · ");
  }
}

export const flotaModeloModel = defineModel(FlotaModelo, {
  name: "FlotaModelo",
  table: "flota_modelo",
});
