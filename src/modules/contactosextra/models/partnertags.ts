import "server-only";
import { Fields, Model, type DisplayRecord } from "@/lib/orm";

export class PartnerTags extends Model {
  name = Fields.Text({ label: "Nombre", required: true, maxLength: 120, tracking: true });
  active = Fields.Boolean({ label: "Activo", default: true, tracking: true });
  displayName(record: DisplayRecord<PartnerTags, "name">): string {
    return record.name;
  }
  // Define aquí normalize, beforeSave y afterSave cuando tu negocio lo necesite.
}
