import "server-only";
import { Fields, Model, type DisplayRecord } from "@/lib/orm";

export class Localidad extends Model {
  readonly uniqueTogether = [["municipioId", "codigo"]] as const;
  name = Fields.Text({ label: "Nombre", required: true, maxLength: 120, tracking: true });
  municipioId = Fields.Many2one("UbicacionesMunicipio", {
    label: "Municipio",
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
  displayName(record: DisplayRecord<Localidad, "name">): string {
    return record.name;
  }
  // Define aquí normalize, beforeSave y afterSave cuando tu negocio lo necesite.
}
