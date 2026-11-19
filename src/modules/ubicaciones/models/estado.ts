import "server-only";
import { Fields, Model, type DisplayRecord } from "@/lib/orm";

export class Estado extends Model {
  name = Fields.Text({
    label: "Nombre",
    required: true,
    maxLength: 120,
    tracking: true,
  });
  paisId = Fields.Many2one("UbicacionesPais", {
    label: "País",
    required: true,
    onDelete: "Restrict",
    tracking: true,
  });
  codigo = Fields.Text({
    label: "Clave",
    required: true,
    maxLength: 10,
    tracking: true,
  });
  municipioIds = Fields.One2many("UbicacionesMunicipio", {
    inverse: "estadoId",
    label: "Municipios",
    readonly: true,
  });
  active = Fields.Boolean({ label: "Activo", default: true, tracking: true });
  displayName(record: DisplayRecord<Estado, "name">): string {
    return record.name;
  }
  // Define aquí normalize, beforeSave y afterSave cuando tu negocio lo necesite.
}
