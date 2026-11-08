import { z } from "zod";
import { loginSchema } from "./login.schema";
import { partnerContactShape } from "./partner.schema";

export const userSchema = z.strictObject({
  id: z.string().min(1).max(100).optional(),
  revision: z.string().max(40),
  partnerRevision: z.iso.datetime().nullable(),
  login: loginSchema.shape.login,
  ...partnerContactShape,
  password: z.string().refine(value => new TextEncoder().encode(value).length <= 72, "Contraseña: máximo 72 bytes."),
  active: z.boolean(),
  isAdmin: z.boolean(),
}).superRefine((value, context) => {
  if ((!value.id || value.password) && value.password.length < 8) context.addIssue({ code: "custom", path: ["password"], message: "La nueva contraseña debe tener al menos 8 caracteres." });
  if (value.id && !z.iso.datetime().safeParse(value.revision).success) context.addIssue({ code: "custom", path: ["revision"], message: "Recarga el usuario antes de guardar." });
  if (!value.id && value.partnerRevision !== null) context.addIssue({ code: "custom", path: ["partnerRevision"], message: "Un usuario nuevo no debe tener una revisión de contacto previa." });
});
export type UserValues = z.infer<typeof userSchema>;
export const newUserDefaults: UserValues = { revision: "", partnerRevision: null, login: "", name: "", email: "", phone: "", avatarUrl: null, password: "", active: true, isAdmin: false };
