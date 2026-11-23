"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { ModelClientConfig } from "@/lib/modules/config";

/** Server-resolved form slots; manifest loaders never enter the client bundle. */
const Templates = createContext<Readonly<Record<string, ReactNode>>>({});
export function ModelFormTemplates({ value, children }: { value: Readonly<Record<string, ReactNode>>; children: ReactNode }) {
  const inherited = useContext(Templates);
  const merged = useMemo(() => ({ ...inherited, ...value }), [inherited, value]);
  return <Templates value={merged}>{children}</Templates>;
}
export function useModelFormTemplate(model: string, view: "modal" | "form" = "modal") { return useContext(Templates)[`${model}:${view}`]; }

type Presentation = {
  model: string;
  config: ModelClientConfig;
  id?: string;
  defaults?: Readonly<Record<string, unknown>>;
  onSaved: (values: Record<string, unknown>) => void;
};
const Context = createContext<Presentation | null>(null);
export const ModelFormPresentation = Context.Provider;
export function useModelFormPresentation(model: string) {
  const value = useContext(Context);
  return value?.model === model ? value : null;
}
