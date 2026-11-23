import { z } from "zod";
import { loginSchema } from "./login.schema";
import { userProfileShape } from "./user-profile.schema";
import { newPasswordSchema } from "./password.schema";

export const userSchema = z.strictObject({
  id: z.string().min(1).max(100).optional(),
  revision: z.string().max(40),
  login: loginSchema.shape.login,
  ...userProfileShape,
  password: newPasswordSchema.or(z.literal("")),
  active: z.boolean(),
  isAdmin: z.boolean(),
}).superRefine((value, context) => {
  if (!value.id && !value.password) context.addIssue({ code: "custom", path: ["password"], message: "La contraseña debe tener al menos 8 caracteres." });
  if (value.id && !z.iso.datetime().safeParse(value.revision).success) context.addIssue({ code: "custom", path: ["revision"], message: "Recarga el usuario antes de guardar." });
});
export type UserValues = z.infer<typeof userSchema>;
export const newUserDefaults: UserValues = { revision: "", login: "", name: "", email: "", phone: "", avatarUrl: null, password: "", active: true, isAdmin: false };
