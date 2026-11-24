import { z } from "zod";

export const formDensitySchema = z.object({
  name: z.string().trim().min(1, "Introduce un nombre.").max(120),
  email: z.union([z.literal(""), z.email()]),
  type: z.enum(["person", "company"]),
  category: z.enum(["customer", "supplier"]),
  quantity: z.number().nullable(),
  date: z.string().nullable(),
  active: z.boolean(),
  countryId: z.string().nullable(),
  tagIds: z.array(z.string()).max(5),
  notes: z.string().max(500),
  image: z.string().nullable(),
});
export type FormDensityValues = z.infer<typeof formDensitySchema>;
