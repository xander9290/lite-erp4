import z from "zod";

export const loginSchema = z.object({
  login: z.string().trim().toLowerCase().min(1, "Usuario es requerido").max(64, "Usuario: máximo 64 caracteres.").regex(/^[a-z0-9._-]+$/, "Usa letras, números, puntos, guiones o guiones bajos."),
  password: z.string().min(1, "La contraseña es requerida").refine(value => new TextEncoder().encode(value).length <= 72, "La contraseña es demasiado larga."),
});

export type LoginSchemaInput = z.input<typeof loginSchema>;
export type LoginSchemaType = z.infer<typeof loginSchema>;

export const loginSchemaDefault: LoginSchemaType = {
  login: "",
  password: "",
};
