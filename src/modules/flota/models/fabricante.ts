import "server-only";
import { Fields, Model, type DisplayRecord } from "@/lib/orm";

export class Fabricante extends Model {
  name = Fields.Text({
    label: "Nombre",
    required: true,
    maxLength: 120,
    tracking: true,
  });
  logo = Fields.Image({
    label: "Logotipo",
    folder: "flota/fabricantes",
    required: false,
    tracking: true,
  });
  active = Fields.Boolean({ label: "Activo", default: true, tracking: true });
  displayName(record: DisplayRecord<Fabricante, "name">): string {
    return record.name;
  }
  // Define aquí normalize, beforeSave y afterSave cuando tu negocio lo necesite.
}
