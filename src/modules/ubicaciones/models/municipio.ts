import "server-only";
import { Fields, Model, type DisplayRecord } from "@/lib/orm";

export class Municipio extends Model {
  name = Fields.Text({ label: "Nombre", required: true, maxLength: 120, tracking: true });
  estadoId = Fields.Many2one("UbicacionesEstado", {
    label: "Estado",
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
  active = Fields.Boolean({ label: "Activo", default: true, tracking: true });
  displayName(record: DisplayRecord<Municipio, "name">): string {
    return record.name;
  }
  // Define aquí normalize, beforeSave y afterSave cuando tu negocio lo necesite.
}
