import assert from "node:assert/strict";
import test from "node:test";
import type { Prisma } from "@/generated/prisma/client";
import { readAccessCapabilities, type AccessCatalog } from "./engine";
import { allowsActionGroups, modelUiCapabilities } from "./capabilities";
import type { AccessPerms } from "./declare";

const read = { read: true, create: false, write: false, unlink: false };
const write = { read: true, create: true, write: true, unlink: false };
const denied = { read: false, create: false, write: false, unlink: false };
const catalog: AccessCatalog = {
  groups: new Map([
    ["unit.reader", { id: "unit.reader", module: "unit", label: "Reader", implies: [] }],
    ["unit.writer", { id: "unit.writer", module: "unit", label: "Writer", implies: ["unit.reader"] }],
    ["unit.other", { id: "unit.other", module: "unit", label: "Other", implies: [] }],
  ]),
  grants: new Map([
    ["unit.item", [{ group: "unit.reader", model: "unit.item", perms: read }, { group: "unit.writer", model: "unit.item", perms: write }]],
    ["unit.catalog", [{ group: "unit.reader", model: "unit.catalog", perms: read }]],
  ]), rules: new Map(), models: new Map([["unit.item", {}], ["unit.catalog", {}], ["unit.empty", {}]]),
};
type Override = AccessPerms & { groupId: string; model: string; canImport?: boolean; canExport?: boolean };
function fixture({ groups = ["unit.writer"], overrides = [] as Override[], active = true, admin = false, version = 1 } = {}) {
  const queries: string[] = [];
  const tx = {
    user: { findUnique: async () => { queries.push("user"); return { active, isAdmin: admin, sessionVersion: version }; } },
    accessUserGroup: { findMany: async () => { queries.push("groups"); return groups.map(groupId => ({ groupId })); } },
    accessModelOverride: { findMany: async ({ where }: { where: { model: { in: string[] }; groupId: { in: string[] } } }) => {
      queries.push("overrides");
      assert.deepEqual(where.model.in, [...catalog.models.keys()]);
      return overrides.filter(row => where.model.in.includes(row.model) && where.groupId.in.includes(row.groupId));
    } },
  } as unknown as Prisma.TransactionClient;
  return { tx, queries };
}

test("capabilities batch inherited grants and overrides once for every model", async () => {
  const { tx, queries } = fixture({ overrides: [{ ...denied, groupId: "unit.writer", model: "unit.item" }] });
  const value = await readAccessCapabilities(tx, { id: "one", sessionVersion: 1 }, catalog);
  assert.deepEqual([...value.groups].sort(), ["unit.reader", "unit.writer"]);
  assert.deepEqual(value.modelAccess["unit.item"], read, "another group still grants read");
  assert.deepEqual(value.modelAccess["unit.catalog"], read);
  assert.deepEqual(value.modelAccess["unit.empty"], denied);
  assert.deepEqual(queries, ["user", "groups", "overrides"]);
});

test("snapshots reflect new overrides/membership per actor; unknown groups cannot grant access", async () => {
  const first = fixture();
  assert.deepEqual((await readAccessCapabilities(first.tx, { id: "a", sessionVersion: 1 }, catalog)).modelAccess["unit.item"], write);
  const second = fixture({ groups: ["unit.reader"], overrides: [{ ...denied, model: "unit.catalog", groupId: "unit.reader" }] });
  assert.deepEqual((await readAccessCapabilities(second.tx, { id: "b", sessionVersion: 1 }, catalog)).modelAccess["unit.catalog"], denied);
  const granted = fixture({ groups: ["unit.other"], overrides: [{ ...read, model: "unit.catalog", groupId: "unit.other" }] });
  assert.equal((await readAccessCapabilities(granted.tx, { id: "c", sessionVersion: 1 }, catalog)).modelAccess["unit.catalog"].read, true);
  const unknown = fixture({ groups: ["removed"], overrides: [{ ...write, model: "unit.item", groupId: "removed" }] });
  assert.deepEqual((await readAccessCapabilities(unknown.tx, { id: "d", sessionVersion: 1 }, catalog)).modelAccess["unit.item"], denied);
  assert.deepEqual(unknown.queries, ["user", "groups"]);
});

