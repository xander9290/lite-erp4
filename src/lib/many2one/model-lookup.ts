import { z } from "zod";
import type { Many2OneResult } from "./types";

/** No model, fields, template or actor can be selected by the browser. */
export const modelLookupSchema = z.strictObject({
  query: z.string().max(120).default(""),
  page: z.number().int().min(1).max(10000).default(1),
  pageSize: z.number().int().min(1).max(25).default(10),
  id: z.string().trim().min(1).max(128).optional(),
  ids: z.array(z.string().trim().min(1).max(128)).min(1).max(100)
    .refine(ids => new Set(ids).size === ids.length).optional(),
}).refine(input => !(input.id && input.ids));
export type ModelLookupRequest = z.input<typeof modelLookupSchema>;
export type Many2OneLoader = (input: ModelLookupRequest) => Promise<Many2OneResult>;
