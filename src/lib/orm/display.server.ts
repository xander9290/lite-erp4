import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import type { FieldMetadata } from "./fields";
import type { ModelRepository } from "./repository";
import { displayProjectionPaths, normalizeDisplayName, projectDisplayRecord } from "./display";

export type DisplayContract = {
  metadata: Readonly<Record<string, FieldMetadata>>;
  displayFields?: readonly string[];
  displayName?(record: Readonly<Record<string, unknown>>): string;
};

export function modelDisplayName(model: DisplayContract, source: Readonly<Record<string, unknown>>): string {
  const record = projectDisplayRecord(source, displayProjectionPaths(model.metadata, model.displayFields));
  return normalizeDisplayName(model.displayName ? model.displayName(record) : "", record, model.metadata);
}

/** IDs come only from authorized records, never a separate client-supplied projection. */
export async function resolveDisplayNames<T>(tx: Prisma.TransactionClient, rows: readonly Readonly<Record<string, unknown>>[], model: DisplayContract, repository: ModelRepository<T>): Promise<ReadonlyMap<string, string>> {
  const names = new Map<string, string>();
  if (!rows.length) return names;
  const fields = displayProjectionPaths(model.metadata, model.displayFields);
  const ids = [...new Set(rows.map(row => {
    if (typeof row.id !== "string" || !row.id) throw new Error("Invalid display record");
    return row.id;
  }))];
  if (!fields.some(field => field.includes("."))) {
    for (const row of rows) names.set(row.id as string, modelDisplayName(model, row));
    return names;
  }
  if (!repository.lookup || fields.some(field => field.includes(".") && !repository.lookupPaths?.includes(field))) throw new Error("MODEL_NOT_BOUND");
  for (let offset = 0; offset < ids.length; offset += 100) {
    const batch = ids.slice(offset, offset + 100);
    const records = await repository.lookup(tx, { fields, where: { id: { in: batch } }, skip: 0, take: batch.length });
    const expected = new Set(batch);
    for (const record of records) {
      if (typeof record.id !== "string" || !expected.delete(record.id)) throw new Error("Invalid display projection");
      names.set(record.id, modelDisplayName(model, record));
    }
    if (expected.size) throw new Error("Incomplete display projection");
  }
  return names;
}
