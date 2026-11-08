import { z } from "zod";

export const recordIdentityShape = {
  id: z.string().trim().min(1).max(100).optional(),
  revision: z.iso.datetime({ precision: 3 }).optional(),
};
export const recordIdentitySchema = z.strictObject(recordIdentityShape).superRefine((value, context) => {
  if (Boolean(value.id) !== Boolean(value.revision)) context.addIssue({ code: "custom", path: [value.id ? "revision" : "id"], message: "El registro y su revisión deben enviarse juntos." });
});
export type RecordIdentity = z.output<typeof recordIdentitySchema>;
export type SavedRecord<T> = T & { id: string; revision: string };

export function validateRecordIdentity(value: RecordIdentity, context: z.RefinementCtx) {
  const result = recordIdentitySchema.safeParse({ id: value.id, revision: value.revision });
  if (!result.success) for (const issue of result.error.issues) context.addIssue({ code: "custom", path: issue.path, message: issue.message });
}
