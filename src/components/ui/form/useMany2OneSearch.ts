"use client";

import { useEffect, useState } from "react";
import { searchMany2One } from "@/lib/many2one/actions";
import type { Many2OneRequest, Many2OneResult } from "@/lib/many2one/types";

import type { Many2OneLoader } from "@/lib/many2one/model-lookup";

export function useMany2OneSearch(request: Many2OneRequest, enabled: boolean, delay = 250, load?: Many2OneLoader) {
  const [attempt, setAttempt] = useState(0);
  const key = JSON.stringify({ ...request, attempt });
  const [response, setResponse] = useState<{ key: string; load?: Many2OneLoader; result: Many2OneResult } | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let current = true;
    const timer = setTimeout(async () => {
      const { attempt: _attempt, ...input } = JSON.parse(key);
      void _attempt;
      let result: Many2OneResult;
      try {
        const { query, page, pageSize, id, ids } = input;
        result = load ? await load({ query, page, pageSize, ...(id ? { id } : {}), ...(ids ? { ids } : {}) }) : await searchMany2One(input);
      }
      catch { result = { ok: false, error: "No pudimos conectar. Revisa tu conexión e intenta nuevamente." }; }
      if (current) setResponse({ key, load, result });
    }, delay);
    return () => { current = false; clearTimeout(timer); };
  }, [key, enabled, delay, load]);

  const result = response?.load === load && response?.key === key ? response.result : null;
  return {
    data: result?.ok ? result : null,
    error: result && !result.ok ? result.error : null,
    loading: enabled && !result,
    retry: () => setAttempt(value => value + 1),
  };
}
