import "server-only";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import type { FieldMetadata } from "./fields";
import { activityChangeSchema, trackedChanges, type ActivityEntry, type ActivityPage, type ActivityRequest } from "./activity";

const pageSize = 20;
/** Current labels from an authorized lookup in the activity reader's transaction. */
export type ActivityLabelResolver = (target: string, ids: readonly string[]) => Promise<ReadonlyMap<string, string>>;
const publicSelect = {
  id: true, kind: true, createdAt: true, body: true, changes: true,
  actor: { select: { id: true, login: true, name: true, avatarUrl: true } },
} satisfies Prisma.RecordActivitySelect;

export async function recordActivity(tx: Prisma.TransactionClient, model: string, actorId: string, metadata: Readonly<Record<string, FieldMetadata>>, before: Record<string, unknown> | null, after: { id: string; [key: string]: unknown }, label?: string) {
  const changes = trackedChanges(metadata, before, after);
  // A business action is always recorded with its label, even without tracked changes.
  if (before && !changes.length && !label) return;
  await tx.recordActivity.create({ data: { model, recordId: after.id, actorId, kind: before ? "update" : "create", changes, ...(label && before ? { body: label } : {}) } });
}

/** Scope and authorization are supplied by the owning model service, not the browser. */
export async function readActivity(tx: Prisma.TransactionClient, model: string, metadata: Readonly<Record<string, FieldMetadata>>, request: ActivityRequest, resolveLabels?: ActivityLabelResolver): Promise<ActivityPage> {
  const cursor = request.cursor;
  const records = await tx.recordActivity.findMany({
    where: { model, recordId: request.id, ...(cursor ? { OR: [
      { createdAt: { lt: new Date(cursor.createdAt) } },
      { createdAt: new Date(cursor.createdAt), id: { lt: cursor.id } },
    ] } : {}) },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: pageSize + 1, select: publicSelect,
  });
  const page = records.slice(0, pageSize);
  const entries: ActivityEntry[] = page.flatMap(record => {
    if (!["create", "update", "note"].includes(record.kind)) return [];
    const parsed = z.array(activityChangeSchema).safeParse(record.changes);
    // A field can become private or stop tracking later. Never republish its old values.
    const changes = parsed.success ? parsed.data.filter(change => Object.hasOwn(metadata, change.field) && metadata[change.field].tracking && !metadata[change.field].sensitive) : [];
    if (record.kind === "update" && !changes.length && !record.body) return [];
    return [{ id: record.id, kind: record.kind as ActivityEntry["kind"], createdAt: record.createdAt.toISOString(),
      author: { id: record.actor.id, login: record.actor.login, name: record.actor.name || record.actor.login, avatarUrl: record.actor.avatarUrl ?? null },
      // Update entries carry the action label (business actions); notes carry their text.
      body: record.kind === "note" || record.kind === "update" ? record.body : null, changes: record.kind === "update" ? changes : [] }];
  });
  const last = page.at(-1);
  if (resolveLabels) {
    const targets = new Map<string, Set<string>>();
    for (const entry of entries) for (const change of entry.changes) {
      const field = metadata[change.field];
      if (change.type !== "many2one" || field.kind !== "many2one") continue;
      const ids = targets.get(field.target) ?? new Set<string>();
      for (const value of [change.before, change.after]) if (typeof value === "string") ids.add(value);
      targets.set(field.target, ids);
    }
    const labels = new Map<string, Map<string, string>>();
    for (const [target, selected] of targets) {
      const ids = [...selected], resolved = new Map<string, string>();
      for (let start = 0; start < ids.length; start += 100) {
        for (const [id, label] of await resolveLabels(target, ids.slice(start, start + 100))) resolved.set(id, label);
      }
      labels.set(target, resolved);
    }
    for (const entry of entries) for (const change of entry.changes) {
      const field = metadata[change.field];
      if (change.type !== "many2one" || field.kind !== "many2one") continue;
      for (const side of ["before", "after"] as const) {
        const labelKey = side === "before" ? "beforeLabel" : "afterLabel";
        // Never trust a historical label after target access has changed.
        delete change[labelKey];
        if (change[side] === null) continue;
        const label = typeof change[side] === "string" ? labels.get(field.target)?.get(change[side]) : undefined;
        change[labelKey] = label ?? "Registro no disponible";
        if (label === undefined) change[side] = "Registro no disponible";
      }
    }
  }
  return { entries, nextCursor: records.length > pageSize && last ? { id: last.id, createdAt: last.createdAt.toISOString() } : null };
}
