import "server-only";
import { User } from "@/lib/core/models/user";
import { extendModel } from "@/lib/modules/extend";
import {
  action,
  type ActionContext,
  type ActionRecord,
  Fields,
  type ModelContext,
  ModelValidationError,
} from "@/lib/orm";

export const UserDirectory = extendModel(User, (Base) => {
  class UserDirectory extends Base {
    partnerId = Fields.Many2one("DirectoryPartner", {
      label: "Contacto",
      unique: true,
      onDelete: "Restrict",
    });

    @action({ label: "Crear contacto" })
    async crearContacto(
      record: ActionRecord<UserDirectory>,
      context: ActionContext,
    ) {
      // SE VALIDA SI YA HAY UN CONTACTO ASOCIADO
      if (record.partnerId)
        throw new ModelValidationError(
          "El usuario ya tiene un contacto vinculado",
        );

      // SE VALIDAD SI YA EXISTE UN CONTACTO CON EL MISMO CORREO
      if (record.email) {
        const [existente] = await context.env.DirectoryPartner.search(
          (d) => d.eq("emails", record.email),
          { fields: ["name"], limit: 1 },
        );
        if (existente) {
          throw new ModelValidationError(
            `Ya existe el contacto "${existente.name}" con ese correo; vincúlalo en el campo contacto.`,
          );
        }
      }

      // SE CREA EL CONTACTO PASANDO LAS RESTRICCIONES
      const partner = await context.env.DirectoryPartner.create({
        name: record.name,
        emails: record.email ?? null,
        phones: record.phone ?? null,
        image: record.avatarUrl ?? null,
        partnerType: "person",
      });

      return { partnerId: partner.id };
    }

    async afterSave(record: Record<string, unknown>, context: ModelContext) {
      await super.afterSave?.(record, context); // respeta hooks del modelo base
      const partnerId = record.partnerId as string | null;
      if (context.operation !== "update" || !partnerId) return;
      if (context.previous?.avatarUrl === record.avatarUrl) return; // no cambió
      await context.env.DirectoryPartner.write(partnerId, {
        image: (record.avatarUrl as string | null) ?? null,
      });
    }
  }

  return UserDirectory;
});
