import assert from "node:assert/strict";
import test from "node:test";
import { resolveListLabels } from "./relation-labels";
import { readListDisplayValue, readListValue, type ListResult } from "./types";
import { formatListValue } from "../../components/ui/list/listFormat";
import type { Many2OneLoader } from "../many2one/model-lookup";
import { groupedPage, groupDisplayLabel } from "./grouping";
import type { ListState } from "./types";

const column = { field: "fabricanteId", label: "Fabricante", widget: "many2one" } as const;
const page: ListResult = { ok: true, data: { rows: [{ id: "1", fabricanteId: "a" }, { id: "2", fabricanteId: "a" }, { id: "3", fabricanteId: null }, { id: "4", fabricanteId: "missing" }], total: 4, page: 1, pageSize: 10 } };

test("relations resolve once per distinct ID batch and preserve stored values without publishing lookup records", async () => {
  let calls = 0;
  const result = await resolveListLabels(page, { fabricanteId: async request => {
    calls++; assert.deepEqual(request, { ids: ["a", "missing"] });
    return { ok: true, items: [{ value: "a", label: "Toyota", record: { id: "a", email: "not-for-list" } }, { value: "unrequested", label: "Ignore", record: { id: "unrequested" } }], total: 1, page: 1, pageSize: 2 };
  } });
  assert.equal(calls, 1); assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(readListValue(result.data.rows[0], "fabricanteId"), "a");
  assert.equal(readListDisplayValue(result.data.rows[0], column), "Toyota");
  assert.equal(readListDisplayValue(result.data.rows[1], column), "Toyota");
  assert.equal(readListDisplayValue(result.data.rows[2], column), null);
  assert.equal(readListDisplayValue(result.data.rows[3], column), "No disponible");
  assert.equal(JSON.stringify(result).includes("not-for-list"), false);
  assert.equal(JSON.stringify(result).includes("unrequested"), false);
  assert.equal(page.ok && Object.hasOwn(page.data.rows[0], "$labels"), false);
  assert.equal(readListDisplayValue({ ...result.data.rows[0], fabricanteId: "different" }, column), "No disponible");
});

test("lookup failures fail the page closed; empty, failed and grouped pages do not query relations", async () => {
  for (const load of [async () => ({ ok: false as const, error: "private" }), async () => { throw new Error("secret"); }]) {
    const result = await resolveListLabels(page, { fabricanteId: load });
    assert.equal(result.ok, false); assert.equal(JSON.stringify(result).includes("secret"), false);
  }
  const load: Many2OneLoader = async () => { throw new Error("Must not query"); };
  for (const result of [{ ok: false as const, error: "Original" }, { ok: true as const, data: { rows: [], groups: [{ value: "active", count: 3 }], total: 3, page: 1, pageSize: 10 } }]) {
    assert.equal(await resolveListLabels(result, { fabricanteId: load }), result);
  }
  const empty: ListResult = { ok: true, data: { rows: [{ id: "1", fabricanteId: null }], total: 1, page: 1, pageSize: 10 } };
  assert.equal((await resolveListLabels(empty, { fabricanteId: load })).ok, true);
});

test("large server pages resolve in bounded batches, without cross-request label caches", async () => {
  const result: ListResult = { ok: true, data: { rows: Array.from({ length: 102 }, (_, index) => ({ id: `r${index}`, fabricanteId: `b${index}` })), total: 102, page: 1, pageSize: 102 } };
  const batches: number[] = [];
  const load: Many2OneLoader = async request => {
    const ids = request.ids!; batches.push(ids.length);
    return { ok: true, items: ids.map(id => ({ value: id, label: `Marca ${id}`, record: { id } })), total: ids.length, page: 1, pageSize: ids.length };
  };
  await resolveListLabels(result, { fabricanteId: load });
  await resolveListLabels(result, { fabricanteId: load });
  assert.deepEqual(batches, [100, 2, 100, 2]);
});

test("selection presentation uses labels and preserves unknown values and raw filtering IDs", () => {
  const selection = { field: "vehicleType", label: "Tipo", options: [{ value: "car", label: "Automóvil" }] };
  assert.equal(formatListValue("car", selection), "Automóvil");
  assert.equal(formatListValue("unknown", selection), "unknown");
  assert.equal(formatListValue(null, selection), "—");
  assert.equal(readListDisplayValue({ id: "1", fabricanteId: "a" }, column), "No disponible");
  assert.equal(readListDisplayValue({ id: "1", fabricanteId: "a" }, { field: "fabricanteId", label: "ID" }), "a");
});

test("group headers resolve the current level in batches without merging identical names or changing keys", async () => {
  const state: ListState = { query: "", page: 2, pageSize: 4, sort: "name", direction: "asc", filters: [], groupBy: ["active", "fabricanteId"], groupPath: [true] };
  const source: ListResult = { ok: true, data: groupedPage(state, 9, [{ value: "a", count: 2 }, { value: "b", count: 3 }, { value: null, count: 1 }, { value: "missing", count: 3 }, { value: "next-page", count: 1 }]) };
  let calls = 0;
  const result = await resolveListLabels(source, { fabricanteId: async request => {
    calls++; assert.deepEqual(request.ids, ["a", "b", "missing"]);
    return { ok: true, total: 2, page: 1, pageSize: 3, items: ["a", "b"].map(id => ({ value: id, label: "Volkswagen", record: { id, email: "hidden" } })) };
  }, otherId: async () => { throw new Error("Unrelated provider must not query"); } });
  assert.equal(calls, 1); assert.ok(result.ok);
  assert.equal(result.data.groupField, "fabricanteId");
  assert.equal(result.data.hasMoreGroups, true); assert.equal(result.data.page, 2); assert.equal(result.data.total, 9);
  assert.deepEqual(result.data.groups?.map(group => [group.value, group.count, groupDisplayLabel(group, column)]), [["a", 2, "Volkswagen"], ["b", 3, "Volkswagen"], [null, 1, "Sin valor"], ["missing", 3, "No disponible"]]);
  assert.equal(JSON.stringify(result).includes("hidden"), false);
  assert.equal(source.data.groups?.[0].label, undefined);
  const denied = await resolveListLabels(source, { fabricanteId: async () => ({ ok: false, error: "Denied" }) });
  assert.equal(denied.ok, false);
  assert.equal(groupDisplayLabel({ value: "car", count: 1 }, { field: "type", label: "Tipo", options: [{ value: "car", label: "Automóvil" }] }), "Automóvil");
});
