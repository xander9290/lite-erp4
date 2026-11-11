import assert from "node:assert/strict";
import test from "node:test";
import { Model, defineModel } from "./model";
import { Fields } from "./fields";
import { createModelService } from "./service";
import { unboundRepository } from "./repository";
import { repositoryFiles } from "./generator/bind";
import type { PrismaClient, Prisma } from "@/generated/prisma/client";

const options = { name: "DisplayExample", table: "display_examples" };
class Vehicle extends Model {
  name = Fields.Text({ required: true });
  plate = Fields.Text({ required: true });
  secret = Fields.Text({ sensitive: true });
  displayFields = ["name", "plate"] as const;
  displayName(row: Readonly<Record<string, unknown>>) {
    assert.equal(row.secret, undefined);
    return `${row.name} · ${row.plate}`;
  }
}
const model = defineModel(Vehicle, options);
test("display method projects dependencies, inherits, validates and stays outside values", () => {
  assert.equal(model.displayName({ id: "1", name: "Toyota", plate: "ABC", secret: "hidden" }), "Toyota · ABC");
  assert.deepEqual(Object.keys(model.createDefaults()), ["name", "plate", "secret"]);
  assert.equal(defineModel(class extends Vehicle {}, options).displayName({ id: "1", name: "Toyota", plate: "ABC" }), "Toyota · ABC");
  assert.throws(() => defineModel(class extends Vehicle { displayFields = ["secret"] as never; }, options), /displayFields/);
  assert.throws(() => defineModel(class extends Vehicle { displayFields = ["missing"] as never; }, options), /displayFields/);
  const named = defineModel(class extends Model { name = Fields.Text(); }, options);
  assert.equal(named.displayName({ id: "1", name: " " }), "1");
  const sensitive = defineModel(class extends Model { name = Fields.Text({ sensitive: true }); }, options);
  assert.deepEqual(sensitive.displayFields, ["id"]);
  assert.equal(sensitive.displayName({ id: "1", name: "hidden" }), "1");
});

test("lookup revalidates session, rejects forged config and only publishes ID/label", async () => {
  let account = { active: true, isAdmin: true, sessionVersion: 1 };
  let calls = 0;
  const tx = { user: { findUnique: async () => account } } as unknown as Prisma.TransactionClient;
  const prisma = { $transaction: async (run: (tx: Prisma.TransactionClient) => unknown, config: unknown) => {
    assert.deepEqual(config, { isolationLevel: "RepeatableRead" }); return run(tx);
  } } as unknown as PrismaClient;
  const service = createModelService(model, { ...unboundRepository<{ name: string; plate: string; secret: string | null }>(),
    count: async () => { calls++; return 2; },
    lookup: async (_tx, query) => {
      assert.deepEqual(query.fields, ["id", "name", "plate"]);
      assert.equal(query.take, 2); assert.equal(query.skip, 0);
      assert.deepEqual(query.where, { AND: [{ id: { in: ["1", "2"] } }] });
      return [{ id: "1", name: "Toyota", plate: "ABC", secret: "hidden" }];
    },
  }, { columns: [{ field: "name", label: "Nombre" }], searchFields: ["name"] });
  const actor = { id: "admin", sessionVersion: 1 };
  const result = await service.lookup(prisma, actor, { ids: ["1", "2"], pageSize: 1 });
  assert.deepEqual(result, { ok: true, total: 2, page: 1, pageSize: 2, items: [{ value: "1", label: "Toyota · ABC", record: { id: "1" } }] });
  for (const payload of [{ model: "User" }, { displayName: "{secret}" }, { searchFields: ["secret"] }, { id: "1", ids: ["2"] }]) assert.equal((await service.lookup(prisma, actor, payload)).ok, false);
  assert.equal(calls, 1);
  account = { ...account, isAdmin: false };
  assert.equal((await service.lookup(prisma, actor, {})).ok, false);
  account = { ...account, isAdmin: true, sessionVersion: 2 };
  assert.equal((await service.lookup(prisma, actor, {})).ok, false);
  assert.equal(calls, 1);
});

test("generated lookup uses explicit delegate, projection and excludes sensitive fields", () => {
  const source = repositoryFiles({ id: "display-test", depends: [], models: [{ model, clientFields: ["name", "plate", "secret"] }] })["DisplayExample.store.ts"];
  assert.match(source, /async lookup/);
  assert.match(source, /tx\.displayExample\.findMany/);
  assert.match(source, /new Set\(\["id", "name", "plate"\]\)/);
});
