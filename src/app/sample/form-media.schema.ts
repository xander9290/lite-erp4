import { z } from "zod";

export const formMediaSchema = z.object({
  name: z.string().trim().min(1, "Introduce un nombre.").max(120),
  email: z.union([z.literal(""), z.email()]),
  phone: z.string().max(30),
  notes: z.string().max(200),
  image: z.string().url().startsWith("https://").nullable(),
});

export type FormMediaValues = z.infer<typeof formMediaSchema>;
