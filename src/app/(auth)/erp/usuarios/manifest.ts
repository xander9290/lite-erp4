import { ShieldCheck } from "lucide-react";
import { defineApplication } from "@/lib/applications/manifest";

export const usersManifest = defineApplication({
  id: "usuarios",
  name: "Usuarios",
  description: "Cuentas de acceso y permisos del ERP.",
  version: "0.1.0",
  icon: ShieldCheck,
  depends: ["contactos"],
  access: "admin",
  models: ["User"],
  menus: [
    { id: "users", label: "Usuarios", href: "/erp/usuarios" },
  ],
});
