import { z } from "zod";
import { DentalAppointmentStatus } from "@/generated/prisma/enums";
import { treatmentsSchema } from "./treatment.schema";

export const appointmentStatusOptions = [
  { value: DentalAppointmentStatus.SCHEDULED, label: "Programada" },
  { value: DentalAppointmentStatus.ATTENDED, label: "Atendida" },
  { value: DentalAppointmentStatus.CANCELLED, label: "Cancelada" },
] as const;

export const appointmentIdSchema = z.string().trim().min(1).max(100);

export const appointmentSchema = z.strictObject({
  id: appointmentIdSchema.optional(),
  revision: z.string().max(40),
  patientId: z.string().trim().min(1, "Selecciona un paciente.").max(100)
    .nullable().refine(value => value !== null, "Selecciona un paciente."),
  reason: z.string().trim().min(1, "Escribe el motivo de la cita.").max(1000, "Motivo: máximo 1000 caracteres."),
  scheduledAt: z.iso.datetime({ error: "Fecha y hora: usa un ISO UTC válido." })
    .nullable().refine(value => value !== null, "Selecciona la fecha y hora de la cita."),
  observations: z.string().trim().max(10000, "Observaciones: máximo 10000 caracteres."),
  status: z.enum(DentalAppointmentStatus),
  treatments: treatmentsSchema,
}).superRefine((values, context) => {
  if (values.id && !z.iso.datetime().safeParse(values.revision).success) {
    context.addIssue({ code: "custom", path: ["revision"], message: "Recarga la cita antes de guardar." });
  }
  if (!values.id && values.revision !== "") {
    context.addIssue({ code: "custom", path: ["revision"], message: "Una cita nueva no debe tener una revisión previa." });
  }
  if (!values.id) values.treatments.forEach((line, index) => {
    if (line.id) context.addIssue({ code: "custom", path: ["treatments", index, "id"], message: "Una cita nueva sólo acepta tratamientos nuevos." });
  });
});

export type AppointmentInput = z.input<typeof appointmentSchema>;
export type AppointmentValues = z.output<typeof appointmentSchema>;

/** Empty controls are intentional; a patient, reason and date/time are required on submit. */
export const newAppointmentDefaults: AppointmentInput = {
  revision: "",
  patientId: null,
  reason: "",
  scheduledAt: null,
  observations: "",
  status: DentalAppointmentStatus.SCHEDULED,
  treatments: [],
};
