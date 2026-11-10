import { z } from "zod";

export const listDeleteSelectionSchema = z.array(z.strictObject({
  id: z.string().trim().min(1).max(100),
  revision: z.iso.datetime({ precision: 3 }),
})).min(1).max(50).refine(items => new Set(items.map(item => item.id)).size === items.length, "No repitas registros.");

export type ListDeleteTarget = z.infer<typeof listDeleteSelectionSchema>[number];
export type ListDeleteResult = { ok: true; deleted: number } | { ok: false; error: string; kind?: "validation" | "server" };
