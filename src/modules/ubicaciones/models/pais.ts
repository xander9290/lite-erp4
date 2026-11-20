import "server-only";
import {
  Fields,
  Model,
  constraint,
  ModelValidationError as Err,
  type DisplayRecord,
} from "@/lib/orm";

export class Pais extends Model {
  name = Fields.Text({
    label: "Nombre",
    required: true,
    maxLength: 120,
    tracking: true,
  });
  codigo = Fields.Text({
    label: "Código",
    required: true,
    minLength: 2,
    maxLength: 2,
    unique: true,
    tracking: true,
  });
  estadoIds = Fields.One2many("UbicacionesEstado", {
    label: "Estados",
    inverse: "paisId",
    maxRows: 100,
  });
  active = Fields.Boolean({ label: "Activo", default: true, tracking: true });
  displayName(record: DisplayRecord<Pais, "name">): string {
    return record.name;
  }

  normalize(values: Readonly<Record<string, unknown>>) {
    return {
      ...values,
      codigo:
        typeof values.codigo === "string"
          ? values.codigo.trim().toUpperCase()
          : values.codigo,
    };
  }

  @constraint("codigo")
  validarCodigo(values: Readonly<Record<string, unknown>>) {
    if (
      typeof values.codigo !== "string" ||
      !/^[A-Z]{2}$/.test(values.codigo)
    ) {
      throw new Err("Revisa el código del país.", {
        codigo: "Introduce exactamente dos letras.",
      });
    }
  }
}
