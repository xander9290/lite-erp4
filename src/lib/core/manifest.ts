import "server-only";
import { defineModule, nativeModelNames } from "../modules/define";
import { User, userRepository } from "./models/user";

/** Framework accounts only. Business directories are optional declarative modules. */
const core = defineModule({
  id: "core",
  name: "Base",
  icon: "database",
  native: true,
  models: {
    user: {
      model: User,
      name: "User",
      table: "users",
      repository: userRepository,
      route: "/erp/ajustes/usuarios",
      views: {
        form: () => import("@/app/(auth)/erp/ajustes/usuarios/views/UserForm"),
        list: () => import("@/app/(auth)/erp/ajustes/usuarios/views/UserList"),
      },
      list: {
        fields: [
          "login",
          "name",
          "email",
          "avatarUrl",
          "active",
          "isAdmin",
          "lastLogin",
        ],
        searchFields: ["login", "name", "email"],
        sortable: ["login", "name", "active", "isAdmin", "lastLogin"],
        filterable: ["login", "name", "active", "isAdmin", "lastLogin"],
        groupable: ["active", "isAdmin"],
      },
    },
  },
});

// Links from other modules (extensions) resolve native names from this table: keep them aligned.
for (const model of core.models)
  if (nativeModelNames[model.id] !== model.contract.name)
    throw new Error(`${model.id}: actualiza nativeModelNames.`);

export default core;
