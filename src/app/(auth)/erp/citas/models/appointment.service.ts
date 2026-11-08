import "server-only";
import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import type { FieldPath } from "react-hook-form";
import type { FormViewLoadResult } from "@/components/ui/form/FormViewLoader";
import type { FormViewResult } from "@/components/ui/form/formView.types";
import { AccessError } from "@/lib/auth/policy";
import { appointmentIdSchema, appointmentSchema, type AppointmentInput } from "../schemas/appointment.schema";
import { patientHistorySchema } from "../schemas/history.schema";
import { appointmentCreateData, appointmentFormSelect, appointmentFormValues, appointmentUpdateData } from "./appointment";
import { treatmentHistoryOrder, treatmentHistorySelect, treatmentHistoryValues } from "./treatment";
import { assertClinicalActor as assertActor, type ClinicalActor as Actor } from "./access";

type FieldErrors = Partial<Record<FieldPath<AppointmentInput>, string>>;
class AppointmentValidationError extends Error {
  constructor(message: string, readonly fieldErrors?: FieldErrors) { super(message); }
}
const conflictMessage = "La cita cambió desde que la abriste. Recarga sus datos antes de guardar.";

function errorCode(error: unknown) {
  return error && typeof error === "object" && "code" in error ? error.code : undefined;
}

export async function readAppointmentRecord(prisma: PrismaClient, actor: Actor, input: unknown): Promise<FormViewLoadResult<AppointmentInput>> {
  const id = appointmentIdSchema.safeParse(input);
  if (!id.success) return { ok: false, kind: "validation", error: "La cita no es válida." };
  try {
    const record = await prisma.$transaction(async tx => {
      await assertActor(tx, actor);
      // The editor needs ALL lines: an omitted line represents a deletion on save.
      return tx.dentalAppointment.findUnique({ where: { id: id.data }, select: appointmentFormSelect });
    }, { isolationLevel: "RepeatableRead" });
    return record ? { ok: true, values: appointmentFormValues(record) } : { ok: false, error: "No se encontró esta cita." };
  } catch (error) {
    return { ok: false, kind: "server", error: error instanceof AccessError ? error.message : "No se pudo cargar la cita. Intenta nuevamente." };
  }
}

export async function saveAppointmentRecord(prisma: PrismaClient, actor: Actor, input: unknown): Promise<FormViewResult<AppointmentInput>> {
  const parsed = appointmentSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: FieldErrors = {};
    for (const issue of parsed.error.issues) {
      if (issue.path.length) fieldErrors[issue.path.join(".") as FieldPath<AppointmentInput>] ??= issue.message;
    }
    return { ok: false, kind: "validation", error: "Revisa los datos de la cita y sus tratamientos.", fieldErrors };
  }
  const values = parsed.data;
  try {
    const record = await prisma.$transaction(async tx => {
      await assertActor(tx, actor);
      const patient = await tx.partner.findUnique({ where: { id: values.patientId }, select: { id: true } });
      if (!patient) throw new AppointmentValidationError("El paciente ya no está disponible.", { patientId: "Selecciona un paciente disponible." });
      if (!values.id) return tx.dentalAppointment.create({ data: appointmentCreateData(values), select: appointmentFormSelect });

      const current = await tx.dentalAppointment.findUnique({
        where: { id: values.id }, select: { id: true, updatedAt: true, treatments: { select: { id: true } } },
      });
      if (!current) throw new AppointmentValidationError("Esta cita ya no está disponible.");
      if (current.updatedAt.toISOString() !== values.revision) throw new AppointmentValidationError(conflictMessage);
      const owned = new Set(current.treatments.map(line => line.id));
      values.treatments.forEach((line, index) => {
        if (line.id && !owned.has(line.id)) {
          throw new AppointmentValidationError("Un tratamiento no pertenece a esta cita o ya no está disponible.", {
            [`treatments.${index}.id`]: "Recarga la cita antes de editar este tratamiento.",
          });
        }
      });
      return tx.dentalAppointment.update({
        where: { id: current.id, updatedAt: current.updatedAt },
        data: {
          ...appointmentUpdateData(values, current.treatments),
          // Child-only edits also invalidate older forms, even in the same millisecond.
          updatedAt: new Date(Math.max(Date.now(), current.updatedAt.getTime() + 1)),
        },
        select: appointmentFormSelect,
      });
    }, { isolationLevel: "Serializable" });
    return { ok: true, values: appointmentFormValues(record), message: values.id ? "Cita actualizada." : "Cita creada." };
  } catch (error) {
    if (error instanceof AccessError) return { ok: false, kind: "server", error: error.message };
    if (error instanceof AppointmentValidationError) return { ok: false, kind: "validation", error: error.message, fieldErrors: error.fieldErrors };
    if (["P2025", "P2034"].includes(String(errorCode(error)))) return { ok: false, kind: "validation", error: conflictMessage };
    if (errorCode(error) === "P2003") return { ok: false, kind: "validation", error: "El paciente cambió o ya no está disponible. Recarga la cita." };
    return { ok: false, kind: "server", error: "No se pudo guardar la cita. Recarga los datos e intenta nuevamente." };
  }
}

export type PatientHistoryPage = {
  patient: { id: string; name: string };
  rows: ReturnType<typeof treatmentHistoryValues>[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
};

export async function readPatientHistoryRecord(prisma: PrismaClient, actor: Actor, input: unknown): Promise<FormViewLoadResult<PatientHistoryPage>> {
  const parsed = patientHistorySchema.safeParse(input);
  if (!parsed.success) return { ok: false, kind: "validation", error: "El paciente o la paginación del historial no son válidos." };
  try {
    const values = await prisma.$transaction(async tx => {
      await assertActor(tx, actor);
      const { patientId, pageSize } = parsed.data;
      const patient = await tx.partner.findUnique({ where: { id: patientId }, select: { id: true, name: true } });
      if (!patient) throw new AppointmentValidationError("No se encontró este paciente.");
      const where = { appointment: { patientId } } satisfies Prisma.DentalTreatmentWhereInput;
      const total = await tx.dentalTreatment.count({ where });
      const pageCount = Math.max(1, Math.ceil(total / pageSize));
      const page = Math.min(parsed.data.page, pageCount);
      const rows = await tx.dentalTreatment.findMany({
        where, select: treatmentHistorySelect, orderBy: treatmentHistoryOrder, take: pageSize, skip: (page - 1) * pageSize,
      });
      return { patient, rows: rows.map(treatmentHistoryValues), total, page, pageSize, pageCount };
    }, { isolationLevel: "RepeatableRead" });
    return { ok: true, values };
  } catch (error) {
    if (error instanceof AppointmentValidationError) return { ok: false, kind: "validation", error: error.message };
    return { ok: false, kind: "server", error: error instanceof AccessError ? error.message : "No se pudo cargar el historial. Intenta nuevamente." };
  }
}
