import assert from "node:assert/strict";
import test from "node:test";
import { mergeKanbanRows } from "./types";
import { createDemoRecords, demoPage } from "../../app/sample/collection-demo";

const state = { query: "", page: 1, pageSize: 3, sort: "name", direction: "asc" as const, filters: [] };
test("incremental kanban pages deduplicate identities and update existing revisions", () => {
  assert.deepEqual(mergeKanbanRows([{ id: "a", revision: "old" }, { id: "b" }], [{ id: "a", revision: "new" }, { id: "c" }]), [{ id: "a", revision: "new" }, { id: "b" }, { id: "c" }]);
});
test("card and column adapters paginate the complete filtered set instead of a single loaded page", () => {
  const records = createDemoRecords();
  const first = demoPage(records, state, "todo"), second = demoPage(records, { ...state, page: 2 }, "todo");
  assert.ok(first.ok && second.ok);
  assert.equal(first.data.total, 8); assert.equal(first.data.rows.length, 3);
  assert.equal(second.data.rows.every(record => !first.data.rows.some(previous => previous.id === record.id)), true);
  const search = demoPage(records, { ...state, query: "validar" });
  assert.ok(search.ok); assert.equal(search.data.total, 1);
  const filtered = demoPage(records, { ...state, filters: [{ field: "amount", operator: "between", value: "2500", to: "5000" }] });
  assert.ok(filtered.ok); assert.equal(filtered.data.total, 3);
  const dates = demoPage(records, { ...state, filters: [{ field: "deadline", operator: "between", value: "2026-11-10T00:00:00.000Z", to: "2026-11-13T00:00:00.000Z", precision: "instant" }] });
  assert.ok(dates.ok); assert.equal(dates.data.total, 3);
  assert.equal(demoPage(records, { ...state, filters: [{ field: "password", operator: "contains", value: "x" }] }).ok, false);
  assert.equal(demoPage(records, state, "__proto__").ok, false);
});
