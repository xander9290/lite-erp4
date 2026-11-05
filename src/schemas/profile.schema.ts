import { z } from "zod";
import { userSchema } from "./user.schema";

export const profileSchema = z.strictObject({
  revision: z.iso.datetime(),
  partnerRevision: z.iso.datetime().nullable(),
  name: userSchema.shape.name,
  email: userSchema.shape.email,
  phone: userSchema.shape.phone,
  avatarUrl: userSchema.shape.avatarUrl,
});
export type ProfileValues = z.infer<typeof profileSchema>;
export type ProfileRecord = { values: ProfileValues; account: { login: string; isAdmin: boolean } };

const password = z.string().refine(value => new TextEncoder().encode(value).length <= 72, "Contraseña: máximo 72 bytes.");
export const changePasswordSchema = z.strictObject({
  currentPassword: password.min(1, "Escribe tu contraseña actual."),
  newPassword: password.min(8, "La nueva contraseña debe tener al menos 8 caracteres."),
  confirmPassword: password.min(1, "Confirma la nueva contraseña."),
}).superRefine((values, context) => {
  if (values.newPassword !== values.confirmPassword) context.addIssue({ code: "custom", path: ["confirmPassword"], message: "Las contraseñas no coinciden." });
  if (values.newPassword && values.currentPassword === values.newPassword) context.addIssue({ code: "custom", path: ["newPassword"], message: "Elige una contraseña diferente de la actual." });
});
export type ChangePasswordValues = z.infer<typeof changePasswordSchema>;
export const emptyPasswordValues: ChangePasswordValues = { currentPassword: "", newPassword: "", confirmPassword: "" };
