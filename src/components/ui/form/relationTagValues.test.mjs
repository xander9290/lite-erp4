import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const { relationTagIds, toggleRelationTag, resolveRelationTags } = createRequire(import.meta.url)("./relationTagValues.ts");
const option = id => ({ value: id, label: `Record ${id}`, record: { id, name: `Record ${id}` } });

test("tags do not duplicate IDs or mutate caller-owned arrays", () => {
  const source = Object.freeze(["a", "b", "a", null, "", 1]);
  assert.deepEqual(relationTagIds(source), ["a", "b"]);
  assert.deepEqual(relationTagIds(undefined), []);
  assert.equal(source.length, 6);
});

test("modal selection survives moving between pages and toggling a prior page", () => {
  const a = option("page-1"), b = option("page-2"), c = option("page-3");
  const original = Object.freeze([a]);
  let draft = toggleRelationTag(original, b);
  draft = toggleRelationTag(draft, c);
  assert.deepEqual(draft.map(item => item.value), [a.value, b.value, c.value]);
  draft = toggleRelationTag(draft, a);
  assert.deepEqual(draft.map(item => item.value), [b.value, c.value]);
  assert.deepEqual(original, [a]); // Cancel can keep the original untouched.
});

test("at the limit additions are blocked and removals remain available", () => {
  const a = option("a"), b = option("b");
  assert.deepEqual(toggleRelationTag([a], b, 1), [a]);
  assert.deepEqual(toggleRelationTag([a], a, 1), []);
});

test("callbacks preserve ID order independently of server ordering", () => {
  const result = resolveRelationTags(["b", "a"], [option("a"), option("b")]);
  assert.deepEqual(result.map(item => item.record.id), ["b", "a"]);
  assert.deepEqual(resolveRelationTags([], []), []);
});

test("unavailable IDs are not silently omitted from a selection", () => {
  assert.equal(resolveRelationTags(["a", "unavailable"], [option("a")]), null);
});
