import { CarIcon } from "lucide-react";
import { defineApplication } from "@/lib/applications/manifest";

export const manifest = defineApplication({
  id: "flota",
  name: "Flota",
  description: "Aplicación Flota.",
  version: "0.1.0",
  icon: CarIcon,
  access: "admin",
  depends: [],
  models: ["FlotaRecord", "FlotaFabricante", "FlotaModelo", "FlotaVehicle"],
  menus: [
    {
      id: "vehicle-list",
      label: "Vehículos",
      href: "/erp/flota/vehicle",
      access: "admin",
      match: "exact",
    },
    {
      id: "flota-configuracion",
      label: "Configuración",
      access: "admin",
      items: [
        {
          id: "fabricante-list",
          label: "Fabricantes",
          href: "/erp/flota/fabricante",
        },
        {
          id: "modelo-list",
          label: "Modelos",
          href: "/erp/flota/modelo",
          access: "admin",
          match: "exact",
        },
      ],
    },
  ],
});
