import "server-only";
import { Fields, Model, defineModel, type ModelInput, type ModelValues } from "../index";

/** Executable declaration example, not an installed app or a Prisma model yet. */
export class Vehicle extends Model {
  plate = Fields.Text({ label: "Placas", required: true, unique: true, maxLength: 20 });
  brand = Fields.Text({ label: "Marca", required: true, maxLength: 100 });
  mileage = Fields.Integer({ label: "Kilometraje", required: true, min: 0, default: 0 });
  driverId = Fields.Many2one("Partner", { label: "Conductor", onDelete: "Restrict" });
  active = Fields.Boolean({ label: "Activo", default: true });
  state = Fields.Selection([
    { value: "available", label: "Disponible" },
    { value: "maintenance", label: "En mantenimiento" },
  ], { label: "Estado", required: true, default: "available" });
  nextServiceAt = Fields.DateTime({ label: "Próximo servicio" });
}

export const vehicleModel = defineModel(Vehicle, { name: "FleetVehicle", table: "fleet_vehicles" });
export type VehicleInput = ModelInput<typeof vehicleModel>;
export type VehicleValues = ModelValues<typeof vehicleModel>;
