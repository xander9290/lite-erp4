import "server-only";
import { Fields, Model, ModelValidationError as Err, type DisplayRecord, type ModelContext } from "@/lib/orm";

export class Vehicle extends Model {
  name = Fields.Text({ label: "Nombre", required: false, maxLength: 300, tracking: true });
  active = Fields.Boolean({ label: "Activo", default: true, tracking: true });

  plate = Fields.Text({
    label: "Matrícula",
    required: true,
    unique: true,
    maxLength: 20,
    tracking: true,
  });

  modeloId = Fields.Many2one("FlotaModelo", {
    label: "Modelo",
    required: true,
    onDelete: "Restrict",
    tracking: true,
  });

  fabricanteLogo = Fields.Image({
    label: "Fabricante",
    related: "modeloId.fabricanteId.logo",
  });

  normalize(values: Readonly<Record<string, unknown>>) {
    return {
      ...values,
      plate: typeof values.plate === "string" ? values.plate.trim().toUpperCase() : values.plate,
    };
  }

  async beforeSave(values: Record<string, unknown>, context: ModelContext) {
    const modeloId = values.modeloId;

    // SE VALIDA QUE ESTÉ SELECCIONADO UN MODELO
    if (typeof modeloId !== "string" || !modeloId) {
      throw new Err("Selecciona un modelo", {
        modeloId: "El modelo es obligatorio",
      });
    }

    // SE CONSULTA EL MODELO SELECCIONADO
    const modelo = await context.tx.flotaModelo.findUnique({
      where: { id: modeloId },
      select: {
        name: true,
        fabricante: {
          select: { name: true },
        },
      },
    });

    if (!modelo) {
      throw new Err("El modelo ya no existe.", {
        modeloId: "Selecciona otro modelo.",
      });
    }

    // SE FORMA EL NAME DEL MODELO
    return { ...values, name: `[${values.plate}] ${modelo.name} / ${modelo.fabricante.name}` };
  }

  displayName(record: DisplayRecord<Vehicle, "name">): string {
    return record.name ?? "Nuevo vehículo";
  }
  // Define aquí normalize, beforeSave y afterSave cuando tu negocio lo necesite.
}
