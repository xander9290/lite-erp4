import assert from "node:assert/strict";
import test from "node:test";
import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { Model, defineModel } from "./model";
import { action } from "./decorators";
import { Fields } from "./fields";
import { unboundRepository } from "./repository";
import { createModelService } from "./service";
import type { FieldRestrictions } from "../access/element-policy";

class Item extends Model {
  name = Fields.Text({ required: true, tracking: true });
  secret = Fields.Text({ tracking: true, default: "server default" });
  code = Fields.Text();
  @action({ label: "Confirmar" }) confirm() { return { code: "confirmed" }; }
}
const model = defineModel(Item, { name: "PolicyItem", table: "policy_items" });
const actor = { id: "actor", sessionVersion: 1 };
const restriction = { noRead: true, noWrite: true, invisible: false, readOnly: false };
function fixture(fields: FieldRestrictions = {}, blockedActions: string[] = []) {
  let stored: ReturnType<typeof model.parse> & { id: string; revision: string } = { ...model.createDefaults(), id: "one", revision: "2026-11-21T00:00:00.000Z", name: "Public", secret: "PRIVATE VALUE", code: "LOCKED" };
  let writes = 0;
  let reactions = 0;
  const tx = { $executeRaw: async () => undefined, recordActivity: { create: async () => undefined, findMany: async () => [{ id: "event", kind: "update", createdAt: new Date(), body: null, actor: { id: "author", login: "author", partner: null }, changes: [{ field: "secret", label: "Secreto", type: "text", before: "PRIVATE BEFORE", after: "PRIVATE VALUE" }] }] } } as unknown as Prisma.TransactionClient;
  const prisma = { $transaction: async (run: (tx: Prisma.TransactionClient) => Promise<unknown>) => run(tx) } as unknown as PrismaClient;
  const service = createModelService({ ...model, reactionRules: [{ fields: ["code"], reads: ["secret"], writes: ["name"], preview: [] }], react: async () => { reactions++; return { patch: { name: "reaction" }, preview: {} }; } }, {
    ...unboundRepository<ReturnType<typeof model.parse>>(),
    read: async () => ({ ...stored }), count: async () => 1,
    lookup: async () => [{ ...stored }], list: async () => [{ ...stored }],
    update: async (_tx, _id, _revision, values) => { writes++; stored = { ...stored, ...values, revision: "2026-11-21T00:00:01.000Z" }; return { ...stored }; },
    create: async (_tx, values) => { writes++; stored = { ...stored, ...values }; return { ...stored }; },
  }, { authorize: async () => undefined, list: { fields: ["name", "secret", "code"], searchFields: ["name", "secret"], sortable: ["name", "secret"] },
    elementAccess: async () => ({ fields, blockedActions, canRead: paths => paths.every(path => !fields[path]?.noRead) }),
  });
  return { service, prisma, tx, stored: () => stored, writes: () => writes, reactions: () => reactions };
}

test("read/list/save/history omit private data and an omitted field keeps its stored value", async () => {
  const f = fixture({ secret: restriction });
  const opened = await f.service.read(f.prisma, actor, "one");
  assert.equal(opened.ok, true);
  if (!opened.ok) return;
  assert.equal(Object.hasOwn(opened.values, "secret"), false);
  const saved = await f.service.save(f.prisma, actor, { ...opened.values, name: "Changed" });
  assert.equal(saved.ok, true, JSON.stringify(saved));
  assert.equal(JSON.stringify(saved).includes("PRIVATE VALUE"), false);
  assert.equal(f.stored().secret, "PRIVATE VALUE");
  const list = await f.service.list(f.prisma, actor, { query: "", sort: "name", direction: "asc", page: 1, pageSize: 10, filters: [] });
  assert.equal(list.ok, true, JSON.stringify(list));
  assert.equal(JSON.stringify(list).includes("PRIVATE VALUE"), false);
  const history = await f.service.activity(f.prisma, actor, { id: "one" });
  assert.equal(history.ok, true, JSON.stringify(history));
  assert.equal(JSON.stringify(history).includes("PRIVATE"), false);
});

test("private reaction dependencies are denied before invoking model code", async () => {
  const restricted = fixture({ secret: restriction });
  assert.equal((await restricted.service.react(restricted.prisma, actor, { field: "code", values: { code: "draft" } })).ok, false);
  assert.equal(restricted.reactions(), 0);
  const normal = fixture();
  assert.equal((await normal.service.react(normal.prisma, actor, { field: "code", values: { code: "draft" } })).ok, true);
  assert.equal(normal.reactions(), 1);
});

test("creation uses the server default for an omitted private field", async () => {
  const f = fixture({ secret: restriction });
  const saved = await f.service.save(f.prisma, actor, { name: "New", code: "NEW" });
  assert.equal(saved.ok, true, JSON.stringify(saved));
  assert.equal(f.stored().secret, "server default");
  assert.equal(JSON.stringify(saved).includes("server default"), false);
});

test("forged private and no-write input is rejected before persistence; private sorting and filtering are denied", async () => {
  const f = fixture({ secret: restriction, code: { ...restriction, noRead: false } });
  for (const patch of [{ secret: "PRIVATE VALUE" }, { secret: "guess" }, { code: "forged" }]) {
    const opened = await f.service.read(f.prisma, actor, "one");
    assert.ok(opened.ok);
    const result = await f.service.save(f.prisma, actor, { ...opened.values, ...patch });
    assert.equal(result.ok, false);
  }
  assert.equal(f.writes(), 0);
  for (const query of [{ sort: "secret" }, { filters: [{ field: "secret", operator: "eq", value: "guess" }] }]) {
    assert.equal((await f.service.list(f.prisma, actor, { query: "", direction: "asc", page: 1, pageSize: 10, filters: [], ...query })).ok, false);
  }
});

test("lookup falls back to ID when its display field is private; blocked actions cannot run", async () => {
  const f = fixture({ name: restriction });
  const lookup = await f.service.lookupInTransaction(f.tx, actor, { ids: ["one"] });
  assert.deepEqual(lookup.items, [{ value: "one", label: "one", record: { id: "one" } }]);
  const blocked = fixture({}, ["confirm"]);
  assert.equal((await blocked.service.action(blocked.prisma, actor, { action: "confirm", id: "one", revision: blocked.stored().revision })).ok, false);
  assert.equal(blocked.writes(), 0);
  const normal = fixture();
  assert.equal((await normal.service.action(normal.prisma, actor, { action: "confirm", id: "one", revision: normal.stored().revision })).ok, true);
  assert.equal(normal.stored().code, "confirmed");
});
