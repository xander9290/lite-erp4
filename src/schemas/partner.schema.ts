import { z } from "zod";

/** Shared contact image; User and future partner roles use the same stored URL. */
export const avatarUrlSchema = z.url({ protocol: /^https$/, error: "Avatar: usa una URL HTTPS válida." })
  .max(2048, "Avatar: la URL es demasiado larga.").nullable();
