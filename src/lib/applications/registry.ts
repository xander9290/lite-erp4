import "server-only";

import { contactsManifest } from "@/app/(auth)/erp/contactos/manifest";
import { appointmentsManifest } from "@/app/(auth)/erp/citas/manifest";
import { usersManifest } from "@/app/(auth)/erp/usuarios/manifest";
import { createApplicationRegistry } from "./manifest";
import { scaffoldApplications } from "./scaffolded/registry";

/** Explicit imports keep modules reviewable and avoid filesystem discovery at runtime. */
export const applications = createApplicationRegistry([
  contactsManifest,
  usersManifest,
  appointmentsManifest,
  ...scaffoldApplications,
]);
