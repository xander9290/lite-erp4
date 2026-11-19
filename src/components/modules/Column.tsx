"use client";

import { Children, Fragment, isValidElement, type ReactNode } from "react";
import type { InsertionEntry } from "@/components/ui/form/insertions/resolve";
import type { ModelColumn } from "@/lib/modules/collection";

/**
 * Column (list) or row (card/kanban) declared inside an `<Inserter>` of a collection
 * insertions file. Only presentation: the field must be published by the server and belong to
 * the extension (or to extensions it depends on). Renders nothing by itself.
 */
export default function Column(props: ModelColumn) { void props; return null; }

/** Declared columns of one entry; anything else is reported and ignored. */
export function entryColumns(entry: InsertionEntry<ReactNode>): { entry: InsertionEntry<readonly ModelColumn[]>; issues: string[] } {
  const columns: ModelColumn[] = [];
  const issues: string[] = [];
  const visit = (nodes: ReactNode) => Children.forEach(nodes, node => {
    if (node == null || typeof node === "boolean") return;
    if (isValidElement<{ children?: ReactNode }>(node) && node.type === Fragment) { visit(node.props.children); return; }
    if (isValidElement<ModelColumn>(node) && node.type === Column && typeof node.props.field === "string") { columns.push(node.props); return; }
    issues.push(`${entry.module}: ${entry.target} (${entry.position}) en una colección sólo admite <Column field="…" />.`);
  });
  visit(entry.content);
  return { entry: { ...entry, content: columns }, issues };
}
