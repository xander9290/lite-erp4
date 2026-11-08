import assert from "node:assert/strict";
import test from "node:test";
import { assertAdditiveEvolution } from "./evolution";

const original = `enum Status {\n draft\n done\n @@map("statuses")\n}\nmodel Entry {\n id String @id\n title String\n @@map("entries")\n}`;
test("additive evolution accepts optional/defaulted fields, enum additions and new models", () => {
  assert.doesNotThrow(() => assertAdditiveEvolution(original, original.replace(' done\n', ' done\n cancelled\n').replace(' title String\n', ' title String\n notes String?\n quantity Int @default(0)\n') + '\nmodel Extra {\n id String @id\n}'));
});
test("additive evolution rejects removals, renames, type/default changes and required columns without defaults", () => {
  for (const next of [original.replace(' title String\n', ''), original.replace(' title String', ' name String'), original.replace(' title String', ' title Int'), original.replace(' title String', ' title String?'), original.replace(' done\n', ''), original.replace(' title String\n', ' title String\n quantity Int\n'), original.replace('@@map("entries")', '@@map("renamed")')]) assert.throws(() => assertAdditiveEvolution(original, next));
});
