import assert from "node:assert/strict";
import test from "node:test";
import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { Fields, Model, defineModel, displayName, type DisplayRecord } from "./index";
import { createModelService } from "./service";
import { unboundRepository } from "./repository";

const variant = defineModel(class extends Model { name = Fields.Text({ required: true }); }, { name: "FormVariant", table: "form_variants" });
class Vehicle extends Model {
  name = Fields.Many2one("FormVariant", { required: true });
  readonly displayRelations = { nameRecord: variant };
  @displayName("nameRecord.name")
  label(record: DisplayRecord<Vehicle, "nameRecord.name">): string { return record.nameRecord.name; }
}
const model = defineModel(Vehicle, { name: "FormVehicle", table: "form_vehicles" });
const actor = { id: "actor", sessionVersion: 1 };
const revision = "2026-11-12T12:00:00.000Z";

function fixture() {
  let row = { id: "vehicle", revision, name: "corolla" };
  let active = true;
  let projections = 0;
  const tx = { user: { findUnique: async () => ({ active, isAdmin: true, sessionVersion: 1 }) } } as unknown as Prisma.TransactionClient;
  const prisma = { $transaction: async (run: (tx: Prisma.TransactionClient) => unknown) => {
    const before = { ...row };
    try { return await run(tx); } catch (error) { row = before; throw error; }
  } } as unknown as PrismaClient;
  const repository = {
    ...unboundRepository<{ name: string }>(),
    read: async () => ({ ...row }),
    update: async (_tx: Prisma.TransactionClient, _id: string, _revision: string, values: { name: string }) => {
      row = { ...row, ...values, revision: "2026-11-12T12:00:00.001Z" }; return { ...row };
    },
    lookupPaths: ["id", "nameRecord.name"],
    lookup: async (transaction: Prisma.TransactionClient, query: { fields: readonly string[]; where: Record<string, unknown>; skip: number; take: number }) => {
      assert.equal(transaction, tx);
      assert.deepEqual(query, { fields: ["id", "nameRecord.name"], where: { id: { in: ["vehicle"] } }, skip: 0, take: 1 });
      projections++;
      return [{ id: row.id, nameRecord: { name: row.name === "corolla" ? "Corolla" : "Yaris", privateData: "never publish" } }];
    },
  };
  const options = { list: { fields: ["name"], searchFields: [], sortable: [], filterable: [], groupable: [] } };
  return { prisma, repository, options, service: createModelService(model, repository, options), deactivate: () => { active = false; }, projections: () => projections, row: () => row };
}

test("form names resolve in the authorized transaction on read/save, outside editable values", async () => {
  const f = fixture();
  const opened = await f.service.read(f.prisma, actor, "vehicle");
  assert.deepEqual(opened, { ok: true, values: { id: "vehicle", revision, name: "corolla" }, displayName: "Corolla" });
  const saved = await f.service.save(f.prisma, actor, { id: "vehicle", revision, name: "yaris" });
  assert.ok(saved.ok);
  assert.equal(saved.displayName, "Yaris");
  assert.equal(saved.values.name, "yaris");
  assert.equal(Object.hasOwn(saved.values, "displayName"), false);
  assert.equal(JSON.stringify(saved).includes("privateData"), false);
  assert.equal(f.projections(), 2);
  assert.equal((await f.service.save(f.prisma, actor, { ...saved.values, displayName: "forged" })).ok, false);
  f.deactivate();
  assert.equal((await f.service.read(f.prisma, actor, "vehicle")).ok, false);
  assert.equal(f.projections(), 2);
});

test("stale bindings and mismatched projections fail closed and save rolls back", async () => {
  const f = fixture();
  const stale = createModelService(model, { ...f.repository, lookupPaths: [] }, f.options);
  assert.equal((await stale.read(f.prisma, actor, "vehicle")).ok, false);
  assert.equal(f.projections(), 0);
  const mismatched = createModelService(model, { ...f.repository, lookup: async () => [{ id: "another", nameRecord: { name: "Secret" } }] }, f.options);
  assert.equal((await mismatched.save(f.prisma, actor, { id: "vehicle", revision, name: "yaris" })).ok, false);
  assert.deepEqual(f.row(), { id: "vehicle", revision, name: "corolla" });
});

test("scalar/default names need no lookup and sensitive names fall back to ID", async () => {
  for (const sensitive of [false, true]) {
    const simple = defineModel(class extends Model { name = Fields.Text({ sensitive }); active = Fields.Boolean({ default: true }); }, { name: "ScalarFormName", table: "scalar_form_names" });
    const f = fixture();
    const service = createModelService(simple, { ...unboundRepository<ReturnType<typeof simple.parse>>(), read: async () => ({ ...f.row(), active: true }) }, { list: { fields: ["active"], searchFields: [], sortable: [], filterable: [], groupable: [] } });
    const result = await service.read(f.prisma, actor, "vehicle");
    assert.ok(result.ok);
    assert.equal(result.displayName, sensitive ? "vehicle" : "corolla");
    assert.equal(f.projections(), 0);
  }
});
