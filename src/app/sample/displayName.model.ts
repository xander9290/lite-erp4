import "server-only";
import { Fields, Model, defineModel } from "@/lib/orm";

class SampleVehicle extends Model {
  name = Fields.Text({ required: true });
  plate = Fields.Text({ required: true });
  displayFields = ["name", "plate"] as const;
  displayName(record: Readonly<Record<string, unknown>>) {
    return `${record.name} · ${record.plate}`;
  }
}
export const sampleVehicle = defineModel(SampleVehicle, { name: "SampleVehicle", table: "sample_vehicle" });
export const sampleVehicles = [
  { id: "demo-1", name: "Corolla", plate: "ABC-123" },
  { id: "demo-2", name: "Hilux", plate: "XYZ-456" },
];
