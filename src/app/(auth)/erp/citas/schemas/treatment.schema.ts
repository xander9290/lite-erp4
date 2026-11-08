import { z } from "zod";

export const treatmentSchema = z.strictObject({
  id: z.string().trim().min(1).max(100).optional(),
  performedAt: z.iso.datetime({ error: "Tratamiento: usa una fecha y hora ISO UTC válida." })
    .nullable().refine(value => value !== null, "Selecciona cuándo se realizó el tratamiento."),
  procedure: z.string().trim().min(1, "Describe el procedimiento realizado.")
    .max(1000, "Procedimiento: máximo 1000 caracteres."),
  observations: z.string().trim().max(10000, "Observaciones del tratamiento: máximo 10000 caracteres."),
});

export const treatmentsSchema = z.array(treatmentSchema).max(100, "Máximo 100 tratamientos por cita.")
  .superRefine((lines, context) => {
    const seen = new Set<string>();
    lines.forEach((line, index) => {
      if (line.id && seen.has(line.id)) {
        context.addIssue({ code: "custom", path: [index, "id"], message: "El tratamiento aparece más de una vez." });
      }
      if (line.id) seen.add(line.id);
    });
  });

export type TreatmentInput = z.input<typeof treatmentSchema>;
export type TreatmentValues = z.output<typeof treatmentSchema>;

/** Each row gets fresh values; the performed date is chosen explicitly. */
export function createTreatment(): TreatmentInput {
  return { performedAt: null, procedure: "", observations: "" };
}
