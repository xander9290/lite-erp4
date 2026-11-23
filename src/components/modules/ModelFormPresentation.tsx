"use client";

import { createContext, useContext, type ReactNode } from "react";

/** Server-resolved form slots; manifest loaders never enter the client bundle. */
const Templates = createContext<Readonly<Record<string, ReactNode>>>({});
export const ModelFormTemplates = Templates.Provider;
export function useModelFormTemplate(model: string) { return useContext(Templates)[model]; }

type Presentation = {
  model: string;
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
