import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
const { planOne2manyChanges } = createRequire(import.meta.url)("./changes.ts");

test("plans creates, updates and removals while preserving submitted order and IDs", () => {
  const owned = [{ id: "a" }, { id: "b" }, { id: "c" }];
  const submitted = [{ id: "c", quantity: 3 }, { quantity: 1 }, { id: "a", quantity: 2 }];
  const before = structuredClone(submitted);
  const plan = planOne2manyChanges(owned, submitted);
  assert.deepEqual(plan, {
    create: [{ index: 1, values: submitted[1] }],
    update: [{ index: 0, id: "c", values: submitted[0] }, { index: 2, id: "a", values: submitted[2] }], deleteIds: ["b"],
  });
  assert.deepEqual(submitted, before);
});

test("rejects duplicate, foreign, missing and invalid IDs", () => {
  assert.throws(() => planOne2manyChanges([{ id: "a" }], [{ id: "foreign" }]), /no pertenece/);
  assert.throws(() => planOne2manyChanges([{ id: "a" }], [{ id: "a" }, { id: "a" }]), /más de una vez/);
  assert.throws(() => planOne2manyChanges([{ id: "a" }, { id: "a" }], []), /duplicados/);
  for (const id of [null, "", " ", NaN, Infinity, 1.5, {}, Number.MAX_SAFE_INTEGER + 1]) assert.throws(() => planOne2manyChanges([], [{ id }]), /no es válido/);
});

test("zero remains an existing numeric ID distinct from the string zero", () => {
  const result = planOne2manyChanges([{ id: 0 }, { id: "0" }], [{ id: 0 }]);
  assert.equal(result.create.length, 0);
  assert.equal(result.update[0].id, 0);
  assert.deepEqual(result.deleteIds, ["0"]);
});

test("empty submitted collection plans removal of the complete owned collection", () => {
  assert.deepEqual(planOne2manyChanges([{ id: "a" }, { id: "b" }], []), { create: [], update: [], deleteIds: ["a", "b"] });
});
