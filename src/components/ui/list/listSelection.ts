import type { ListPage } from "@/lib/list/types";

export type ListSelection = { page: ListPage | null; ids: readonly string[] };
export const emptyListSelection: ListSelection = { page: null, ids: [] };

/** Selections belong to one query response, never to another page/filter/source. */
export function selectedPageIds(selection: ListSelection, page: ListPage | null): readonly string[] {
  if (!page || selection.page !== page) return [];
  const visible = new Set(page.rows.map(row => row.id));
  return selection.ids.filter(id => visible.has(id));
}

export function togglePageRecord(selection: ListSelection, page: ListPage, id: string): ListSelection {
  const ids = new Set(selectedPageIds(selection, page));
  if (!page.rows.some(row => row.id === id)) return selection;
  if (ids.has(id)) ids.delete(id); else ids.add(id);
  return { page, ids: [...ids] };
}

export function toggleWholePage(selection: ListSelection, page: ListPage): ListSelection {
  const ids = [...new Set(page.rows.map(row => row.id))];
  return { page, ids: selectedPageIds(selection, page).length === ids.length ? [] : ids };
}
