"use server";

import { modelLookupSchema, type ModelLookupRequest } from "@/lib/many2one/model-lookup";
import type { Many2OneResult } from "@/lib/many2one/types";
import { sampleVehicle, sampleVehicles } from "./displayName.model";
import { resolveListLabels } from "@/lib/list/relation-labels";
import type { ListState, ListResult } from "@/lib/list/types";
import type { KanbanRequest } from "@/lib/kanban/types";
import { createDemoRecords, demoPage } from "./collection-demo";

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

const sampleRows = createDemoRecords().slice(0, 3).map((row, index) => ({ ...row, client: index === 0 ? "demo-1" : index === 1 ? "demo-2" : null }));

/** Fictional data only; real collections use separately authorized list and lookup providers. */
export async function sampleRelationList(state: ListState): Promise<ListResult> {
  return resolveListLabels(demoPage(sampleRows, state), { client: sampleVehicleLookup });
}

export async function sampleRelationKanban({ state, group }: KanbanRequest): Promise<ListResult> {
  return resolveListLabels(demoPage(sampleRows, state, group), { client: sampleVehicleLookup });
}
