import "server-only";
import { createModelService } from "@/lib/orm/service";
import { FlotaVehicleRepository } from "@/generated/orm/bindings/flota/FlotaVehicle.store";
import { flotaVehicleModel as recordModel } from "./Vehicle";

export const recordService = createModelService(recordModel, FlotaVehicleRepository, { list: {"fields":["name","active",
    "plate",
  ],"searchFields":[],"sortable":["name","active",
    "plate",
  ],"groupable":["name","active"],"filterable":["name","active",
    "plate",
  ]}, audit: true, relations: { name: async request => (await import("../schemas/vehicle.ui")).recordUI.lookups.name(request) } });
