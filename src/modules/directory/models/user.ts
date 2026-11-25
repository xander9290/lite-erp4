import "server-only";
import { User } from "@/lib/core/models/user";
import { extendModel } from "@/lib/modules/extend";
import { Fields } from "@/lib/orm";

export const UserDirectory = extendModel(User, (Base) => {
  class UserDirectory extends Base {
    partnerId = Fields.Many2one("DirectoryPartner", {
      label: "Contacto",
      unique: true,
      onDelete: "Restrict",
    });
  }

  return UserDirectory;
});
