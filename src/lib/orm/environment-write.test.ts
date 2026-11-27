import assert from "node:assert/strict";
import test from "node:test";
import { Model, defineModel, type ActionRecord, type ActionContext } from "./model";
import { Fields } from "./fields";
import { action, constraint } from "./decorators";
import { createModelService, type ServiceOperation } from "./service";
import { AccessError } from "../auth/policy";
import { ModelValidationError, type ModelContext, type RemoveContext } from "./context";
import { MAX_ENVIRONMENT_WRITE_DEPTH, readOnlyEnvironment, writeGuard, type ModelEnvironment } from "./environment";
import type { ModelRepository } from "./repository";
import type { Prisma } from "@/generated/prisma/client";

type Row = Record<string, unknown> & { id: string; revision: string };
let clock = Date.parse("2026-11-27T00:00:00.000Z");
const next = () => new Date(clock += 1000).toISOString();

/** In-memory repository: enough of the generated adapter for the save/remove pipeline. */
function memory(): ModelRepository<Record<string, unknown>> & { rows: Map<string, Row> } {
  const rows = new Map<string, Row>();
  let sequence = 0;
  return {
    rows,
    async read(_tx, id) { const row = rows.get(id); return row ? { ...row } as never : null; },
    async create(_tx, values) { const row = { ...values, id: `r${++sequence}`, revision: next() }; rows.set(row.id, row); return { ...row } as never; },
    async update(_tx, id, revision, values) {
      const row = rows.get(id);
      if (!row || row.revision !== revision) throw Object.assign(new Error("stale"), { code: "P2025" });
      const updated = { ...row, ...values, id, revision: next() }; rows.set(id, updated); return { ...updated } as never;
    },
    async remove(_tx, id, revision) { if (rows.get(id)?.revision !== revision) throw new Error("stale"); rows.delete(id); },
    async count() { return rows.size; },
    async list(_tx, query) { return [...rows.values()].slice(query.skip, query.skip + query.take) as never; },
  };
}

type Wiring = { env?: ModelEnvironment; denied?: ServiceOperation[] };
function serviceOf<T extends Record<string, unknown>>(contract: Parameters<typeof createModelService<T>>[0], repository: ModelRepository<T>, wiring: Wiring) {
  return createModelService(contract, repository, {
    list: { fields: ["name"], searchFields: ["name"] },
    authorize: async (_tx, _actor, operation) => { if (wiring.denied?.includes(operation)) throw new AccessError("DENIED"); return undefined; },
    environment: () => wiring.env!,
  });
}

const actor = { id: "actor", sessionVersion: 0 };
function transaction() {
  const activity: Record<string, unknown>[] = [];
  const tx = { recordActivity: { create: async ({ data }: { data: Record<string, unknown> }) => { activity.push(data); } } } as unknown as Prisma.TransactionClient;
  return { tx, activity };
}

test("create/write/unlink go through the target service: defaults, normalize, hooks, history and public output", async () => {
  const removed: string[] = [];
  const Note = defineModel(class extends Model {
    name = Fields.Text({ required: true, maxLength: 40 });
    body = Fields.Text();
    pinned = Fields.Boolean({ default: true });
    secret = Fields.Text({ sensitive: true });
    normalize(values: Record<string, unknown>) { return { ...values, name: typeof values.name === "string" ? values.name.trim().toUpperCase() : values.name }; }
    beforeSave(values: Record<string, unknown>) { return { ...values, body: values.body ?? "sin cuerpo" }; }
    beforeRemove(record: Readonly<Record<string, unknown>>, context: RemoveContext) { removed.push(`${record.name}:${context.id}`); }
  }, { name: "EnvNote", table: "env_notes" });
  const repository = memory();
  const wiring: Wiring = {};
  const service = serviceOf(Note, repository, wiring);
  const { tx, activity } = transaction();
  wiring.env = { EnvNote: service.environment(tx, actor) } as unknown as ModelEnvironment;
  const notes = service.environment(tx, actor);

  const created = await notes.create({ name: "  hola " });
  assert.deepEqual(created, { id: "r1", name: "HOLA", body: "sin cuerpo", pinned: true });
  assert.ok(Object.isFrozen(created));
  assert.equal(activity[0].kind, "create");

  const before = repository.rows.get("r1")!.revision;
  const written = await notes.write("r1", { body: "nuevo" });
  assert.equal(written.body, "nuevo");
  assert.equal(written.name, "HOLA", "untouched fields keep their stored value");
  assert.notEqual(repository.rows.get("r1")!.revision, before, "the revision read in this transaction advances");

  await notes.unlink("r1");
  assert.equal(repository.rows.size, 0);
  assert.deepEqual(removed, ["HOLA:r1"]);

  for (const attempt of [
    () => notes.create({ secret: "x" } as never),
    () => notes.create({ id: "forged" } as never),
    () => notes.create([] as never),
    () => notes.write("r9", {}),
    () => notes.write("", { body: "x" }),
    () => notes.write("missing", { body: "x" }),
    () => notes.unlink("missing"),
  ]) await assert.rejects(attempt, ModelValidationError);
  await assert.rejects(notes.create({ name: "x".repeat(41) }), /./, "Zod of the target still applies");
});

