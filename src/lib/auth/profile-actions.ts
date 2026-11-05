"use server";

import { signOut } from "@/auth";
import { prisma } from "../prisma";
import { requireUser } from "./access";
import { AccessError } from "./policy";
import { changeOwnPassword, loadOwnProfile, saveOwnProfile } from "./profile-service";
import type { ChangePasswordValues, ProfileRecord, ProfileValues } from "@/schemas/profile.schema";
import type { FormViewLoadResult } from "@/components/ui/form/FormViewLoader";
import type { FormViewResult } from "@/components/ui/form/formView.types";

export async function readMyProfile(): Promise<FormViewLoadResult<ProfileRecord>> {
  try { return { ok: true, values: await loadOwnProfile(prisma, await requireUser()) }; }
  catch (error) { return { ok: false, error: error instanceof AccessError ? error.message : "No se pudo cargar tu perfil." }; }
}
export async function saveMyProfile(input: unknown): Promise<FormViewResult<ProfileValues>> {
  try { return await saveOwnProfile(prisma, await requireUser(), input); }
  catch (error) { return { ok: false, kind: "server", error: error instanceof AccessError ? error.message : "No se pudo guardar tu perfil." }; }
}
export async function changeMyPassword(input: unknown): Promise<FormViewResult<ChangePasswordValues>> {
  try {
    const result = await changeOwnPassword(prisma, await requireUser(), input);
    if (result.ok) await signOut({ redirect: false });
    return result;
  } catch (error) { return { ok: false, kind: "server", error: error instanceof AccessError ? error.message : "No se pudo cambiar la contraseña." }; }
}
