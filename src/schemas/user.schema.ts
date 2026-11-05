import { z } from "zod";
import { loginSchema } from "./login.schema";
import { avatarUrlSchema } from "./partner.schema";

export const userSchema = z.strictObject({
  id: z.string().min(1).max(100).optional(),
  revision: z.string().max(40),
  login: loginSchema.shape.login,
  name: z.string().trim().min(2, "Nombre: mínimo 2 caracteres.").max(120),
  email: z.string().trim().max(254).refine(value => !value || z.email().safeParse(value).success, "Escribe un correo válido."),
  phone: z.string().trim().max(40),
  avatarUrl: avatarUrlSchema,
  password: z.string().refine(value => new TextEncoder().encode(value).length <= 72, "Contraseña: máximo 72 bytes."),
  active: z.boolean(),
  isAdmin: z.boolean(),
}).superRefine((value, context) => {
  if ((!value.id || value.password) && value.password.length < 8) context.addIssue({ code: "custom", path: ["password"], message: "La nueva contraseña debe tener al menos 8 caracteres." });
  if (value.id && !z.iso.datetime().safeParse(value.revision).success) context.addIssue({ code: "custom", path: ["revision"], message: "Recarga el usuario antes de guardar." });
});
export type UserValues = z.infer<typeof userSchema>;
export const newUserDefaults: UserValues = { revision: "", login: "", name: "", email: "", phone: "", avatarUrl: null, password: "", active: true, isAdmin: false };
