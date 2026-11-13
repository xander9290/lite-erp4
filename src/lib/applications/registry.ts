import "server-only";

import { icons, type LucideIcon } from "lucide-react";
import { contactsManifest } from "@/app/(auth)/erp/contactos/manifest";
import { appointmentsManifest } from "@/app/(auth)/erp/citas/manifest";
import { usersManifest } from "@/app/(auth)/erp/usuarios/manifest";
import { accessManifest } from "@/app/(auth)/erp/accesos/manifest";
import { createApplicationRegistry, type ApplicationManifest } from "./manifest";
import { scaffoldApplications } from "./scaffolded/registry";
import { installedModules } from "../modules/registry";

/** Declarative modules name their Lucide icon so scripts can load manifests without React. */
function moduleIcon(name: string): LucideIcon {
  const icon = icons[name.split("-").map(part => part[0].toUpperCase() + part.slice(1)).join("") as keyof typeof icons];
  if (!icon) throw new Error(`Icono Lucide desconocido: ${name}.`);
  return icon;
}
const moduleApplications: ApplicationManifest[] = installedModules().map(definition => ({ ...definition.application, icon: moduleIcon(definition.icon) }));

/** Explicit imports keep modules reviewable and avoid filesystem discovery at runtime. */
export const applications = createApplicationRegistry([
  contactsManifest,
  usersManifest,
  accessManifest,
  appointmentsManifest,
  ...scaffoldApplications,
  ...moduleApplications,
]);
