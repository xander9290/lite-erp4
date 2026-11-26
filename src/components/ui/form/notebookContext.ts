"use client";

import { createContext } from "react";

export const NotebookContext = createContext<{
  id: string;
  active: string | null;
  activate: (name: string) => void;
  reportErrors: (name: string, count: number) => void;
} | null>(null);

/**
 * Group page policy of the surrounding model form (ModelForm provides it). Keys are
 * `<Notebook id>/<page name>`; only Notebooks with an explicit `id` take part. Presentation:
 * hidden pages stay mounted (values, drafts and validation intact) but have no tab.
 */
export type NotebookPagePolicy = { readonly declared: ReadonlySet<string>; readonly hidden: ReadonlySet<string> };
export const NotebookPolicyContext = createContext<NotebookPagePolicy | null>(null);

export function notebookPageId(id: string, name: string) { return `${id}-page-${encodeURIComponent(name)}`; }
export function notebookTabId(id: string, name: string) { return `${id}-tab-${encodeURIComponent(name)}`; }
