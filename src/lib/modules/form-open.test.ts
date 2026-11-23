import assert from "node:assert/strict";
import test from "node:test";
import { Fields } from "../orm/fields";
import { prepareFormOpen } from "./form-open";
import type { ModelClientConfig } from "./config";

const fields = {
  name: Fields.Text({ required: true, maxLength: 30 }).metadata,
  parentId: Fields.Many2one("User").metadata,
  active: Fields.Boolean().metadata,
  secret: Fields.Text({ sensitive: true }).metadata,
  folio: Fields.Text({ sequence: { prefix: "X", padding: 3, reset: "none" } }).metadata,
  fixed: { ...Fields.Text().metadata, readOnly: true },
  note: Fields.Text().metadata,
};
const config = { id: "example.item", fields, fieldAccess: { note: { noRead: false, noWrite: true, invisible: false, readOnly: false } } } as unknown as ModelClientConfig;
const base = { model: config.id, view: "modal" };
function fixture() {
  const calls: string[] = [];
  return { calls, dependencies: {
    authorize: async (model: string, id?: string) => { calls.push(`target:${model}:${id ?? "new"}`); return config; },
    readOrigin: async (model: string, id: string) => { calls.push(`origin:${model}:${id}`); },
    lookup: async (_model: string, _field: string, draft: Record<string, unknown>, id: string) => {
      assert.equal(draft.parentId, id); calls.push(`lookup:${id}`);
      return { ok: true as const, items: [{ value: id, label: "Contacto", record: { id } }], total: 1, page: 1, pageSize: 10 };
    },
  } };
}

test("opening validates origin and scalar proposals, including relational authorization, without saving", async () => {
  const { calls, dependencies } = fixture();
  const result = await prepareFormOpen({ ...base, origin: { model: "core.user", id: "parent" }, defaults: { name: "  Example  ", parentId: "parent", active: false } }, dependencies);
  assert.deepEqual(result.defaults, { name: "Example", parentId: "parent", active: false });
  assert.deepEqual(calls, ["origin:core.user:parent", "target:example.item:new", "lookup:parent"]);
});

test("editing ignores stale proposals and never resolves their relations", async () => {
  const { calls, dependencies } = fixture();
  const result = await prepareFormOpen({ ...base, id: "existing", view: "form", defaults: { secret: "old", parentId: "forged", name: 123 } }, dependencies);
  assert.deepEqual(result.defaults, {});
  assert.deepEqual(calls, ["target:example.item:existing"]);
});

test("rejects forged identities, fields, protected proposals and unsupported presentations", async () => {
  const { dependencies } = fixture();
  for (const defaults of [{ id: "forged" }, { revision: "forged" }, { secret: "hidden" }, { folio: "X123" }, { fixed: "bad" }, { note: "denied" }, { unknown: "bad" }, { name: 123 }, { active: "false" }, { parentId: [] }]) {
    await assert.rejects(prepareFormOpen({ ...base, defaults }, dependencies));
  }
  for (const request of [{ ...base, id: "" }, { ...base, view: "kanban" }, { ...base, actor: "admin" }, { ...base, origin: { model: "core.user" } }, { ...base, model: "../../file" }]) {
    await assert.rejects(prepareFormOpen(request, dependencies));
  }
  await assert.rejects(prepareFormOpen({ ...base, defaults: { name: "x".repeat(16001) } }, dependencies));
});

test("denied target/origin or invisible/incompatible related record stops the open", async () => {
  const { dependencies } = fixture();
  await assert.rejects(prepareFormOpen(base, { ...dependencies, authorize: async () => { throw new Error("denied"); } }), /denied/);
  await assert.rejects(prepareFormOpen({ ...base, origin: { model: "core.user", id: "hidden" } }, { ...dependencies, readOrigin: async () => { throw new Error("denied origin"); }, authorize: async () => { assert.fail("target must not load"); } }), /denied origin/);
  for (const items of [[], [{ value: "hidden", label: "X", record: { id: "hidden" }, domainValid: false }]]) {
    await assert.rejects(prepareFormOpen({ ...base, defaults: { parentId: "hidden" } }, { ...dependencies, lookup: async () => ({ ok: true, items, total: items.length, page: 1, pageSize: 10 }) }), /referencia inicial/);
  }
});
