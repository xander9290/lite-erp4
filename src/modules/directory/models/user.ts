import "server-only";
import { User } from "@/lib/core/models/user";
import { extendModel } from "@/lib/modules/extend";
import {
  Fields,
  action,
  ModelValidationError,
  type ActionRecord,
  type ActionContext,
  ModelContext,
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
      if (record.partnerId) {
        throw new ModelValidationError(
          "Este usuario ya tiene un contacto vinculado",
        );
      }

      const email = record.email?.trim() || null;

      if (email && email.length > 200) {
        throw new ModelValidationError(
          "El correo supera los 200 caracteres admitidos por Contacto",
        );
      }

      if (email) {
        const existing = await context.tx.directoryPartner.findFirst({
          where: {
            emails: { equals: email, mode: "insensitive" },
          },
          select: { id: true },
        });

        if (existing) {
          throw new ModelValidationError(
            "Ya existe un contacto con ese correo. Selecciónalo en Contacto.",
          );
        }
      }

      const partner = await context.tx.directoryPartner.create({
        data: {
          name: record.name,
          image: record.avatarUrl,
          emails: email,
          phones: record.phone || null,
          partnerType: "person",
          type: "contact",
          active: true,
          createBy: context.actor.id,
        },
        select: { id: true },
      });

      return { partnerId: partner.id };
    }

    async afterSave(record: Record<string, unknown>, context: ModelContext) {
      await super.afterSave?.(record, context);

      if (typeof record.partnerId !== "string") return;

      const avatar = record.avatarUrl ?? null;
      const anterior = context.previous;

      const cambioAvatar = avatar !== (anterior?.avatarUrl ?? null);

      const cambioContacto = record.partnerId !== anterior?.partnerId;

      if (!cambioAvatar && !cambioContacto) return;

      // Experimento: actualización directa, sin el servicio de Partner.
      await context.tx.directoryPartner.update({
        where: { id: record.partnerId },
        data: {
          image: typeof avatar === "string" ? avatar : null,
        },
      });
    }
  }

  return UserDirectory;
});
