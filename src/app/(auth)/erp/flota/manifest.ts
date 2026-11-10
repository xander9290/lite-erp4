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
  menus: [
    {
      id: "main-menu",
      label: "Menú",
      items: [
        {
          id: "vehicles",
          label: "Vehículos",
          href: "/erp/flota",
          access: "admin",
          match: "exact",
        },
        {
          id: "my-vehicles",
          label: "Mis vehículos",
          href: "/erp/flota/mis-vehiculos",
          access: "admin",
          match: "exact",
        },
        {
          id: "my-active-vehicles",
          label: "Mis vehículos activos",
          href: "/erp/flota/mis-vehiculos-activos",
          access: "admin",
          match: "exact",
        },
      ],
    },
  ],
});
