import "server-only";
import { Fields, Model, type DisplayRecord } from "@/lib/orm";

export class PartnerTags extends Model {
  name = Fields.Text({
    label: "Nombre",
    required: true,
    maxLength: 120,
    tracking: true,
  });
  active = Fields.Boolean({ label: "Activo", default: true, tracking: true });
  displayName(record: DisplayRecord<PartnerTags, "name">): string {
    return record.name;
  }

  normalize(values: Readonly<Record<string, unknown>>) {
    return {
      ...values,
      name:
        typeof values.name === "string"
          ? values.name.trim().toLowerCase()
          : values.name,
    };
  }
}
