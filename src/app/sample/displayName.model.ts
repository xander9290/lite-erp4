import "server-only";
import { Fields, Model, defineModel } from "@/lib/orm";

class SampleVehicle extends Model {
  name = Fields.Text({ required: true });
  plate = Fields.Text({ required: true });
  fabricanteId = Fields.Many2one("SampleManufacturer");
  displayFields = ["name", "plate", "fabricante.name"] as const;
  displayName(record: Readonly<{ name: string; plate: string; fabricante: Readonly<{ name: string }> | null }>) {
    return [record.fabricante?.name, record.name, record.plate].filter(Boolean).join(" · ");
  }
}
export const sampleVehicle = defineModel(SampleVehicle, { name: "SampleVehicle", table: "sample_vehicle" });
export const sampleVehicles = [
  { id: "demo-1", name: "Corolla", plate: "ABC-123", fabricanteId: "brand-1", fabricante: { name: "Toyota" } },
  { id: "demo-2", name: "Bicicleta", plate: "XYZ-456", fabricanteId: null, fabricante: null },
];
