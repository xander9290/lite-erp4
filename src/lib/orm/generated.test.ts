import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { FleetVehicleSchema, createFleetVehicleDefaults } from "@/generated/orm/flota/FleetVehicle.schema";
import { vehicleModel } from "./examples/fleet-vehicle";

test("generated client contract matches server validation and defaults", () => {
  assert.deepEqual(createFleetVehicleDefaults(), vehicleModel.createDefaults());
  const valid = { ...createFleetVehicleDefaults(), plate: " ABC-123 ", brand: "Marca" };
  for (const patch of [{}, { mileage: 2147483648 }, { mileage: -1 }, { active: false }, { plate: null }, { driverId: " partner-id " }, { state: "other" }, { nextServiceAt: "2026-11-07T15:00:00Z" }, { nextServiceAt: "2026-11-07T09:00:00-06:00" }, { password: "injected" }]) {
    const input = { ...valid, ...patch };
    const client = FleetVehicleSchema.safeParse(input), server = vehicleModel.schema.safeParse(input);
    assert.equal(client.success, server.success);
    if (client.success && server.success) assert.deepEqual(client.data, server.data);
    if (!client.success && !server.success) assert.deepEqual(client.error.issues, server.error.issues);
  }
});

test("generated validation imports without React server conditions or the model class", () => {
  const result = spawnSync(process.execPath, ["--import", "tsx", "--input-type=module", "-e", `import { FleetVehicleSchema, createFleetVehicleDefaults } from './src/generated/orm/flota/FleetVehicle.schema.ts'; if (FleetVehicleSchema.safeParse(createFleetVehicleDefaults()).success) process.exit(1);`], { cwd: process.cwd(), encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
});
