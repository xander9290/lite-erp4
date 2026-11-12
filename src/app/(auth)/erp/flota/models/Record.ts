import "server-only";
import { Fields, Model, defineModel, ModelValidationError as Error, type ModelContext, constraint } from "@/lib/orm";

export class FlotaRecord extends Model {
  name = Fields.Text({ label: "Nombre", required: true, unique: false, trim: true, maxLength: 120, tracking: true });
  plate = Fields.Text({
    label: "Placas",
    tracking: true,
    required: true,
    unique: true,
    maxLength: 20,
  });
  brand = Fields.Text({
    label: "Marca",
    tracking: true,
    maxLength: 80,
  });
  active = Fields.Boolean({ label: "Activo", unique: false, default: true, tracking: true });
  // Reglas de negocio: beforeSave(values, context) y afterSave(record, context).

  normalize(values:Readonly<Record<string,unknown>>) {
    return {...values,plate:typeof values.plate==="string"?values.plate.toUpperCase():values.plate};
  }

  @constraint("plate","active")
  validatePlateChange(values:Readonly<Record<string,unknown>>,context:ModelContext) {
    const previous=context.previous;
    if(previous?.active && typeof previous.plate==="string" && previous.plate.toUpperCase()!==values.plate) {
      throw new Error("Primero debes desactivar el vehículo",{plate:"Desactiva y guarda antes de cambiar las placas"});
    }
  }

  @constraint("brand","active")
  validateBrand(values:Readonly<Record<string,unknown>>,context:ModelContext) {
    if(values.active===true&&!values.brand) {
      const operation=context.operation==="create"?"crear":"actualizar";
      throw new Error(`Para ${operation} un vehículo activo debe tener una marca.`,{brand:"Introduce la marca o desactiva el vehículo"});
    }
  }

  /* afterSave(record: Record<string, unknown>) {
    if (record.name === "PROBAR ROLLBACK") {
      throw new Error("Prueba: se revierte el guardado complete", { name: "Cambia este nombre para guardar" });
    }
  } */
}

export const recordModel = defineModel(FlotaRecord, { name: "FlotaRecord", table: "flota_records" });
