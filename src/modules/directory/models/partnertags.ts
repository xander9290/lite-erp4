import "server-only";
import { Fields, Model, type DisplayRecord } from "@/lib/orm";
import { ModelTypes } from "@/types/model-types";

export class PartnerTags extends Model {
  name = Fields.Text({
    label: "Nombre",
    required: true,
    maxLength: 50,
    tracking: true,
  });
  active = Fields.Boolean({ label: "Activo", default: true, tracking: true });
  displayName(record: DisplayRecord<PartnerTags, "name">): string {
    return record.name;
  }

  normalize(values: ModelTypes["values"]) {
    return {
      ...values,
      name:
        typeof values.name === "string"
          ? values.name.trim().toLowerCase()
          : values.name,
    };
  }
}
