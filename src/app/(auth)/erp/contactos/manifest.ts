import { UsersRound } from "lucide-react";
import { contactsNavigation } from "./navigation";
import { defineApplication } from "@/lib/applications/manifest";

export const contactsManifest = defineApplication({
  id: "contactos",
  name: "Contactos",
  description: "Contactos compartidos de empresas, usuarios, clientes y proveedores.",
  version: "0.1.0",
  icon: UsersRound,
  depends: ["ubicaciones", "contactosextra"],
  access: "authenticated",
  models: ["Partner"],
  accessModels: contactsNavigation.accessModels,
  menus: contactsNavigation.menus,
});
