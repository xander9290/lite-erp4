import assert from "node:assert/strict";
import test from "node:test";
import { Model, defineModel } from "./model";
import { Fields } from "./fields";
import { createModelService } from "./service";
import { unboundRepository } from "./repository";
import { AccessError } from "../auth/policy";
import { ModelValidationError } from "./context";
import { unavailableEnvironment } from "./environment";
import type { Prisma } from "@/generated/prisma/client";

const Contact = defineModel(class extends Model {
  name = Fields.Text({ required: true, maxLength: 60 });
  email = Fields.Text();
  kind = Fields.Selection([{ label: "Cliente", value: "customer" }, { label: "Proveedor", value: "supplier" }]);
  secret = Fields.Text({ sensitive: true });
  active = Fields.Boolean({ default: true });
}, { name: "EnvContact", table: "env_contacts" });

const tx = {} as Prisma.TransactionClient, actor = { id: "actor", sessionVersion: 0 };
const rows = [
  { id: "c1", revision: "2026-11-27T00:00:00.000Z", name: "Ana", email: "ana@x.mx", kind: "customer", secret: "s1", active: true },
  { id: "c2", revision: "2026-11-27T00:00:00.000Z", name: "Beto", email: null, kind: "supplier", secret: "s2", active: true },
];

function fixture(options: { deny?: boolean; noRead?: string[] } = {}) {
  const calls: { kind: string; query: unknown }[] = [];
  const scope = { active: true };
  const service = createModelService(Contact, {
    ...unboundRepository<ReturnType<typeof Contact.parse>>(),
    list: async (received, query) => {
      assert.equal(received, tx);
      calls.push({ kind: "list", query });
      const ids = JSON.stringify(query.where).match(/"in":\[([^\]]*)\]/)?.[1];
      return (ids ? rows.filter(row => ids.includes(`"${row.id}"`)) : rows).slice(query.skip, query.skip + query.take) as never;
    },
    count: async (received, where) => { assert.equal(received, tx); calls.push({ kind: "count", query: where }); return rows.length; },
  }, {
    list: { fields: ["name"], searchFields: ["name"] },
    authorize: async (received, who, operation) => {
      assert.equal(received, tx); assert.equal(who, actor); assert.equal(operation, "read");
      if (options.deny) throw new AccessError("DENIED");
      return scope;
    },
    elementAccess: async () => ({ fields: Object.fromEntries((options.noRead ?? []).map(name => [name, { noRead: true, noWrite: true, invisible: true, readOnly: true }])), blockedActions: [], canRead: paths => !paths.some(path => options.noRead?.includes(path)) }),
  });
  return { env: service.environment(tx, actor), calls, scope };
}

test("search projects only the requested public fields, applies record rules, domain, order and bounds", async () => {
  const { env, calls, scope } = fixture();
  const found = await env.search(d => d.all(d.eq("kind", "customer"), d.contains("name", "a")), { fields: ["name", "email"], limit: 10, order: "name", direction: "desc" });
  assert.deepEqual(found.map(row => Object.keys(row).sort()), [["email", "id", "name"], ["email", "id", "name"]]);
  assert.doesNotMatch(JSON.stringify(found), /s1|s2|revision/);
  assert.ok(Object.isFrozen(found) && Object.isFrozen(found[0]));
  const query = calls[0].query as { where: { AND: unknown[] }; sort: string; direction: string; take: number; skip: number; audit: boolean };
  assert.deepEqual(query.where.AND[0], scope, "record rules come first and always apply");
  assert.equal(query.where.AND.length, 2);
  assert.deepEqual([query.sort, query.direction, query.take, query.skip, query.audit], ["name", "desc", 10, 0, false]);
  const all = await env.search(null, { fields: ["name"] });
  assert.equal(all.length, 2);
  assert.equal((calls[1].query as { take: number }).take, 100, "default page size");
});

test("readMany keeps the requested order, omits missing IDs; read returns null when absent", async () => {
  const { env } = fixture();
  assert.deepEqual((await env.readMany(["c2", "missing", "c1", "c2"], ["name"])).map(row => row.id), ["c2", "c1", "c2"]);
  assert.deepEqual(await env.read("c1", ["name", "active"]), { id: "c1", name: "Ana", active: true });
  assert.equal(await env.read("missing", ["name"]), null);
  assert.deepEqual(await env.readMany([], ["name"]), []);
});

test("count combines record rules with the domain", async () => {
  const { env, calls, scope } = fixture();
  assert.equal(await env.count(d => d.eq("active", true)), 2);
  assert.equal(await env.count(), 2);
  assert.deepEqual((calls[0].query as { AND: unknown[] }).AND[0], scope);
  assert.deepEqual(calls[1].query, { AND: [scope] });
});

test("invalid fields, sensitive fields, drafts and bounds are rejected before querying", async () => {
  const { env, calls } = fixture();
  for (const attempt of [
    () => env.search(null, { fields: [] }),
    () => env.search(null, { fields: ["secret"] }),
    () => env.search(null, { fields: ["unknown"] }),
    () => env.search(null, { fields: ["name", "name"] }),
    () => env.search(null, { fields: ["name"], limit: 501 }),
    () => env.search(null, { fields: ["name"], offset: -1 }),
    () => env.search(null, { fields: ["name"], order: "secret" }),
    () => env.search(d => d.eq("secret", "x"), { fields: ["name"] }),
    () => env.search(d => d.eq("name", d.draft("email")), { fields: ["name"] }),
    () => env.search(d => d.eq("id", d.record.id), { fields: ["name"] }),
    () => env.readMany(Array.from({ length: 501 }, (_, index) => `id${index}`), ["name"]),
    () => env.read(42 as never, ["name"]),
  ]) await assert.rejects(attempt, ModelValidationError);
  assert.equal(calls.length, 0, "rejected requests never reach the repository");
});

test("group access and field read policies of the target are enforced", async () => {
  await assert.rejects(fixture({ deny: true }).env.search(null, { fields: ["name"] }), AccessError);
  const restricted = fixture({ noRead: ["email"] });
  await assert.rejects(restricted.env.search(null, { fields: ["email"] }), AccessError);
  await assert.rejects(restricted.env.search(d => d.eq("email", "a"), { fields: ["name"] }), AccessError);
  await assert.rejects(restricted.env.search(null, { fields: ["name"], order: "email" }), AccessError);
  assert.equal((await restricted.env.search(null, { fields: ["name"] })).length, 2);
  assert.equal(restricted.calls.length, 1);
});

test("contexts built outside a registered module fail explicitly on use", () => {
  assert.throws(() => (unavailableEnvironment as unknown as Record<string, unknown>).EnvContact, /módulos registrados/);
  assert.equal((unavailableEnvironment as unknown as Record<string, unknown>).then, undefined);
});
