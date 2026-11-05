"use client";

import { createContext } from "react";

export const NotebookContext = createContext<{
  id: string;
  active: string | null;
  activate: (name: string) => void;
  reportErrors: (name: string, count: number) => void;
} | null>(null);

export function notebookPageId(id: string, name: string) { return `${id}-page-${encodeURIComponent(name)}`; }
export function notebookTabId(id: string, name: string) { return `${id}-tab-${encodeURIComponent(name)}`; }
