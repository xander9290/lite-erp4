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
  const watched = useWatch({ control, name: names, disabled: !names.length, exact: true });
  const key = JSON.stringify((source?.dependencies ?? []).map((field, index) => [field, watched[index] ?? null]));
  return useMemo(() => source ? request => source.load(request, Object.fromEntries(JSON.parse(key))) : fallback, [source, key, fallback]);
}
