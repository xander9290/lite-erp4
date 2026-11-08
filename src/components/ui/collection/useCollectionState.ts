"use client";
import { useCallback } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { patchListParams, readListState } from "@/lib/list/state";
import type { ListFilter, ListState, ListViewConfig } from "@/lib/list/types";

export function useCollectionState(config: ListViewConfig, pageSize: number, prefix: string) {
  const pathname = usePathname(), params = useSearchParams();
  const serialized = params.toString();
  const state = readListState(config, params, pageSize, prefix);
  const update = useCallback((patch: Partial<ListState>, replace = false) => {
    const query = patchListParams(serialized, patch, prefix);
    const url = `${pathname}${query ? `?${query}` : ""}${window.location.hash}`;
    if (url === `${window.location.pathname}${window.location.search}${window.location.hash}`) return;
    if (replace) window.history.replaceState(null, "", url); else window.history.pushState(null, "", url);
  }, [serialized, pathname, prefix]);
  return {
    state, update,
    setFilter: (field: string, filter: ListFilter | null) => update({ filters: [...state.filters.filter(current => current.field !== field), ...(filter ? [filter] : [])] }),
    clearFilters: () => update({ query: "", filters: [] }),
    currentUrl: `${pathname}${serialized ? `?${serialized}` : ""}`,
  };
}
