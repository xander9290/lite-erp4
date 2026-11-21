import "server-only";
import { defineModule, nativeModelNames } from "../modules/define";
import { Partner } from "./models/partner";
import { User, userRepository } from "./models/user";

/**
 * Native framework module (Odoo `base`): shared people models over the hand-written
 * `partners`/`users` schema. Always registered, never in the app drawer and never installed
 * or uninstalled by the module manager; applications such as Ajustes and Contactos present it.
 */
const core = defineModule({
  id: "core",
  name: "Base",
  icon: "database",
  native: true,
  models: {
    partner: { model: Partner, name: "Partner", table: "partners", route: "/erp/contactos",
      views: { form: () => import("@/app/(auth)/erp/contactos/views/ContactForm"), list: () => import("@/app/(auth)/erp/contactos/views/ContactList") },
    },
    // Accounts: admin only (no grant). Contact fields are delegated to its Partner.
    user: {
      model: User, name: "User", table: "users", repository: userRepository, route: "/erp/ajustes/usuarios",
      views: { form: () => import("@/app/(auth)/erp/ajustes/usuarios/views/UserForm"), list: () => import("@/app/(auth)/erp/ajustes/usuarios/views/UserList") },
      inherits: { relation: "partner", label: "Contacto", fields: ["name", "email", "phone", "avatarUrl"] },
      list: { fields: ["login", "name", "email", "avatarUrl", "active", "isAdmin", "lastLogin"], searchFields: ["login", "name", "email"], sortable: ["login", "name", "active", "isAdmin", "lastLogin"], filterable: ["login", "name", "active", "isAdmin", "lastLogin"], groupable: ["active", "isAdmin"] },
    },
  },
});

// Links from other modules (extensions) resolve native names from this table: keep them aligned.
for (const model of core.models) if (nativeModelNames[model.id] !== model.contract.name) throw new Error(`${model.id}: actualiza nativeModelNames.`);

export default core;
