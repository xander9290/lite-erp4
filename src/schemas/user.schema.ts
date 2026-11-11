import { z } from "zod";
import { loginSchema } from "./login.schema";
import { partnerContactShape } from "./partner.schema";
import { newPasswordSchema } from "./password.schema";

export const userSchema = z.strictObject({
  id: z.string().min(1).max(100).optional(),
  revision: z.string().max(40),
  partnerRevision: z.iso.datetime().nullable(),
  login: loginSchema.shape.login,
  ...partnerContactShape,
  password: newPasswordSchema.or(z.literal("")),
  active: z.boolean(),
  isAdmin: z.boolean(),
}).superRefine((value, context) => {
  if (!value.id && !value.password) context.addIssue({ code: "custom", path: ["password"], message: "La contraseña debe tener al menos 4 caracteres." });
  if (value.id && !z.iso.datetime().safeParse(value.revision).success) context.addIssue({ code: "custom", path: ["revision"], message: "Recarga el usuario antes de guardar." });
  if (!value.id && value.partnerRevision !== null) context.addIssue({ code: "custom", path: ["partnerRevision"], message: "Un usuario nuevo no debe tener una revisión de contacto previa." });
});
export type UserValues = z.infer<typeof userSchema>;
export const newUserDefaults: UserValues = { revision: "", partnerRevision: null, login: "", name: "", email: "", phone: "", avatarUrl: null, password: "", active: true, isAdmin: false };
