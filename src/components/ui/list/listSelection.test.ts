import assert from "node:assert/strict";
import test from "node:test";
import type { ListPage } from "@/lib/list/types";
import { emptyListSelection, selectedPageIds, togglePageRecord, toggleWholePage } from "./listSelection";

const page: ListPage = { rows: [{ id: "a" }, { id: "b" }, { id: "c" }], total: 9, page: 1, pageSize: 3 };
test("individual selection supports multiple rows and deselects without touching others", () => {
  const one = togglePageRecord(emptyListSelection, page, "a");
  const two = togglePageRecord(one, page, "b");
  assert.deepEqual(selectedPageIds(one, page), ["a"]);
  assert.deepEqual(selectedPageIds(two, page), ["a", "b"]);
  assert.deepEqual(selectedPageIds(togglePageRecord(two, page, "a"), page), ["b"]);
  assert.equal(togglePageRecord(two, page, "missing"), two);
});
test("select all affects the visible page and toggles full/partial selections", () => {
  const partial = togglePageRecord(emptyListSelection, page, "a");
  const all = toggleWholePage(partial, page);
  assert.deepEqual(selectedPageIds(all, page), ["a", "b", "c"]);
  assert.deepEqual(selectedPageIds(toggleWholePage(all, page), page), []);
});
test("changing query response, page or loader clears selection even when IDs are repeated", () => {
  const selected = toggleWholePage(emptyListSelection, page);
  assert.deepEqual(selectedPageIds(selected, null), []);
  assert.deepEqual(selectedPageIds(selected, { ...page }), []);
  const other = { ...page, page: 2, rows: [{ id: "d" }] };
  assert.deepEqual(selectedPageIds(selected, other), []);
  assert.deepEqual(selectedPageIds(togglePageRecord(selected, other, "d"), other), ["d"]);
});
