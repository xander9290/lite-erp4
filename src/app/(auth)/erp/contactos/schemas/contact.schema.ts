import { z } from "zod";
import { partnerContactShape } from "@/schemas/partner.schema";

export const contactIdSchema = z.string().trim().min(1).max(100);

export const contactSchema = z.strictObject({
  id: contactIdSchema.optional(),
  revision: z.string().max(40),
  ...partnerContactShape,
}).superRefine((values, context) => {
  if (values.id && !z.iso.datetime().safeParse(values.revision).success) {
    context.addIssue({ code: "custom", path: ["revision"], message: "Recarga el contacto antes de guardar." });
  }
  if (!values.id && values.revision !== "") {
    context.addIssue({ code: "custom", path: ["revision"], message: "Un contacto nuevo no debe tener una revisión previa." });
  }
});

export type ContactValues = z.infer<typeof contactSchema>;

/** Empty RHF values; the required name is validated when the form is submitted. */
export const newContactDefaults: ContactValues = {
  revision: "",
  name: "",
  email: "",
  phone: "",
  avatarUrl: null,
};
