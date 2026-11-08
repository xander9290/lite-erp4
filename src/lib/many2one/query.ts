import { z } from "zod";
import { lookupModels } from "./types";
import type { Prisma } from "../../generated/prisma/client";

export const lookupRequestSchema = z.object({
  model: z.enum(["user", "partner"]),
  searchFields: z.array(z.string().min(1).max(60)).min(1).max(6),
  displayName: z.string().min(1).max(180),
  query: z.string().max(120).default(""),
  page: z.number().int().min(1).max(10000).default(1),
  pageSize: z.number().int().min(1).max(25).default(10),
  id: z.string().trim().min(1).max(128).optional(),
  ids: z.array(z.string().trim().min(1).max(128)).min(1).max(100)
    .refine(ids => new Set(ids).size === ids.length, "Los IDs deben ser únicos.").optional(),
}).strict().superRefine((input, context) => {
  if (input.id && input.ids) context.addIssue({ code: "custom", message: "Usa id o ids, no ambos." });
  const allowed: readonly string[] = lookupModels[input.model].fields;
  const placeholders = [...input.displayName.matchAll(/\{([\w.]+)\}/g)].map(match => match[1]);
  const remainder = input.displayName.replace(/\{[\w.]+\}/g, "");
  if (!placeholders.length || /[{}]/.test(remainder) || [...input.searchFields, ...placeholders].some(path => !allowed.includes(path))) {
    context.addIssue({ code: "custom", message: "El modelo o los campos de búsqueda no están habilitados." });
  }
});

export type LookupQuery = z.output<typeof lookupRequestSchema>;

/** Batch resolution reads all requested IDs, independent of the search page size. */
export function lookupWindow(request: LookupQuery) {
  return request.ids ? { page: 1, pageSize: request.ids.length } : request;
}

/** Every word must match at least one permitted field (including related fields). */
export function lookupWords(query: string) {
  return query.trim().split(/\s+/).filter(Boolean)
    .map(word => word.replace(/[\\%_]/g, "\\$&"));
}

export function userLookupWhere(request: Pick<LookupQuery, "query" | "searchFields">): Prisma.UserWhereInput {
  return { AND: lookupWords(request.query).map(word => ({ OR: request.searchFields.map(path => {
    const text = { contains: word, mode: "insensitive" as const };
    if (path === "partner.name") return { partner: { is: { name: text } } };
    if (path === "id") return { id: text };
    return { login: text };
  }) })) };
}

export function partnerLookupWhere(request: Pick<LookupQuery, "query" | "searchFields">): Prisma.PartnerWhereInput {
  return { AND: lookupWords(request.query).map(word => ({ OR: request.searchFields.map(path => {
    const text = { contains: word, mode: "insensitive" as const };
    if (path === "user.login") return { user: { is: { login: text } } };
    if (path === "email") return { email: text };
    if (path === "phone") return { phone: text };
    if (path === "id") return { id: text };
    return { name: text };
  }) })) };
}

export async function lookupPage<T>(
  request: Pick<LookupQuery, "page" | "pageSize">,
  source: { count: () => Promise<number>; read: (skip: number, take: number) => Promise<T[]> },
) {
  const total = await source.count();
  const page = Math.min(request.page, Math.max(1, Math.ceil(total / request.pageSize)));
  const records = total ? await source.read((page - 1) * request.pageSize, request.pageSize) : [];
  return { records, total, page, pageSize: request.pageSize };
}
