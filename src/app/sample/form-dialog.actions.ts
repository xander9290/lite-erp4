"use server";

import { dialogSampleSchema, type DialogSampleValues } from "./form-dialog.schema";
import type { FormViewResult } from "@/components/ui/form/FormView";

/** Fictitious example: validation and a visible pending state, without database writes. */
export async function saveDialogSample(input: unknown): Promise<FormViewResult<DialogSampleValues>> {
  const parsed = dialogSampleSchema.safeParse(input);
  if (!parsed.success) return { ok: false, kind: "validation", error: "Revisa el nombre." };
  await new Promise(resolve => setTimeout(resolve, 700));
  if (parsed.data.name === "ERROR") return { ok: false, kind: "validation", error: "Rechazo de ejemplo: cambia el nombre.", fieldErrors: { name: "Prueba otro nombre." } };
  return { ok: true, values: { ...parsed.data, id: parsed.data.id ?? crypto.randomUUID(), revision: crypto.randomUUID() } };
}
