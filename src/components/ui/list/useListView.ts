"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { listRecords } from "@/lib/list/actions";
import { patchListParams, readListState } from "@/lib/list/state";
import type { ListConfig, ListFilter, ListResult, ListState } from "@/lib/list/types";

export function useListView(config: ListConfig, pageSize: number, prefix: string) {
  const pathname = usePathname();
  const params = useSearchParams();
  const serialized = params.toString();
  const state = readListState(config, params, pageSize, prefix);
  const [attempt, setAttempt] = useState(0);
  const key = JSON.stringify({ config, state, attempt });
  const [response, setResponse] = useState<{ key: string; result: ListResult } | null>(null);

  const update = useCallback((patch: Partial<ListState>, replace = false) => {
    const query = patchListParams(serialized, patch, prefix);
    const url = `${pathname}${query ? `?${query}` : ""}${window.location.hash}`;
    if (url === `${window.location.pathname}${window.location.search}${window.location.hash}`) return;
    if (replace) window.history.replaceState(null, "", url);
    else window.history.pushState(null, "", url);
  }, [serialized, pathname, prefix]);

  useEffect(() => {
    let current = true;
    const timer = setTimeout(async () => {
      const input = JSON.parse(key);
      let result: ListResult;
      try { result = await listRecords(input.config, input.state); }
      catch { result = { ok: false, error: "No pudimos conectar. Intenta nuevamente." }; }
      if (current) setResponse({ key, result });
    }, 0);
    return () => { current = false; clearTimeout(timer); };
  }, [key]);

  const result = response?.key === key ? response.result : null;
  const data = result?.ok ? result.data : null;
  useEffect(() => {
    if (data && data.page !== state.page) update({ page: data.page }, true);
  }, [data, state.page, update]);

  return {
    state, data, error: result && !result.ok ? result.error : null, loading: !result,
    setFilter: (field: string, filter: ListFilter | null) => update({ query: "", filters: [...state.filters.filter(current => current.field !== field), ...(filter ? [filter] : [])] }),
    clearFilters: () => update({ query: "", filters: [] }),
    update, refresh: () => setAttempt(value => value + 1),
    currentUrl: `${pathname}${serialized ? `?${serialized}` : ""}`,
  };
}
