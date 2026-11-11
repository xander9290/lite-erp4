"use server";

import { modelLookupSchema, type ModelLookupRequest } from "@/lib/many2one/model-lookup";
import type { Many2OneResult } from "@/lib/many2one/types";
import { sampleVehicle, sampleVehicles } from "./displayName.model";

/** Public fictional data only. Real providers must authorize via their service. */
export async function sampleVehicleLookup(input: ModelLookupRequest): Promise<Many2OneResult> {
  const parsed = modelLookupSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Consulta inválida." };
  const request = parsed.data;
  const rows = sampleVehicles.filter(row => (!request.id || row.id === request.id) && (!request.ids || request.ids.includes(row.id)) && `${row.name} ${row.plate}`.toLowerCase().includes(request.query.toLowerCase()));
  const pageSize = request.ids?.length ?? request.pageSize;
  const page = Math.min(request.page, Math.max(1, Math.ceil(rows.length / pageSize)));
  return { ok: true, total: rows.length, page, pageSize,
    items: rows.slice((page - 1) * pageSize, page * pageSize).map(row => ({ value: row.id, label: sampleVehicle.displayName(row), record: { id: row.id } })),
  };
}
