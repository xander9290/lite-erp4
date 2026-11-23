"use server";

import { requireUser } from "@/lib/auth/access";
import { AccessError } from "@/lib/auth/policy";
import { FormOpenError } from "@/lib/modules/form-open";
import type { ModelFormOpenResult } from "@/lib/modules/form-reference";
import { prepareRegisteredFormOpen } from "@/lib/modules/form-open.server";

export async function openModelForm(input: unknown): Promise<ModelFormOpenResult> {
  try {
    const prepared = await prepareRegisteredFormOpen(input, await requireUser());
    return { ok: true, ...prepared };
  } catch (error) {
    return { ok: false, error: error instanceof AccessError || error instanceof FormOpenError ? error.message : "No se pudo abrir el formulario. Intenta nuevamente." };
  }
}
