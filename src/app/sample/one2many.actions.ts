"use server";

import type { FieldPath } from "react-hook-form";
import type { FormViewResult } from "@/components/ui/form/formView.types";
import { planOne2manyChanges } from "@/lib/one2many/changes";
import { one2manyDefaults, one2manySchema, orderTotal, type One2manyInput } from "./one2many.schema";

export type OrderSaveResult = FormViewResult<One2manyInput> & { summary?: { create: number; update: number; delete: number; total: number } };

/** Demo only. The real action must read/authorize the parent and apply the plan within its database transaction. */
export async function saveOne2manyExample(input: unknown): Promise<OrderSaveResult> {
  const parsed = one2manySchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Partial<Record<FieldPath<One2manyInput>, string>> = {};
    for (const issue of parsed.error.issues) {
      const path = issue.path.join(".") as FieldPath<One2manyInput>;
      fieldErrors[path] ??= issue.message;
    }
    return { ok: false, kind: "validation", error: "Revisa las líneas del pedido.", fieldErrors };
  }
  const rejected = parsed.data.lines.findIndex(row => row.description.toUpperCase().includes("BLOQUEADO"));
  if (rejected >= 0) return { ok: false, kind: "validation", error: `La línea ${rejected + 1} fue rechazada por el servidor (regla de ejemplo).`, fieldErrors: { [`lines.${rejected}.description`]: "Esta descripción está bloqueada. Usa otra descripción." } };
  try {
    const owned = one2manyDefaults.lines.map(row => ({ ...row, id: row.id! }));
    const plan = planOne2manyChanges(owned, parsed.data.lines);
    return { ok: true, values: parsed.data, message: "Pedido validado en el servidor. Sin escritura en base de datos.", summary: { create: plan.create.length, update: plan.update.length, delete: plan.deleteIds.length, total: orderTotal(parsed.data.lines) } };
  } catch {
    return { ok: false, kind: "validation", error: "Las líneas existentes no corresponden al documento o están duplicadas.", fieldErrors: { lines: "Recarga las líneas del pedido y vuelve a intentarlo." } };
  }
}
