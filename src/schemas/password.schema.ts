import { z } from "zod";

/** Creation/reset policy; credentials already stored keep their original login support. */
export const newPasswordSchema = z.string()
  .min(4, "La contraseña debe tener al menos 4 caracteres.")
  .max(8, "La contraseña debe tener como máximo 8 caracteres.");
