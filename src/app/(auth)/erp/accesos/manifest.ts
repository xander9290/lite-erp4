import { KeyRound } from "lucide-react";
import { defineApplication } from "@/lib/applications/manifest";

export const accessManifest = defineApplication({
  id: "accesos",
  name: "Control de accesos",
  description: "Grupos, permisos por modelo y reglas de registro de los módulos.",
  version: "0.1.0",
  icon: KeyRound,
  depends: ["usuarios"],
  access: "admin",
  models: [],
  menus: [{ id: "grupos", label: "Grupos", href: "/erp/accesos" }],
});
