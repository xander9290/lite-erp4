"use client";
import { useContext, useMemo } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { FormModelContext, lineField } from "./modelFields";
import type { Many2OneLoader } from "@/lib/many2one/model-lookup";

/** Loader identity changes only with its declared dependencies: search, modal and caches reset together. */
export function useRelationDomainLoad(name: string, fallback?: Many2OneLoader): Many2OneLoader | undefined {
  const model = useContext(FormModelContext);
  const { control } = useFormContext();
  // Inside lines, dependencies are fields of the same row (at any nesting level).
  const owner = lineField(model, name);
  const source = owner.line ? owner.line.domainLookups?.[owner.key] : model?.domainLookups?.[name];
  const names = (source?.dependencies ?? []).map(field => owner.row ? `${owner.row}.${field}` : field);
  if (source?.usesRecordId) names.push(owner.row ? `${owner.row}.id` : "id");
  const watched = useWatch({ control, name: names, disabled: !names.length, exact: true });
  const id = source?.usesRecordId ? watched[source.dependencies.length] : undefined;
  const key = JSON.stringify({ draft: Object.fromEntries((source?.dependencies ?? []).map((field, index) => [field, watched[index] ?? null])), record: typeof id === "string" && id ? { id } : {} });
  return useMemo(() => source ? request => {
    const { draft, record } = JSON.parse(key);
    return source.load(request, draft, record);
  } : fallback, [source, key, fallback]);
}