test("the target's create/write/unlink access is enforced", async () => {
  const Note = defineModel(class extends Model { name = Fields.Text({ required: true }); }, { name: "EnvLocked", table: "env_locked" });
  const repository = memory();
  const { tx } = transaction();
  const wiring: Wiring = { denied: ["create", "write", "unlink"] };
  const notes = serviceOf(Note, repository, wiring).environment(tx, actor);
  await assert.rejects(notes.create({ name: "a" }), AccessError);
  repository.rows.set("x", { id: "x", revision: next(), name: "a" });
  await assert.rejects(notes.write("x", { name: "b" }), AccessError);
  await assert.rejects(notes.unlink("x"), AccessError);
  assert.equal(repository.rows.get("x")!.name, "a");
});

test("a record in progress (action, save) cannot be written again through env", async () => {
  class Ticket extends Model {
    name = Fields.Text({ required: true });
    state = Fields.Text();
    @action({ label: "Cerrar" })
    async close(record: ActionRecord<Ticket>, context: ActionContext) {
      await (context.env as unknown as Record<string, { write(id: string, values: object): Promise<unknown> }>).EnvTicket.write(record.id, { state: "closed" });
    }
    async afterSave(record: Record<string, unknown>, context: ModelContext) {
      if (record.state === "self") await (context.env as unknown as Record<string, { write(id: string, values: object): Promise<unknown> }>).EnvTicket.write(record.id as string, { state: "loop" });
    }
  }
  const contract = defineModel(Ticket, { name: "EnvTicket", table: "env_tickets" });
  const repository = memory();
  const wiring: Wiring = {};
  const service = serviceOf(contract, repository, wiring);
  const { tx } = transaction();
  wiring.env = { EnvTicket: service.environment(tx, actor) } as unknown as ModelEnvironment;
  const created = await service.environment(tx, actor).create({ name: "T1" });
  const prisma = { $transaction: async (callback: (client: Prisma.TransactionClient) => unknown) => callback(tx) } as never;
  const result = await service.action(prisma, actor, { action: "close", id: created.id, revision: repository.rows.get(created.id)!.revision });
  assert.equal(result.ok, false);
  assert.match(!result.ok ? result.error : "", /esta misma operación/);
  assert.equal(repository.rows.get(created.id)!.state ?? null, null, "the action wrote nothing");
  // A hook writing its own record: rejected (the real transaction rolls the outer save back).
  await assert.rejects(service.environment(tx, actor).write(created.id, { state: "self" }), /esta misma operación/);
  assert.deepEqual(writeGuard(tx), { depth: 0, frames: [] }, "guards are released after failures");
});

