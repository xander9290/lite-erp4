"use client";

import { useCallback, useEffect } from "react";
import { listRecords } from "@/lib/list/actions";
import type { ListConfig, ListViewConfig, ListResult, ListState } from "@/lib/list/types";
import { useCollectionLoad } from "../collection/useCollectionLoad";
import { useCollectionState } from "../collection/useCollectionState";
import { rememberCollectionPage } from "../collection/recordPager";

export function useListView(config: ListViewConfig, pageSize: number, prefix: string, load?: (state: ListState) => Promise<ListResult>, grouping = true) {
  const query = useCollectionState(config, pageSize, prefix, grouping);
  const { state, update } = query;
  const key = JSON.stringify({ config, state });
  const request = useCallback(async (key: string) => {
    const input = JSON.parse(key);
    return load ? load(input.state) : listRecords(input.config as ListConfig, input.state);
  }, [load]);
  const response = useCollectionLoad(key, request);
  const { data } = response;
  useEffect(() => {
    if (data && data.page !== state.page) update({ page: data.page }, true);
  }, [data, state.page, update]);
  // Forms opened from this page can step through its records (grouped pages are not a flat order).
  const { currentUrl } = query;
  useEffect(() => {
    if (data && !data.groups && data.page === state.page) rememberCollectionPage(currentUrl, data.rows.map(row => row.id));
  }, [data, state.page, currentUrl]);

  return {
    ...query, ...response,
  };
}
