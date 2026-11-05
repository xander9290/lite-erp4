"use server";

import { lookupRequestSchema } from "./query";
import { lookupRegistry } from "./registry";
import { formatLookupName, type Many2OneRequest, type Many2OneResult } from "./types";
import { requireUser } from "../auth/access";
import { AccessError } from "../auth/policy";

/** A single read-only action for autocomplete, pagination and resolving saved IDs. */
export async function searchMany2One(input: Many2OneRequest): Promise<Many2OneResult> {
  try { await requireUser(); }
  catch (error) { return { ok: false, error: error instanceof AccessError ? error.message : "No se pudo verificar tu sesión." }; }
  const parsed = lookupRequestSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Revisa el modelo, los campos y el formato de búsqueda configurados." };
  try {
    const result = await lookupRegistry[parsed.data.model](parsed.data);
    return {
      ok: true,
      items: result.records.map(record => ({ value: record.id, label: formatLookupName(record, parsed.data.displayName), record })),
      total: result.total, page: result.page, pageSize: result.pageSize,
    };
  } catch {
    return { ok: false, error: "No pudimos consultar los registros. Intenta nuevamente." };
  }
}
