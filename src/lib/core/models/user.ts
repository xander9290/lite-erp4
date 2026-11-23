import "server-only";
import { Fields, Model, ModelValidationError, constraint, type ModelContext, type ReactionValues } from "../../orm";
import type { RemoveContext } from "../../orm/context";
import type { Prisma } from "@/generated/prisma/client";
import { newPasswordSchema } from "@/schemas/password.schema";
import { assertUserChange } from "../../auth/policy";
import { hashPassword } from "../../auth/password";
import { z } from "zod";

const loginPattern = /^[a-z0-9._-]+$/;
const activeAdmins = (tx: Prisma.TransactionClient) => tx.user.count({ where: { active: true, isAdmin: true } });

/**
 * Autonomous framework account over the hand-written `users` table.
 * Identity and profile belong to User; business directories are optional applications.
 * The password is write-only and hashed by the repository.
 */
export class User extends Model {
  login = Fields.Text({ label: "Usuario", required: true, unique: true, maxLength: 64, tracking: true, searchable: true });
  name = Fields.Text({ label: "Nombre", required: true, trim: true, minLength: 2, maxLength: 120, tracking: true, searchable: true });
  email = Fields.Text({ label: "Correo", trim: true, maxLength: 254, tracking: true, searchable: true });
  phone = Fields.Text({ label: "Teléfono", trim: true, maxLength: 40, tracking: true });
  avatarUrl = Fields.Image({ label: "Avatar", folder: "avatars" });
  password = Fields.Text({ label: "Contraseña", writeOnly: true, trim: false, maxLength: 200 });
  active = Fields.Boolean({ label: "Activo", default: true, tracking: true });
  isAdmin = Fields.Boolean({ label: "Administrador", default: false, tracking: true });
  lastLogin = Fields.DateTime({ label: "Último acceso" });

  normalize(values: Readonly<Record<string, unknown>>) {
    return { ...values, login: typeof values.login === "string" ? values.login.trim().toLowerCase() : values.login };
  }

  @constraint("login")
  validLogin(values: ReactionValues) {
    if (typeof values.login === "string" && !loginPattern.test(values.login)) throw new ModelValidationError("Revisa el usuario.", { login: "Usa letras, números, puntos, guiones o guiones bajos." });
  }

  @constraint("email")
  validEmail(values: ReactionValues) {
    if (typeof values.email === "string" && values.email && !z.email().safeParse(values.email).success) throw new ModelValidationError("Revisa el correo.", { email: "Escribe un correo válido." });
  }

  @constraint("password")
  validPassword(values: ReactionValues) {
    if (typeof values.password !== "string" || !values.password) return;
    const result = newPasswordSchema.safeParse(values.password);
    if (!result.success) throw new ModelValidationError("Revisa la contraseña.", { password: result.error.issues[0].message });
  }

  async beforeSave(values: Record<string, unknown>, context: ModelContext) {
    if (context.operation === "create" && !values.password) throw new ModelValidationError("Escribe una contraseña.", { password: "La contraseña debe tener al menos 8 caracteres." });
    if (context.operation === "update" && context.previous && context.id) {
      const previous = context.previous as unknown as { active: boolean; isAdmin: boolean };
      const violation = assertUserChange(context.actor.id, { id: context.id, active: previous.active, isAdmin: previous.isAdmin }, { active: values.active === true, isAdmin: values.isAdmin === true }, await activeAdmins(context.tx));
      if (violation) throw new ModelValidationError(violation);
    }
    return { ...values };
  }

  async beforeRemove(record: Readonly<Record<string, unknown>>, context: RemoveContext) {
    if (context.id === context.actor.id) throw new ModelValidationError("No puedes eliminar tu propia cuenta.");
    if (record.active && record.isAdmin && await activeAdmins(context.tx) <= 1) throw new ModelValidationError("Debe existir al menos un administrador activo.");
  }
}

/** Adapter options of the native repository (server-only, see core manifest). */
export const userRepository = {
  writeOnly: { password: (value: string) => hashPassword(value) },
  readOnly: ["lastLogin"],
  // A changed credential, login, status or role invalidates existing sessions (JWT sessionVersion).
  async beforeUpdate(tx: Prisma.TransactionClient, id: string, values: Readonly<Record<string, unknown>>) {
    const current = await tx.user.findUnique({ where: { id }, select: { login: true, active: true, isAdmin: true } });
    if (!current) return {};
    const revoke = Boolean(values.password) || current.login !== values.login || current.active !== values.active || current.isAdmin !== values.isAdmin;
    return revoke ? { sessionVersion: { increment: 1 } } : {};
  },
};
