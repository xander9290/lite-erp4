import { z } from "zod";
import type { FieldMetadata } from "./fields";

const identity = z.string().trim().min(1).max(100);
export const activityCursorSchema = z.strictObject({ id: identity, createdAt: z.iso.datetime({ precision: 3 }) });
export const activityRequestSchema = z.strictObject({ id: identity, cursor: activityCursorSchema.optional() });
export const activityNoteSchema = z.strictObject({ id: identity, body: z.string().trim().min(1, "Escribe una nota.").max(4000), requestId: z.uuid() });
const scalar = z.union([z.string(), z.number().finite(), z.boolean(), z.null()]);
export const activityChangeSchema = z.strictObject({ field: identity, label: z.string(), type: z.enum(["text", "integer", "boolean", "selection", "datetime", "many2one"]), before: scalar, after: scalar, beforeLabel: z.string().optional(), afterLabel: z.string().optional() });
export type ActivityChange = z.infer<typeof activityChangeSchema>;
export type ActivityCursor = z.infer<typeof activityCursorSchema>;
export type ActivityRequest = z.infer<typeof activityRequestSchema>;
export type ActivityNote = z.infer<typeof activityNoteSchema>;
export type ActivityEntry = {
  id: string; kind: "create" | "update" | "note"; createdAt: string;
  author: { id: string; login: string; name: string; avatarUrl: string | null };
  body: string | null; changes: ActivityChange[];
};
export type ActivityPage = { entries: ActivityEntry[]; nextCursor: ActivityCursor | null };
export type ActivityResult = { ok: true; data: ActivityPage } | { ok: false; error: string };
export type ActivityNoteResult = { ok: true } | { ok: false; error: string };
export type FormActivity = {
  recordId?: string;
  load: (request: ActivityRequest) => Promise<ActivityResult>;
  addNote?: (request: ActivityNote) => Promise<ActivityNoteResult>;
};

/** Compare persisted values after hooks; never take a change list from the browser. */
export function trackedChanges(metadata: Readonly<Record<string, FieldMetadata>>, before: Record<string, unknown> | null, after: Record<string, unknown>): ActivityChange[] {
  // Creation is a single summary event, regardless of how many fields exist.
  if (before === null) return [];
  return Object.entries(metadata).flatMap(([field, definition]) => {
    if (!definition.tracking || definition.sensitive) return [];
    const previous = scalar.parse(before?.[field] ?? null), next = scalar.parse(after[field] ?? null);
    if (previous === next) return [];
    const label = (value: unknown) => definition.kind === "selection" ? definition.choices.find(choice => choice.value === value)?.label : undefined;
    return [{ field, label: definition.label ?? field, type: definition.kind, before: previous, after: next,
      ...(label(previous) ? { beforeLabel: label(previous) } : {}), ...(label(next) ? { afterLabel: label(next) } : {}) }];
  });
}
