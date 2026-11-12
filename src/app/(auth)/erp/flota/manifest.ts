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
  models: ["FlotaRecord", "FlotaFabricante", "FlotaModelo", "FlotaVehicle"],
  menus: [
    {
      id: "flota",
      label: "Flota",
      href: "/erp/flota/vehicle",
      access: "authenticated",
      match: "exact",
    },
    {
      id: "flota-settings",
      label: "Configuración",
      access: "authenticated",
      match: "exact",
      items: [
        {
          id: "fabricantes",
          label: "Fabricantes",
          href: "/erp/flota/fabricante",
          access: "admin",
          match: "exact",
        },
        {
          id: "modelos",
          label: "Modelos",
          href: "/erp/flota/modelo",
          access: "admin",
          match: "exact",
        },
      ],
    },
  ],
});
