import { z } from "zod";

export const dialogSampleSchema = z.object({
  id: z.string().optional(), revision: z.string().optional(),
  name: z.string().trim().min(1, "Escribe un nombre.").max(80),
  note: z.string().max(200).optional(),
});
export type DialogSampleValues = z.infer<typeof dialogSampleSchema>;
