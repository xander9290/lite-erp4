import "server-only";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import type { FieldMetadata } from "./fields";
import { activityChangeSchema, trackedChanges, type ActivityEntry, type ActivityPage, type ActivityRequest } from "./activity";

const pageSize = 20;
const publicSelect = {
  id: true, kind: true, createdAt: true, body: true, changes: true,
  actor: { select: { id: true, login: true, partner: { select: { name: true, avatarUrl: true } } } },
} satisfies Prisma.RecordActivitySelect;

export async function recordActivity(tx: Prisma.TransactionClient, model: string, actorId: string, metadata: Readonly<Record<string, FieldMetadata>>, before: Record<string, unknown> | null, after: { id: string; [key: string]: unknown }) {
  const changes = trackedChanges(metadata, before, after);
  if (before && !changes.length) return;
  await tx.recordActivity.create({ data: { model, recordId: after.id, actorId, kind: before ? "update" : "create", changes } });
}

/** Scope and authorization are supplied by the owning model service, not the browser. */
export async function readActivity(tx: Prisma.TransactionClient, model: string, metadata: Readonly<Record<string, FieldMetadata>>, request: ActivityRequest): Promise<ActivityPage> {
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
    if (record.kind === "update" && !changes.length) return [];
    return [{ id: record.id, kind: record.kind as ActivityEntry["kind"], createdAt: record.createdAt.toISOString(),
      author: { id: record.actor.id, login: record.actor.login, name: record.actor.partner?.name ?? record.actor.login, avatarUrl: record.actor.partner?.avatarUrl ?? null },
      body: record.kind === "note" ? record.body : null, changes: record.kind === "update" ? changes : [] }];
  });
  const last = page.at(-1);
  return { entries, nextCursor: records.length > pageSize && last ? { id: last.id, createdAt: last.createdAt.toISOString() } : null };
}
