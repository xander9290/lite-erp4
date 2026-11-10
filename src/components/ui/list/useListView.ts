"use client";

import { useEffect, useState } from "react";
import { listRecords } from "@/lib/list/actions";
import type { ListConfig, ListViewConfig, ListResult, ListState } from "@/lib/list/types";
import { useCollectionState } from "../collection/useCollectionState";

export function useListView(config: ListViewConfig, pageSize: number, prefix: string, load?: (state: ListState) => Promise<ListResult>) {
  const query = useCollectionState(config, pageSize, prefix);
  const { state, update } = query;
  const [attempt, setAttempt] = useState(0);
  const key = JSON.stringify({ config, state, attempt });
  const [response, setResponse] = useState<{ key: string; load: typeof load; result: ListResult } | null>(null);


  useEffect(() => {
    let current = true;
    const timer = setTimeout(async () => {
      const input = JSON.parse(key);
      let result: ListResult;
      try { result = load ? await load(input.state) : await listRecords(input.config as ListConfig, input.state); }
      catch { result = { ok: false, error: "No pudimos conectar. Intenta nuevamente." }; }
      if (current) setResponse({ key, load, result });
    }, 0);
    return () => { current = false; clearTimeout(timer); };
  }, [key, load]);

  const result = response?.key === key && response.load === load ? response.result : null;
  const data = result?.ok ? result.data : null;
  useEffect(() => {
    if (data && data.page !== state.page) update({ page: data.page }, true);
  }, [data, state.page, update]);

  return {
    ...query, data, error: result && !result.ok ? result.error : null, loading: !result,
    refresh: () => setAttempt(value => value + 1),
  };
}
