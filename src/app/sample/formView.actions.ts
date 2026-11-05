"use server";

import type { FormViewResult } from "@/components/ui/form/formView.types";
import type { FieldPath } from "react-hook-form";
import { canTransition, createExampleReport, formViewDefaults, formViewSchema, type FormViewSampleValues } from "./formView.schema";
import type { FormViewLoadResult } from "@/components/ui/form/FormViewLoader";

export async function loadFormViewExample(id: unknown = "example"): Promise<FormViewLoadResult<FormViewSampleValues>> {
  // Deliberate latency only in this UI demo, so the loading state can be observed.
  await new Promise(resolve => setTimeout(resolve, 600));
  if (id !== "example") return { ok: false, kind: "server", error: "No se encontró el documento de ejemplo. Puedes reintentar o volver a cargar el ejemplo válido." };
  return { ok: true, values: formViewDefaults };
}

/** UI demo only: no database access. Production actions must authenticate and authorize the record. */
export async function saveFormViewExample(input: unknown): Promise<FormViewResult<FormViewSampleValues>> {
  const parsed = formViewSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Partial<Record<FieldPath<FormViewSampleValues>, string>> = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path.join(".") as FieldPath<FormViewSampleValues>;
      if (field && !fieldErrors[field]) fieldErrors[field] = issue.message;
    }
    return { ok: false, kind: "validation", error: "Revisa los datos del documento.", fieldErrors };
  }
  if (parsed.data.reference === "DUPLICADO") return {
    ok: false, kind: "validation", error: "La referencia ya existe (rechazo de ejemplo).", fieldErrors: { reference: "Elige otra referencia." },
  };
  return { ok: true, values: parsed.data, message: "Ejemplo validado en el servidor." };
}

export async function transitionFormViewExample(input: unknown, target: unknown): Promise<FormViewResult<FormViewSampleValues>> {
  const parsed = formViewSchema.safeParse(input);
  const state = formViewSchema.shape.state.safeParse(target);
  if (!parsed.success || !state.success || !canTransition(parsed.data.state, state.data)) return { ok: false, error: "Este cambio de estado no está disponible." };
  return { ok: true, values: { ...parsed.data, state: state.data }, message: "Estado actualizado en el ejemplo." };
}

export async function prepareFormViewReport(input: unknown): Promise<{ ok: true; html: string } | { ok: false; error: string }> {
  const parsed = formViewSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "El documento no es válido para generar el reporte." };
  return { ok: true, html: createExampleReport(parsed.data) };
}