test("nested env writes stop at the maximum depth", async () => {
  class Chain extends Model {
    name = Fields.Text({ required: true });
    level = Fields.Integer({ default: 0 });
    async afterSave(record: Record<string, unknown>, context: ModelContext) {
      await (context.env as unknown as Record<string, { create(values: object): Promise<unknown> }>).EnvChain.create({ name: "hijo", level: Number(record.level) + 1 });
    }
  }
  const contract = defineModel(Chain, { name: "EnvChain", table: "env_chain" });
  const repository = memory();
  const wiring: Wiring = {};
  const service = serviceOf(contract, repository, wiring);
  const { tx } = transaction();
  wiring.env = { EnvChain: service.environment(tx, actor) } as unknown as ModelEnvironment;
  await assert.rejects(service.environment(tx, actor).create({ name: "raíz" }), new RegExp(`máximo de ${MAX_ENVIRONMENT_WRITE_DEPTH} escrituras anidadas`));
  assert.equal(writeGuard(tx).depth, 0);
});

test("constraints, reactions and computed fields only query", async () => {
  class Guarded extends Model {
    name = Fields.Text({ required: true });
    @constraint("name")
    async check(_values: Record<string, unknown>, context: ModelContext) {
      await (context.env as unknown as Record<string, { create(values: object): Promise<unknown> }>).EnvGuarded.create({ name: "otro" });
    }
  }
  const contract = defineModel(Guarded, { name: "EnvGuarded", table: "env_guarded" });
  const repository = memory();
  const wiring: Wiring = {};
  const service = serviceOf(contract, repository, wiring);
  const { tx } = transaction();
  wiring.env = { EnvGuarded: service.environment(tx, actor) } as unknown as ModelEnvironment;
  await assert.rejects(service.environment(tx, actor).create({ name: "a" }), /sólo puede consultar/);
  assert.equal(repository.rows.size, 0);
  const readOnly = readOnlyEnvironment(wiring.env) as unknown as Record<string, Record<string, (...args: unknown[]) => Promise<unknown>>>;
  for (const operation of ["create", "write", "unlink"]) await assert.rejects(readOnly.EnvGuarded[operation]("x", {}), /sólo puede consultar/);
  assert.equal(await readOnly.EnvGuarded.count(), 0);
});

test("creating a line of the record in progress is rejected (its parent refresh would leave a stale revision)", async () => {
  class Order extends Model {
    name = Fields.Text({ required: true });
    @action({ label: "Agregar línea" })
    async addLine(record: ActionRecord<Order>, context: ActionContext) {
      await (context.env as unknown as Record<string, { create(values: object): Promise<unknown> }>).EnvOrderLine.create({ name: "L1", orderId: record.id });
    }
  }
  class OrderLine extends Model {
    name = Fields.Text({ required: true });
    orderId = Fields.Many2one("EnvOrder", { required: true });
  }
  const orders = memory(), lines = memory();
  const wiring: Wiring = {};
  const orderService = serviceOf(defineModel(Order, { name: "EnvOrder", table: "env_orders" }), orders, wiring);
  const lineService = createModelService(defineModel(OrderLine, { name: "EnvOrderLine", table: "env_order_lines" }), lines, {
    list: { fields: ["name"], searchFields: ["name"] }, authorize: async () => undefined, environment: () => wiring.env!,
    owners: [{ inverse: "orderId", parent: () => orderService.transaction }],
  });
  const { tx } = transaction();
  wiring.env = { EnvOrder: orderService.environment(tx, actor), EnvOrderLine: lineService.environment(tx, actor) } as unknown as ModelEnvironment;
  const order = await orderService.environment(tx, actor).create({ name: "Pedido" });
  const prisma = { $transaction: async (callback: (client: Prisma.TransactionClient) => unknown) => callback(tx) } as never;
  const result = await orderService.action(prisma, actor, { action: "addLine", id: order.id, revision: orders.rows.get(order.id)!.revision });
  assert.equal(result.ok, false);
  assert.match(!result.ok ? result.error : "", /ni sus líneas/);
  // Outside an operation on the order, the same env call works and refreshes the parent.
  const before = orders.rows.get(order.id)!.revision;
  lines.rows.clear();
  await lineService.environment(tx, actor).create({ name: "L2", orderId: order.id });
  assert.equal(lines.rows.size, 1);
  assert.notEqual(orders.rows.get(order.id)!.revision, before, "the parent document revision advanced");
});
