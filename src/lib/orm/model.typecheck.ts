/** Compile-time contract checks. Included by tsc; not executed as a runtime test. */
import type { Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Fields, Model, defineModel, type ModelInput, type ModelValues } from "./index";
import { vehicleModel, type VehicleInput, type VehicleValues } from "./examples/fleet-vehicle";
import type { FleetVehicleInput, FleetVehicleValues } from "@/generated/orm/flota/FleetVehicle.schema";

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;
type Assert<T extends true> = T;
export type InputMayBeEmpty = Assert<Equal<VehicleInput["mileage"], number | null>>;
export type ValidatedMileage = Assert<Equal<VehicleValues["mileage"], number>>;
export type RequiredPlate = Assert<Equal<VehicleValues["plate"], string>>;
export type OptionalDriver = Assert<Equal<VehicleValues["driverId"], string | null>>;
export type LiteralSelection = Assert<Equal<VehicleValues["state"], "available" | "maintenance">>;
export type BooleanDoesNotNarrowToDefault = Assert<Equal<VehicleValues["active"], boolean>>;
export type NoMethodsInValues = Assert<Equal<keyof VehicleValues, "plate" | "brand" | "mileage" | "driverId" | "active" | "state" | "nextServiceAt">>;
export type ClientInputMatchesServer = Assert<Equal<VehicleInput, FleetVehicleInput>>;
export type ClientValuesMatchServer = Assert<Equal<VehicleValues, FleetVehicleValues>>;

export const resolver: Resolver<VehicleInput, unknown, VehicleValues> = zodResolver(vehicleModel.schema);
export const defaults: VehicleInput = vehicleModel.createDefaults();
export interface VehicleSummary { plate: string; driverName: string }
export type VehicleWithSummary = VehicleValues & { summary: VehicleSummary };

export const optional = defineModel(class Optional extends Model {
  text = Fields.Text();
  count = Fields.Integer();
  state = Fields.Selection([{ value: "a", label: "A" }, { value: "b", label: "B" }]);
  method() { return true; }
}, { name: "Optional", table: "optional" });
export type OptionalText = Assert<Equal<ModelValues<typeof optional>["text"], string | null>>;
export type OptionalSelection = Assert<Equal<ModelInput<typeof optional>["state"], "a" | "b" | null>>;
// @ts-expect-error Validated required numbers cannot be null.
export const invalidMileage: VehicleValues["mileage"] = null;
// @ts-expect-error Selection preserves the declared union.
export const invalidState: VehicleValues["state"] = "unknown";
// @ts-expect-error Methods are not part of form data.
export type ExcludedMethod = ModelValues<typeof optional>["method"];
// @ts-expect-error Defaults must belong to the selection.
export const invalidSelectionDefault = Fields.Selection([{ value: "a", label: "A" }], { default: "b" });
