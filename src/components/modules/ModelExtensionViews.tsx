"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";

type Slots = Readonly<Record<string, ReactNode>>;
export type InsertionKind = "form" | "modal" | "list" | "card" | "kanban";
type Value = { model?: string; formKind?: "form" | "modal"; views: Slots; insertions: Partial<Record<InsertionKind, Slots>> };
const ExtensionViewsContext = createContext<Value>({ views: {}, insertions: {} });
const none: Slots = Object.freeze({});

/**
 * Server-resolved lazy views cross the boundary as React slots, never manifest loaders.
 * `model` scopes them: an embedded collection of another model never takes these insertions.
 */
export default function ModelExtensionViews({ model, views = none, insertions, formKind = "form", children }: { model?: string; views?: Slots; insertions?: Partial<Record<InsertionKind, Slots>>; formKind?: "form" | "modal"; children: ReactNode }) {
  const value = useMemo(() => ({ model, views, insertions: insertions ?? {}, formKind }), [model, views, insertions, formKind]);
  return <ExtensionViewsContext.Provider value={value}>{children}</ExtensionViewsContext.Provider>;
}

export function useModelFormViewKind(model?: string): "form" | "modal" {
  const value = useContext(ExtensionViewsContext);
  return value.model === undefined || value.model === model ? value.formKind ?? "form" : "form";
}

/** Whole-block form views of extensions (`views.form`), by module. */
export function useModelExtensionViews(model?: string) {
  const value = useContext(ExtensionViewsContext);
  return !model || value.model === undefined || value.model === model ? value.views : none;
}
/** Insertion files of extensions for one view of `model`, by module. */
export function useModelExtensionInsertions(kind: InsertionKind, model: string): Slots {
  const value = useContext(ExtensionViewsContext);
  return (value.model === undefined || value.model === model) ? value.insertions[kind] ?? none : none;
}
