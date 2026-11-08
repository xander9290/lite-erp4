import { Car } from "lucide-react";
import { defineApplication } from "@/lib/applications/manifest";

export const manifest = defineApplication({
  id: "flota",
  name: "Flota",
  description: "Administración de vehículos",
  version: "0.1.0",
  icon: Car,
  access: "admin",
  depends: [],
  models: ["FlotaRecord"],
});
