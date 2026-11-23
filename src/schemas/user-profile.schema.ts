import { z } from "zod";

/** HTTPS avatar URL shared by profile forms and uploads. */
export const avatarUrlSchema = z.url({ protocol: /^https$/, error: "Avatar: usa una URL HTTPS válida." })
  .max(2048, "Avatar: la URL es demasiado larga.").nullable();

/** Account profile values owned by User; business directories define their own data. */
export const userProfileShape = {
  name: z.string().trim().min(2, "Nombre: mínimo 2 caracteres.").max(120),
  email: z.string().trim().max(254).refine(value => !value || z.email().safeParse(value).success, "Escribe un correo válido."),
  phone: z.string().trim().max(40),
  avatarUrl: avatarUrlSchema,
};
