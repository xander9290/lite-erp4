import "server-only";
import { Fields, Model, defineModel, onchange, depends, displayName, type ReactionValues, type ReactionContext, type DisplayRecord, ModelValidationError } from "@/lib/orm";

import { flotaModeloModel } from "./Modelo";

export class FlotaVehicle extends Model {
  name = Fields.Many2one("FlotaModelo", {
    required: true,
    label: "Modelo",
    onDelete: "Restrict",
  });
  plate = Fields.Text({
    label: "Matrícula",
    unique: true,
    maxLength: 20,
  });
  active = Fields.Boolean({ label: "Activo", default: true, tracking: true });
  readonly preview = {
    fabricanteAvatar: Fields.Image({folder:"fabricantes",label:"Fabricante"}),
    fabricanteNombre: Fields.Text({label:"Fabricante"}),
  };

  normalize(values:Readonly<Record<string,unknown>>) {
    return {...values,plate:typeof values.plate==="string"?values.plate.toUpperCase():values.plate};
  }

  @onchange({fields:["plate"],writes:["plate"]})
  normalizePlate(values:ReactionValues) {
    return {plate:typeof values.plate==="string"?values.plate.trim().toUpperCase():null};
  }

  @depends({fields:["name"],preview:["fabricanteAvatar","fabricanteNombre"]})
  async fabricantePreview(values:ReactionValues,{tx}:ReactionContext) {
    if(typeof values.name!=="string"||!values.name) return {fabricanteAvatar:null,fabricanteNombre:null};
    const modelo=await tx.flotaModelo.findUnique({where:{id:values.name},select:{fabricante:{select:{avatar:true,name:true}}}});
    if(!modelo) throw new ModelValidationError("El modelo seleccionado ya no está disponible.");
    return {fabricanteAvatar:modelo.fabricante.avatar,fabricanteNombre:modelo.fabricante.name};
  }

  readonly displayRelations={nameRecord:flotaModeloModel};

  @displayName("plate","nameRecord.name","nameRecord.fabricante.name")
  vehicleLabel(record:DisplayRecord<FlotaVehicle,"plate"|"nameRecord.name"|"nameRecord.fabricante.name">):string {
    return [record.nameRecord.fabricante.name,record.nameRecord.name,record.plate].filter(Boolean).join(" · ");
  }
}

export const flotaVehicleModel = defineModel(FlotaVehicle, { name: "FlotaVehicle", table: "flota_vehicle" });
