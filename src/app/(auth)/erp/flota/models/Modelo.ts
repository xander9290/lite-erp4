import "server-only";
import { Fields, Model, defineModel, displayName, type DisplayRecord } from "@/lib/orm";

import { flotaFabricanteModel } from "./Fabricante";

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
  readonly displayRelations={fabricante:flotaFabricanteModel};

  @displayName("name","fabricante.name")
  modeloLabel(record:DisplayRecord<FlotaModelo,"name"|"fabricante.name">):string {
    return [record.fabricante.name,record.name].filter(Boolean).join(" · ");
  }
}

export const flotaModeloModel = defineModel(FlotaModelo, {
  name:"FlotaModelo",table:"flota_modelo",
});
