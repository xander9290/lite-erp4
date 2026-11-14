import { LayoutGrid } from "lucide-react";
import { defineApplication } from "@/lib/applications/manifest";

export const modulesManifest = defineApplication({
  id: "modulos",
  name: "Módulos",
  description: "Aplicaciones disponibles, instalación y dependencias.",
  version: "0.1.0",
  icon: LayoutGrid,
  depends: [],
  access: "admin",
  models: [],
  menus: [{ id: "catalogo", label: "Módulos", href: "/erp/modulos" }],
});