test("capabilities revalidate active/session before permissions; actual administrators bypass grants", async () => {
  for (const input of [{ active: false }, { version: 2 }]) {
    const f = fixture(input);
    await assert.rejects(readAccessCapabilities(f.tx, { id: "a", sessionVersion: 1 }, catalog), /sesión/);
    assert.deepEqual(f.queries, ["user"]);
  }
  const f = fixture({ admin: true });
  const value = await readAccessCapabilities(f.tx, { id: "a", sessionVersion: 1 }, catalog);
  assert.deepEqual(f.queries, ["user"]);
  assert.deepEqual(value.modelAccess["unit.empty"], { read: true, create: true, write: true, unlink: true, import: true, export: true });
});

test("UI capabilities fail closed and cannot turn a read denial into writable navigation", () => {
  assert.deepEqual(modelUiCapabilities(), { ...denied, move: false });
  assert.deepEqual(modelUiCapabilities({ read: false, create: true, write: true, unlink: true, move: true }), { ...denied, move: false });
  assert.deepEqual(modelUiCapabilities({ ...read, unlink: true, move: true }), { ...read, unlink: true, move: false });
  const actor = { isAdmin: false, groups: new Set(["unit.reader"]) };
  assert.equal(allowsActionGroups(actor, "unit"), true);
  assert.equal(allowsActionGroups(actor, "unit", ["reader"]), true);
  assert.equal(allowsActionGroups(actor, "unit", ["unit.writer"]), false);
  assert.equal(allowsActionGroups({ ...actor, isAdmin: true }, "unit", ["writer"]), true);
});

test("transfer permissions default closed, combine grants across groups and honor per-group overrides", async () => {
  const transfers: AccessCatalog = { ...catalog, grants: new Map(catalog.grants) };
  transfers.grants.set("unit.item", [
    { group: "unit.reader", model: "unit.item", perms: { ...read, import: true } },
    { group: "unit.writer", model: "unit.item", perms: { ...write, export: true } },
  ]);
  const f = fixture();
  const granted = (await readAccessCapabilities(f.tx, { id: "a", sessionVersion: 1 }, transfers)).modelAccess["unit.item"];
  assert.equal(granted.import, true); assert.equal(granted.export, true);
  const denied = fixture({ overrides: [{ ...write, groupId: "unit.writer", model: "unit.item", canImport: false, canExport: false }] });
  const overridden = (await readAccessCapabilities(denied.tx, { id: "a", sessionVersion: 1 }, transfers)).modelAccess["unit.item"];
  assert.equal(overridden.import, true, "another inherited group can still grant import");
  assert.equal(Boolean(overridden.export), false);
  const db = fixture({ overrides: [{ ...read, groupId: "unit.reader", model: "unit.catalog", canImport: true, canExport: true }] });
  const saved = (await readAccessCapabilities(db.tx, { id: "a", sessionVersion: 1 }, catalog)).modelAccess["unit.catalog"];
  assert.equal(saved.import, true); assert.equal(saved.export, true);
});


test("One2many hints require owner read permission without granting child permissions", async () => {
  const owned: AccessCatalog = { ...catalog, owners: new Map([["unit.item", { model: "unit.catalog", relation: "catalog" }]]) };
  const actor = { id: "a", sessionVersion: 1 };
  const first = fixture();
  assert.deepEqual((await readAccessCapabilities(first.tx, actor, owned)).modelAccess["unit.item"], write);
  const hidden = fixture({ overrides: [{ ...denied, model: "unit.catalog", groupId: "unit.reader" }] });
  assert.deepEqual((await readAccessCapabilities(hidden.tx, actor, owned)).modelAccess["unit.item"], denied);
  const childDenied = fixture({ overrides: [{ ...denied, model: "unit.item", groupId: "unit.writer" }, { ...denied, model: "unit.item", groupId: "unit.reader" }] });
  assert.deepEqual((await readAccessCapabilities(childDenied.tx, actor, owned)).modelAccess["unit.item"], denied);
  const admin = fixture({ admin: true });
  assert.deepEqual((await readAccessCapabilities(admin.tx, actor, owned)).modelAccess["unit.item"], { read: true, create: true, write: true, unlink: true, import: true, export: true });
});
