"use server";

import { z } from "zod";
import { Fields } from "@/lib/orm/fields";
import type { ModelClientConfig } from "@/lib/modules/config";
import { dialogSampleSchema } from "./form-dialog.schema";

/** Public fictitious transport demo: receives only example text, never queries a model or database. */
export async function openFormSample(input: unknown) {
  const parsed = z.strictObject({ record: dialogSampleSchema.optional(), defaults: dialogSampleSchema.optional() }).safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Revisa los datos del ejemplo." };
  const { record, defaults } = parsed.data;
  const config: ModelClientConfig = {
    id: "sample.dialog", module: "sample", moduleName: "Ejemplo", key: "dialog", name: "SampleDialog", label: "Ejemplo sin persistencia", route: "/sample",
    fields: { name: Fields.Text({ required: true }).metadata, note: Fields.Text().metadata },
    preview: {}, related: [], reactionRules: [], lookups: {}, actions: [], view: "list",
    list: { fields: ["name"], searchFields: ["name"], sortable: [], groupable: [], filterable: [] },
  };
  return { ok: true as const, config, view: "modal" as const, id: record?.id, defaults: record ? {} : defaults ?? {}, record };
}
