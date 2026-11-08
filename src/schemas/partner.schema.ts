import { z } from "zod";

/** Shared contact image; User and future partner roles use the same stored URL. */
export const avatarUrlSchema = z.url({ protocol: /^https$/, error: "Avatar: usa una URL HTTPS válida." })
  .max(2048, "Avatar: la URL es demasiado larga.").nullable();

/** Contact data is owned by Partner and shared by every role and application. */
export const partnerContactShape = {
  name: z.string().trim().min(2, "Nombre: mínimo 2 caracteres.").max(120),
  email: z.string().trim().max(254).refine(value => !value || z.email().safeParse(value).success, "Escribe un correo válido."),
  phone: z.string().trim().max(40),
  avatarUrl: avatarUrlSchema,
};
