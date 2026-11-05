"use server";

import { requireAdmin } from "../auth/access";
import { prisma } from "../prisma";
import { AccessError } from "../auth/policy";
import { saveUserRecord, userFormSelect, userFormValues } from "./service";
import type { UserValues } from "@/schemas/user.schema";
import type { FormViewResult } from "@/components/ui/form/formView.types";
import type { FormViewLoadResult } from "@/components/ui/form/FormViewLoader";

export async function readUser(id: string): Promise<FormViewLoadResult<UserValues>> {
  try {
    await requireAdmin();
    if (typeof id !== "string" || !id || id.length > 100) return { ok: false, error: "El usuario no es válido." };
    const user = await prisma.user.findUnique({ where: { id }, select: userFormSelect });
    return user ? { ok: true, values: userFormValues(user) } : { ok: false, error: "No se encontró este usuario." };
  } catch (error) { return { ok: false, error: error instanceof AccessError ? error.message : "No se pudo cargar el usuario. Intenta nuevamente." }; }
}

export async function saveUser(input: unknown): Promise<FormViewResult<UserValues>> {
  try { return await saveUserRecord(prisma, await requireAdmin(), input); }
  catch (error) { return { ok: false, kind: "server", error: error instanceof AccessError ? error.message : "No se pudo guardar el usuario. Intenta nuevamente." }; }
}
