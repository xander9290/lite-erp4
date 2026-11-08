"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin, requireUser } from "@/lib/auth/access";
import { AccessError } from "@/lib/auth/policy";
import { prisma } from "@/lib/prisma";
import type { FormViewLoadResult } from "@/components/ui/form/FormViewLoader";
import type { FormViewResult } from "@/components/ui/form/formView.types";
import type { ContactValues } from "../schemas/contact.schema";
import { readContactRecord, saveContactRecord } from "../models/contact.service";

export async function readContact(id: string): Promise<FormViewLoadResult<ContactValues>> {
  try { return await readContactRecord(prisma, await requireUser(), id); }
  catch (error) { return { ok: false, kind: "server", error: error instanceof AccessError ? error.message : "No se pudo cargar el contacto. Intenta nuevamente." }; }
}

export async function saveContact(input: unknown): Promise<FormViewResult<ContactValues>> {
  let result: FormViewResult<ContactValues>;
  try { result = await saveContactRecord(prisma, await requireAdmin(), input); }
  catch (error) { return { ok: false, kind: "server", error: error instanceof AccessError ? error.message : "No se pudo guardar el contacto. Intenta nuevamente." }; }
  if (result.ok) revalidatePath("/erp/contactos");
  return result;
}
