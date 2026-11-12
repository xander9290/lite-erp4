import assert from "node:assert/strict";
import test from "node:test";
import type { Prisma } from "@/generated/prisma/client";
import { Fields, Model, defineModel } from "./index";
import { resolveDisplayNames, modelDisplayName } from "./display.server";
import { unboundRepository } from "./repository";
import { withDisplayName } from "./typed-display";

const target = defineModel(class extends Model { name = Fields.Text(); }, { name: "BatchNameTarget", table: "batch_name_targets" });
const base = defineModel(class extends Model { name = Fields.Text(); modelId = Fields.Many2one("BatchNameTarget"); }, { name: "BatchNameRecord", table: "batch_name_records" });
const model = withDisplayName(base, { model: target }, ["model.name"] as const, row => row.model?.name ?? "");
const tx = {} as Prisma.TransactionClient;

test("canonical names use bounded page batches, preserve IDs and never publish projections", async () => {
  const rows = Array.from({ length: 205 }, (_, i) => ({ id: `id-${i}`, name: `Fallback ${i}`, modelId: "target" }));
  let calls = 0;
  const names = await resolveDisplayNames(tx, rows, model, {
    ...unboundRepository<ReturnType<typeof base.parse>>(), lookupPaths: ["model.name"],
    lookup: async (transaction, query) => {
      assert.equal(transaction, tx); assert.deepEqual(query.fields, ["id", "model.name", "name"]);
      const ids = (query.where.id as { in: string[] }).in;
      assert.ok(ids.length <= 100); assert.equal(query.take, ids.length); calls++;
      return ids.slice().reverse().map(id => ({ id, name: "Fallback", model: { name: "Same label", secret: "private" } }));
    },
  });
  assert.equal(calls, 3); assert.equal(names.size, 205);
  assert.equal(names.get("id-0"), "Same label"); assert.equal(names.get("id-204"), "Same label");
  assert.equal(Object.hasOwn(rows[0], "$displayName"), false);
  assert.equal(JSON.stringify([...names]).includes("private"), false);
  assert.equal((await resolveDisplayNames(tx, [], model, unboundRepository())).size, 0);
});

test("all formatters fall back to public Text name, then ID, without exposing implicit fallback to methods", () => {
  const fallback = { id: "one", name: " Public name ", model: null };
  assert.equal(modelDisplayName(model, fallback), "Public name");
  assert.equal(model.displayName(fallback), "Public name");
  assert.equal(modelDisplayName(model, { ...fallback, name: " " }), "one");
  class Custom extends Model {
    name = Fields.Text(); code = Fields.Text(); displayFields = ["code"];
    displayName(record: Readonly<Record<string, unknown>>) { assert.equal(record.name, undefined); return ""; }
  }
  const custom = defineModel(Custom, { name: "EmptyDisplay", table: "empty_displays" });
  assert.equal(modelDisplayName(custom, { id: "one", name: "Fallback", code: "A" }), "Fallback");
  const sensitive = defineModel(class extends Model { name = Fields.Text({ sensitive: true }); }, { name: "HiddenDisplay", table: "hidden_displays" });
  assert.equal(modelDisplayName(sensitive, { id: "one", name: "Secret" }), "one");
  const relation = defineModel(class extends Model { name = Fields.Many2one("BatchNameTarget"); }, { name: "RelationDisplay", table: "relation_displays" });
  assert.equal(modelDisplayName(relation, { id: "one", name: "target-id" }), "one");
});

test("missing, duplicate or unexpected projection IDs fail closed", async () => {
  for (const records of [[], [{ id: "other" }], [{ id: "one" }, { id: "one" }]]) {
    await assert.rejects(() => resolveDisplayNames(tx, [{ id: "one", name: "Fallback" }], model, {
      ...unboundRepository<ReturnType<typeof base.parse>>(), lookupPaths: ["model.name"], lookup: async () => records,
    }));
  }
});
