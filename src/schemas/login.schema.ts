import z from "zod";

export const loginSchema = z.object({
  login: z.string().min(1, "Usuario es requerido"),
  password: z.string().min(1, "La contraseña es requerida"),
});

export type LoginSchemaType = z.infer<typeof loginSchema>;

export const loginSchemaDefault: LoginSchemaType = {
  login: "",
  password: "",
};
