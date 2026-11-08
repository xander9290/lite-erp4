import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { planOne2manyChanges } from "@/lib/one2many/changes";
import type { TreatmentInput, TreatmentValues } from "../schemas/treatment.schema";

/** Clinical data: select only after authorizing access to the appointment/patient. */
export const treatmentFormSelect = {
  id: true, performedAt: true, procedure: true, observations: true,
} satisfies Prisma.DentalTreatmentSelect;

type TreatmentRecord = Prisma.DentalTreatmentGetPayload<{ select: typeof treatmentFormSelect }>;

export function treatmentFormValues(record: TreatmentRecord): TreatmentInput {
  return { id: record.id, performedAt: record.performedAt.toISOString(), procedure: record.procedure, observations: record.observations ?? "" };
}

function treatmentWriteData(values: TreatmentValues, position: number) {
  return {
    performedAt: new Date(values.performedAt), procedure: values.procedure,
    observations: values.observations || null, position,
  } satisfies Prisma.DentalTreatmentCreateWithoutAppointmentInput;
}

export function treatmentCreateData(lines: readonly TreatmentValues[]) {
  if (lines.some(line => line.id !== undefined)) throw new Error("Una cita nueva sólo acepta tratamientos nuevos.");
  return { create: lines.map(treatmentWriteData) } satisfies Prisma.DentalTreatmentCreateNestedManyWithoutAppointmentInput;
}

/** owned is the COMPLETE collection read by the authorized parent service inside its transaction. */
export function treatmentUpdateData(owned: readonly { id: string }[], lines: readonly TreatmentValues[]) {
  const plan = planOne2manyChanges(owned, lines);
  return {
    create: plan.create.map(({ values, index }) => treatmentWriteData(values, index)),
    update: plan.update.map(({ id, values, index }) => ({ where: { id: String(id) }, data: treatmentWriteData(values, index) })),
    deleteMany: { id: { in: plan.deleteIds.map(String) } },
  } satisfies Prisma.DentalTreatmentUpdateManyWithoutAppointmentNestedInput;
}

/** Query through appointment.patientId; no duplicated patient foreign key on a line. */
export const treatmentHistorySelect = {
  ...treatmentFormSelect,
  appointment: { select: { id: true, reason: true, scheduledAt: true, status: true } },
} satisfies Prisma.DentalTreatmentSelect;

export const treatmentHistoryOrder = [
  { performedAt: "desc" }, { id: "desc" },
] satisfies Prisma.DentalTreatmentOrderByWithRelationInput[];

type TreatmentHistoryRecord = Prisma.DentalTreatmentGetPayload<{ select: typeof treatmentHistorySelect }>;

export function treatmentHistoryValues(record: TreatmentHistoryRecord) {
  return {
    ...treatmentFormValues(record),
    appointment: {
      id: record.appointment.id, reason: record.appointment.reason,
      scheduledAt: record.appointment.scheduledAt.toISOString(), status: record.appointment.status,
    },
  };
}
