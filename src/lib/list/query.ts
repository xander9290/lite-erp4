import { z } from "zod";
import { listModels, listPartnerAvatarField, type ListDataType } from "./types";

export const listFilterSchema = z.object({
  field: z.string().min(1).max(60),
  operator: z.enum(["contains", "eq", "neq", "startsWith", "endsWith", "gt", "gte", "lt", "lte", "between", "empty", "notEmpty"]),
  value: z.string().max(120).optional(), to: z.string().max(120).optional(), precision: z.enum(["day", "instant"]).optional(),
}).strict();

export const listConfigSchema = z.object({
  model: z.enum(["partner", "user", "dentalAppointment"]),
  searchFields: z.array(z.string().min(1).max(60)).min(1).max(6),
  columns: z.array(z.object({
    field: z.string().min(1).max(60), label: z.string().trim().min(1).max(80), sortable: z.boolean().optional(),
    widget: z.literal("partner").optional(), avatarField: z.string().min(1).max(60).optional(),
    filterable: z.boolean().optional(), groupable: z.boolean().optional(), type: z.enum(["text", "number", "integer", "date", "datetime", "boolean"]).optional(),
    align: z.enum(["left", "center", "right"]).optional(),
    format: z.enum(["text", "number", "currency", "date", "datetime", "boolean"]).optional(),
    currency: z.string().regex(/^[A-Z]{3}$/).optional(), decimals: z.number().int().min(0).max(6).optional(),
  }).strict()).min(1).max(12),
  defaultSort: z.object({ field: z.string(), direction: z.enum(["asc", "desc"]) }).strict().optional(),
}).strict().superRefine((config, context) => {
  const allowed: readonly string[] = listModels[config.model].fields;
  const searchable: readonly string[] = ["id", ...listModels[config.model].searchFields];
  const fieldTypes = listModels[config.model].fieldTypes as Record<string, ListDataType>;
  for (const [index, column] of config.columns.entries()) {
    if ((column.avatarField !== undefined && column.widget !== "partner") ||
        (column.widget === "partner" && (!listPartnerAvatarField(config.model, column) || (column.format !== undefined && column.format !== "text")))) {
      context.addIssue({ code: "custom", path: ["columns", index], message: "El widget de contacto y su avatar no están habilitados para esta columna." });
    }
  }
  if (config.columns.some(column => !allowed.includes(column.field)) || config.searchFields.some(field => !searchable.includes(field)) ||
      config.columns.some(column => column.type && column.type !== fieldTypes[column.field] && !(column.type === "date" && fieldTypes[column.field] === "datetime")) ||
      new Set(config.columns.map(column => column.field)).size !== config.columns.length ||
      (config.defaultSort && !config.columns.some(column => column.field === config.defaultSort?.field && column.sortable))) {
    context.addIssue({ code: "custom", message: "Las columnas, la búsqueda o el orden no están habilitados para este modelo." });
  }
});

export const listStateSchema = z.object({
  query: z.string().max(120), page: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER), pageSize: z.number().int().min(1).max(50),
  sort: z.string().min(1).max(60), direction: z.enum(["asc", "desc"]),
  filters: z.array(listFilterSchema).max(12).default([]), invalidFilters: z.boolean().optional(),
  groupBy: z.array(z.string().min(1).max(60)).max(3).optional(),
  groupPath: z.array(z.union([z.string().max(1000), z.number().finite(), z.boolean(), z.null()])).max(3).optional(),
}).strict();

