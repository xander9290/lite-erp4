import assert from "node:assert/strict";
import test from "node:test";
import { groupingPlan, groupedPage } from "./grouping";
import { patchListParams, readListState } from "./state";
import { listStateSchema } from "./query";
import type { ListState } from "./types";
import { loadGroupingSample } from "@/app/sample/list-grouping.actions";

const columns = [{ field: "brand", label: "Marca", groupable: true }, { field: "active", label: "Activo", type: "boolean" as const, groupable: true }];
const config = { model: "test", columns, searchFields: [] };
const state: ListState = { query: "", sort: "brand", direction: "asc", page: 1, pageSize: 1, filters: [] };

test("group paths preserve null, empty strings, case and native booleans as exact predicates", () => {
  for (const value of [null, "", "Marca", "marca"]) {
    assert.deepEqual(groupingPlan(columns, { ...state, groupBy: ["brand", "active"], groupPath: [value, false] }), { field: undefined, predicates: [{ brand: value }, { active: false }] });
  }
});

test("grouping fails closed for unauthorized fields, relations, dates, duplicates, wrong types and excessive depth", () => {
  for (const extra of [
    { groupBy: ["password"] }, { groupBy: ["brand", "brand"] }, { groupBy: ["brand", "active", "x", "y"] },
    { groupBy: ["active"], groupPath: ["false"] }, { groupBy: ["brand"], groupPath: [false] }, { groupPath: [null] },
  ]) assert.throws(() => groupingPlan(columns, { ...state, ...extra }));
  for (const column of [{ field: "user.login", label: "Usuario", groupable: true }, { field: "date", label: "Fecha", type: "datetime" as const, groupable: true }]) assert.throws(() => groupingPlan([column], { ...state, groupBy: [column.field] }));
  assert.equal(listStateSchema.safeParse({ ...state, groupPath: [Number.NaN] }).success, false);
});

test("URL grouping preserves order and prefixes, resets pagination and survives clearing filters", () => {
  const query = patchListParams("other=1&demo_page=5", { groupBy: ["brand", "active"] }, "demo");
  const params = new URLSearchParams(patchListParams(query, { query: "", filters: [] }, "demo"));
  assert.equal(params.get("other"), "1"); assert.equal(params.has("demo_page"), false);
  assert.deepEqual(readListState(config, params, 25, "demo").groupBy, ["brand", "active"]);
  const bad = readListState(config, new URLSearchParams("group=bad-json"));
  assert.equal(listStateSchema.safeParse(bad).success, false);
  assert.equal(new URLSearchParams(patchListParams(params.toString(), { groupBy: [] }, "demo")).has("demo_group"), false);
});

test("group pagination uses one extra group, never a misleading record-page count", () => {
  const result = groupedPage(state, 99, [{ value: "A", count: 70 }, { value: "B", count: 29 }]);
  assert.equal(result.hasMoreGroups, true); assert.equal(result.total, 99); assert.equal(result.groups?.length, 1); assert.deepEqual(result.rows, []);
});

test("server demo loads all three levels and paginates records within the exact leaf", async () => {
  const base = { ...state, sort: "name", groupBy: ["active", "insured", "available"] };
  const root = await loadGroupingSample(base);
  assert.ok(root.ok); assert.equal(root.data.total, 96); assert.equal(root.data.hasMoreGroups, true);
  const middle = await loadGroupingSample({ ...base, groupPath: [true] });
  assert.ok(middle.ok); assert.equal(middle.data.total, 48);
  const leaf = await loadGroupingSample({ ...base, groupPath: [true, true, false], pageSize: 2 });
  assert.ok(leaf.ok); assert.equal(leaf.data.rows.length, 2); assert.ok(leaf.data.total > 2);
  assert.ok(leaf.data.rows.every(row => row.active === true && row.insured === true && row.available === false));
  const filtered = await loadGroupingSample({ ...base, groupPath: [true], filters: [{ field: "active", operator: "eq", value: "false" }] });
  assert.ok(filtered.ok); assert.equal(filtered.data.total, 0); assert.deepEqual(filtered.data.groups, []);
});
