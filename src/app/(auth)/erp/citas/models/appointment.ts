import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import type { AppointmentInput, AppointmentValues } from "../schemas/appointment.schema";
import { treatmentCreateData, treatmentFormSelect, treatmentFormValues, treatmentUpdateData } from "./treatment";

/** Clinical fields: callers must authorize the account before using this select. */
export const appointmentFormSelect = {
  id: true,
  patientId: true,
  reason: true,
  scheduledAt: true,
  observations: true,
  status: true,
  updatedAt: true,
  treatments: { select: treatmentFormSelect, orderBy: [{ position: "asc" }, { id: "asc" }] },
} satisfies Prisma.DentalAppointmentSelect;

export type AppointmentFormRecord = Prisma.DentalAppointmentGetPayload<{ select: typeof appointmentFormSelect }>;

export function appointmentFormValues(record: AppointmentFormRecord): AppointmentInput {
  return {
    id: record.id,
    revision: record.updatedAt.toISOString(),
    patientId: record.patientId,
    reason: record.reason,
    scheduledAt: record.scheduledAt.toISOString(),
    observations: record.observations ?? "",
    status: record.status,
    treatments: record.treatments.map(treatmentFormValues),
  };
}

/** Use only after schema validation and authorization in the save service. */
function appointmentWriteData(values: AppointmentValues) {
  if (!values.patientId || !values.scheduledAt) throw new Error("La cita necesita paciente, fecha y hora.");
  return {
    patient: { connect: { id: values.patientId } },
    reason: values.reason,
    scheduledAt: new Date(values.scheduledAt),
    observations: values.observations || null,
    status: values.status,
  } satisfies Prisma.DentalAppointmentCreateInput;
}

/** Builders do not authorize, validate revisions or execute queries; the save service must do so. */
export function appointmentCreateData(values: AppointmentValues) {
  if (values.id || values.revision) throw new Error("Una cita nueva no debe tener ID ni revisión previa.");
  return {
    ...appointmentWriteData(values), treatments: treatmentCreateData(values.treatments),
  } satisfies Prisma.DentalAppointmentCreateInput;
}

/** Read ownedTreatments from this appointment in the same transaction, never from the browser. */
export function appointmentUpdateData(values: AppointmentValues, ownedTreatments: readonly { id: string }[]) {
  if (!values.id || !values.revision) throw new Error("Recarga la cita antes de guardar.");
  return {
    ...appointmentWriteData(values), treatments: treatmentUpdateData(ownedTreatments, values.treatments),
  } satisfies Prisma.DentalAppointmentUpdateInput;
}
