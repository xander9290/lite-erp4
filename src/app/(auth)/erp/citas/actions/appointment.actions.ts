"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/access";
import { AccessError } from "@/lib/auth/policy";
import { prisma } from "@/lib/prisma";
import type { FormViewLoadResult } from "@/components/ui/form/FormViewLoader";
import type { FormViewResult } from "@/components/ui/form/formView.types";
import type { AppointmentInput } from "../schemas/appointment.schema";
import { readAppointmentRecord, readPatientHistoryRecord, saveAppointmentRecord, type PatientHistoryPage } from "../models/appointment.service";

export async function readAppointment(id: string): Promise<FormViewLoadResult<AppointmentInput>> {
  try { return await readAppointmentRecord(prisma, await requireAdmin(), id); }
  catch (error) { return { ok: false, kind: "server", error: error instanceof AccessError ? error.message : "No se pudo cargar la cita. Intenta nuevamente." }; }
}

export async function saveAppointment(input: unknown): Promise<FormViewResult<AppointmentInput>> {
  let result: FormViewResult<AppointmentInput>;
  try { result = await saveAppointmentRecord(prisma, await requireAdmin(), input); }
  catch (error) { return { ok: false, kind: "server", error: error instanceof AccessError ? error.message : "No se pudo guardar la cita. Intenta nuevamente." }; }
  if (result.ok) revalidatePath("/erp/citas", "layout");
  return result;
}

export async function readPatientHistory(input: unknown): Promise<FormViewLoadResult<PatientHistoryPage>> {
  try { return await readPatientHistoryRecord(prisma, await requireAdmin(), input); }
  catch (error) { return { ok: false, kind: "server", error: error instanceof AccessError ? error.message : "No se pudo cargar el historial. Intenta nuevamente." }; }
}
