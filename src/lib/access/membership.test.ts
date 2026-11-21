import assert from "node:assert/strict";
import test from "node:test";
import { assertUniqueModuleGroups } from "./membership";
import { accessCatalog, authorizeModel, authorizeModelEntry, userGroups, withRelationRead } from "./engine";
import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { setGroupMembers } from "./admin";
import { Fields } from "../orm/fields";

const catalog = accessCatalog();
for (const [id, module, label] of [["sales.seller", "sales", "Vendedor"], ["sales.manager", "sales", "Responsable"], ["billing.reader", "billing", "Consulta"]]) {
  catalog.groups.set(id, { id, module, label, implies: [] });
}
for (const id of ["sales.order", "billing.invoice", "billing.account"]) catalog.models.set(id, { active: Fields.Boolean({ label: "Activo" }).metadata });
catalog.grants.set("sales.order", [{ group: "sales.seller", model: "sales.order", perms: { read: true, create: true, write: true, unlink: false } }]);
catalog.rules.set("billing.invoice", [{ id: "billing.active", module: "billing", label: "Activos", models: ["billing.invoice"], operations: ["read"], domain: [{ field: "active", operator: "eq", value: true }] }]);
catalog.rules.set("billing.account", [{ id: "billing.owner", module: "billing", label: "Padres activos", models: ["billing.account"], operations: ["read"], domain: [{ field: "active", operator: "eq", value: true }] }]);
catalog.owners!.set("billing.invoice", { model: "billing.account", relation: "account" });

function fixture(ids = ["sales.seller"]) {
  return {
    user: { findUnique: async () => ({ active: true, isAdmin: false, sessionVersion: 1 }) },
    accessUserGroup: { findMany: async () => ids.map(groupId => ({ groupId })) },
    accessModelOverride: { findMany: async () => [] },
    accessRuleState: { findMany: async () => [] },
  } as unknown as Prisma.TransactionClient;
}
const actor = { id: "user", sessionVersion: 1 };

test("membership accepts different modules, rejects two jobs in one module and ignores retired ids", () => {
  assert.doesNotThrow(() => assertUniqueModuleGroups(["sales.seller", "billing.reader", "retired.group"], catalog.groups));
  assert.throws(() => assertUniqueModuleGroups(["sales.seller", "sales.manager"], catalog.groups), /Vendedor.*Responsable/);
});

test("no implicit membership; conflicting legacy assignments fail closed", async () => {
  assert.equal((await userGroups(fixture([]), actor.id)).size, 0);
  await assert.rejects(userGroups(fixture(["sales.seller", "sales.manager"]), actor.id), /dos grupos/);
});

test("relation authorization cannot become direct entry, writes or another actor/transaction", async () => {
  const tx = fixture();
  await authorizeModelEntry(tx, actor, "sales.order");
  await assert.rejects(authorizeModelEntry(tx, actor, "billing.invoice"), /permiso/);
  await assert.rejects(authorizeModel(tx, actor, "billing.invoice", "read"), /permiso/);
  await withRelationRead(tx, actor, "sales.order", "billing.invoice", async () => {
    const active = { AND: [{ active: { equals: true } }] };
    assert.deepEqual(await authorizeModel(tx, actor, "billing.invoice", "read"), { AND: [active, { account: { is: { AND: [active] } } }] }, "target and owner rules survive relational access");
    await assert.rejects(authorizeModel(tx, actor, "billing.invoice", "write"), /permiso/);
    await assert.rejects(authorizeModel(tx, { ...actor, id: "other" }, "billing.invoice", "read"), /permiso/);
    await assert.rejects(authorizeModel(fixture(), actor, "billing.invoice", "read"), /permiso/);
  });
  await assert.rejects(authorizeModel(tx, actor, "billing.invoice", "read"), /permiso/);
  await assert.rejects(withRelationRead(tx, actor, "billing.invoice", "sales.order", async () => undefined), /permiso/);
});

test("membership writes reject conflicts before changing assignments, under Serializable", async () => {
  let writes = 0;
  const tx = {
    user: { findUnique: async () => ({ active: true, isAdmin: true, sessionVersion: 1 }), count: async () => 1 },
    accessUserGroup: {
      findMany: async () => [{ userId: "user", groupId: "sales.manager" }],
      deleteMany: async () => { writes++; }, createMany: async () => { writes++; },
    },
  } as unknown as Prisma.TransactionClient;
  const prisma = { $transaction: async (run: (tx: Prisma.TransactionClient) => Promise<void>, options: { isolationLevel: string }) => {
    assert.equal(options.isolationLevel, "Serializable");
    return run(tx);
  } } as unknown as PrismaClient;
  await assert.rejects(setGroupMembers(prisma, actor, "sales.seller", ["user"]), /dos grupos/);
  assert.equal(writes, 0);
  await setGroupMembers(prisma, actor, "billing.reader", ["user"]);
  assert.equal(writes, 2);
});
