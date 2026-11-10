import { UsersRound } from "lucide-react";
import { defineApplication } from "@/lib/applications/manifest";

export const contactsManifest = defineApplication({
  id: "contactos",
  name: "Contactos",
  description: "Contactos compartidos de empresas, usuarios, clientes y proveedores.",
  version: "0.1.0",
  icon: UsersRound,
  depends: [],
  access: "authenticated",
  models: ["Partner"],
  menus: [
    { id: "contacts", label: "Contactos", href: "/erp/contactos" },
  ],
});
