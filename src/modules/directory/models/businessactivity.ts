import "server-only";
import { displayName, Fields, Model, type DisplayRecord } from "@/lib/orm";

export class BusinessActivity extends Model {
  name = Fields.Text({
    label: "Nombre",
    required: true,
    maxLength: 100,
    tracking: true,
  });
  description = Fields.Text({
    label: "Descripción",
    tracking: true,
  });
  code = Fields.Text({
    label: "Clave",
    unique: true,
    tracking: true,
  });
  parentId = Fields.Many2one("DirectoryBusinessactivity", {
    label: "Actividad superior",
    onDelete: "Restrict",
    domain: (d) => d.neq("id", d.record.id),
  });
  active = Fields.Boolean({ label: "Activo", default: true, tracking: true });

  @displayName("parent.name", "name")
  displayName(
    record: Readonly<{
      name: string;
      parent: Readonly<{ name: string }> | null;
    }>,
  ): string {
    return [record.parent?.name, record.name].filter(Boolean).join(" / ");
  }
  // Define aquí normalize, beforeSave y afterSave cuando tu negocio lo necesite.
}
