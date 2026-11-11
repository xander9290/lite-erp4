import { z } from "zod";
import { partnerContactShape } from "./partner.schema";
import { newPasswordSchema } from "./password.schema";

export const profileSchema = z.strictObject({
  revision: z.iso.datetime(),
  partnerRevision: z.iso.datetime().nullable(),
  ...partnerContactShape,
});
export type ProfileValues = z.infer<typeof profileSchema>;
export type ProfileRecord = { values: ProfileValues; account: { login: string; isAdmin: boolean } };

const password = z.string().refine(value => new TextEncoder().encode(value).length <= 72, "Contraseña: máximo 72 bytes.");
export const changePasswordSchema = z.strictObject({
  currentPassword: password.min(1, "Escribe tu contraseña actual."),
  newPassword: newPasswordSchema,
  confirmPassword: password.min(1, "Confirma la nueva contraseña."),
}).superRefine((values, context) => {
  if (values.newPassword !== values.confirmPassword) context.addIssue({ code: "custom", path: ["confirmPassword"], message: "Las contraseñas no coinciden." });
  if (values.newPassword && values.currentPassword === values.newPassword) context.addIssue({ code: "custom", path: ["newPassword"], message: "Elige una contraseña diferente de la actual." });
});
export type ChangePasswordValues = z.infer<typeof changePasswordSchema>;
export const emptyPasswordValues: ChangePasswordValues = { currentPassword: "", newPassword: "", confirmPassword: "" };
