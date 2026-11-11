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

test("bounded varchar widening preserves required/optional, index, default and mapping attributes", () => {
  for (const field of ['name String @db.VarChar(5)', 'name String? @unique @default("a") @map("model_name") @db.VarChar(5)']) {
    const source = `model Entry {\n id String @id\n ${field}\n @@map("entries")\n}`;
    assert.doesNotThrow(() => assertAdditiveEvolution(source, source.replace("VarChar(5)", "VarChar(120)")));
    for (const replacement of ["VarChar(4)", "Text", "VarChar(0)"]) assert.throws(() => assertAdditiveEvolution(source, source.replace("VarChar(5)", replacement)));
    const widened = source.replace("VarChar(5)", "VarChar(120)");
    for (const next of [widened.replace("name String", "other String"), widened.replace("String?", "String").replace("name String @db", "name String? @db"), widened.replace("@@map(\"entries\")", "@@map(\"other\")"), widened.replace("@db.VarChar(120)", '@default("new") @db.VarChar(120)')]) assert.throws(() => assertAdditiveEvolution(source, next));
  }
  const literal = 'model Entry {\n id String @id\n name String @default("@db.VarChar(5)")\n}';
  assert.throws(() => assertAdditiveEvolution(literal, literal.replace("VarChar(5)", "VarChar(120)")));
});
