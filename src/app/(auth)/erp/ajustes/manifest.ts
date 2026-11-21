import { Settings } from "lucide-react";
import { defineApplication } from "@/lib/applications/manifest";

/** Administration of the ERP: accounts (core.user), access control and modules. */
export const settingsManifest = defineApplication({
  id: "ajustes",
  name: "Ajustes",
  description: "Usuarios, control de accesos y módulos del ERP.",
  version: "0.1.0",
  icon: Settings,
  depends: [],
  access: "admin",
  models: ["User"],
  menus: [
    { id: "usuarios", label: "Usuarios", href: "/erp/ajustes/usuarios" },
    { id: "accesos", label: "Grupos", href: "/erp/ajustes/accesos" },
    { id: "modulos", label: "Módulos", href: "/erp/ajustes/modulos" },
  ],
});
