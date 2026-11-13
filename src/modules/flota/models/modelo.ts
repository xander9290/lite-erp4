import "server-only";
import { Fields, Model, displayName } from "@/lib/orm";

export class Modelo extends Model {
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

  @displayName("name", "fabricante.name")
  displayName(
    record: Readonly<{
      name: string;
      fabricante: Readonly<{ name: string }> | null;
    }>,
  ): string {
    return [record.name, record.fabricante?.name].filter(Boolean).join(" / ");
  }
  // Define aquí normalize, beforeSave y afterSave cuando tu negocio lo necesite.
}
