import "server-only";
import { defineModel, Fields, Model } from "@/lib/orm";

export class FlotaFabricante extends Model {
  name = Fields.Text({
    label: "Nombre",
    required: true,
    unique: true,
    maxLength: 50,
  });

  logo = Fields.Text({
    label: "Logotipo",
    maxLength: 30,
  });
}

export const fabricanteFlotaModel = defineModel(FlotaFabricante, {
  name: "FlotaFabricante",
  table: "flota_fabricante",
});
