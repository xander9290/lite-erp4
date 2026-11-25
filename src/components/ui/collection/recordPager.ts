"use client";

import { useMemo, useSyncExternalStore } from "react";

/**
 * Record pager for forms opened from a collection: the list/card page remembers the IDs it showed
 * (in order) under its URL, and the form looks up its `returnTo` there. Navigation is presentation
 * only and stays inside that page; every record is still read through its authorized service.
 * sessionStorage is per tab and may be unavailable: then the pager simply does not appear.
 */
const storageKey = "lite-erp:record-pages";
const maxEntries = 20;
const maxIds = 100;

type Entry = { readonly url: string; readonly ids: readonly string[] };
type Storage = Pick<globalThis.Storage, "getItem" | "setItem">;
export type RecordPager = { readonly position: number; readonly total: number; readonly previous?: string; readonly next?: string };

const browserStorage = (): Storage | null => {
  try { return typeof window === "undefined" ? null : window.sessionStorage; } catch { return null; }
};

function readEntries(storage: Storage | null): Entry[] {
  try {
    const parsed: unknown = JSON.parse(storage?.getItem(storageKey) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((entry): entry is Entry => Boolean(entry) && typeof entry.url === "string" && Array.isArray(entry.ids) && entry.ids.every((id: unknown) => typeof id === "string")) : [];
  } catch { return []; }
}

/** Remember the IDs of the collection page shown at `url` (most recent first, bounded). */
export function rememberCollectionPage(url: string, ids: readonly string[], storage: Storage | null = browserStorage()) {
  if (!storage || !url.startsWith("/") || ids.length > maxIds) return;
  try {
    const entries = [{ url, ids: [...ids] }, ...readEntries(storage).filter(entry => entry.url !== url)].slice(0, maxEntries);
    storage.setItem(storageKey, JSON.stringify(entries));
  } catch { /* Quota or privacy mode: the form just shows no pager. */ }
}

/** Position of `id` in the page remembered for `url`, or null when it is not there. */
export function recordPagerFor(url: string | null | undefined, id: string | undefined, storage: Storage | null = browserStorage()): RecordPager | null {
  if (!url || !id) return null;
  const ids = readEntries(storage).find(entry => entry.url === url)?.ids ?? [];
  const index = ids.indexOf(id);
  if (index < 0 || ids.length < 2) return null;
  return { position: index + 1, total: ids.length, ...(index > 0 ? { previous: ids[index - 1] } : {}), ...(index < ids.length - 1 ? { next: ids[index + 1] } : {}) };
}

const subscribe = (notify: () => void) => {
  window.addEventListener("storage", notify);
  return () => window.removeEventListener("storage", notify);
};

/** Client-only read (the server snapshot is empty), so hydration always matches. */
export function useRecordPager(url: string | null | undefined, id: string | undefined): RecordPager | null {
  // A string snapshot keeps the value stable between renders.
  const snapshot = useSyncExternalStore(subscribe, () => JSON.stringify(recordPagerFor(url, id)), () => "null");
  return useMemo(() => JSON.parse(snapshot) as RecordPager | null, [snapshot]);
}
