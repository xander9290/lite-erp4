import { Fields, type Field, type FieldMetadata } from "../orm/fields";

/** Browser-side mirror of the generated `Fields.X(...)` expressions (see generator `fieldExpression`). */
export function fieldFromMetadata(field: FieldMetadata): Field {
  const common = { label: field.label, ...(field.kind !== "boolean" ? { required: field.required } : {}), unique: field.unique,
    ...(field.tracking !== undefined ? { tracking: field.tracking } : {}), ...(field.sensitive !== undefined ? { sensitive: field.sensitive } : {}),
    ...(field.defaultKind === "literal" ? { default: field.defaultValue } : {}) };
  const defined = <T extends Record<string, unknown>>(value: T) => Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined)) as T;
  switch (field.kind) {
    case "text": return Fields.Text(defined({ ...common, trim: field.trim, minLength: field.minLength, maxLength: field.maxLength }) as never);
    case "image": return Fields.Image(defined({ ...common, folder: field.folder, maxLength: field.maxLength }) as never);
    case "integer": return Fields.Integer(defined({ ...common, min: field.min, max: field.max }) as never);
    case "boolean": return Fields.Boolean(defined(common) as never);
    case "selection": return Fields.Selection(field.choices as never, defined(common) as never);
    case "datetime": return Fields.DateTime(defined(common) as never);
    case "many2one": return Fields.Many2one(field.target, defined({ ...common, onDelete: field.onDelete }) as never);
  }
}
