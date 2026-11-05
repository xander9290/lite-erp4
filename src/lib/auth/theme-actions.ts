"use server";

import { prisma } from "../prisma";
import { requireUser } from "./access";
import { AccessError } from "./policy";
import { saveOwnTheme } from "./theme-service";

export async function saveMyTheme(darkMode: boolean): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await saveOwnTheme(prisma, await requireUser(), darkMode);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof AccessError ? error.message : "No se pudo guardar tu apariencia. Intenta nuevamente." };
  }
}
