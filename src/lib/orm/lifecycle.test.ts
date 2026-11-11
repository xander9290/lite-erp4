import assert from "node:assert/strict";
import test from "node:test";
import { Fields, Model, defineModel, type ModelContext } from "./index";
import { createModelService } from "./service";
import { unboundRepository } from "./repository";
import type { SavedRecord } from "./record";
import type { Prisma, PrismaClient } from "@/generated/prisma/client";

type Values = { plate: string; state: "draft" | "done" };
const actor = { id: "admin", sessionVersion: 1 };
function fixture() {
  let row: SavedRecord<Values> | null = null;
  let reads = 0, normalizations = 0;
  let authorized = true;
  const contexts: ModelContext<Values>[] = [];
  const history: unknown[] = [];
  const model = defineModel(class extends Model {
    plate = Fields.Text({ required: true, trim: false, maxLength: 3, tracking: true });
    state = Fields.Selection([{ value: "draft", label: "Borrador" }, { value: "done", label: "Listo" }] as const, { required: true });
    normalize(values: Readonly<Record<string, unknown>>) {
      normalizations++;
      assert.equal(Object.isFrozen(values), true);
      return { ...values, plate: typeof values.plate === "string" ? values.plate.trim().toUpperCase() : values.plate };
    }
    beforeSave(values: Record<string, unknown>, context: ModelContext<Values>) {
      contexts.push(context);
      assert.equal(Object.isFrozen(context), true);
      if (context.previous) assert.equal(Object.isFrozen(context.previous), true);
      if (values.plate === "BAD") return { ...values, plate: "TOO-LONG" };
      return values;
    }
    afterSave(_record: Record<string, unknown>, context: ModelContext<Values>) { assert.equal(context, contexts.at(-1)); }
  }, { name: "LifecycleExample", table: "lifecycle_examples" });
  const tx = { user: { findUnique: async () => ({ active: authorized, isAdmin: true, sessionVersion: 1 }) }, recordActivity: { create: async (input: unknown) => { history.push(input); } } } as unknown as Prisma.TransactionClient;
  const prisma = { $transaction: async (run: (tx: Prisma.TransactionClient) => unknown) => run(tx) } as unknown as PrismaClient;
  const service = createModelService(model, { ...unboundRepository<Values>(),
    read: async () => { reads++; return row ? { ...row } : null; },
    create: async (_tx, values) => row = { ...values, id: "one", revision: "2026-11-10T00:00:00.000Z" },
    update: async (_tx, _id, revision, values) => row = { ...values, id: "one", revision: new Date(Date.parse(revision) + 1).toISOString() },
  }, { columns: [{ field: "plate", label: "Placas" }], searchFields: ["plate"], kanban: { field: "state" } });
  return { model, service, prisma, contexts, history, row: () => row, reads: () => reads, normalized: () => normalizations, revoke: () => { authorized = false; } };
}

test("normalize runs before schema validation; previous uses the checked snapshot in both hooks", async () => {
  const f = fixture();
  assert.equal(f.model.schema.safeParse({ plate: " abc ", state: "draft" }).success, false);
  const created = await f.service.save(f.prisma, actor, { plate: " abc ", state: "draft" });
  assert.ok(created.ok); assert.equal(created.values.plate, "ABC");
  assert.equal(f.contexts[0].previous, null);
  const before = f.reads();
  const saved = await f.service.save(f.prisma, actor, { ...created.values, plate: " xyz " });
  assert.ok(saved.ok); assert.equal(saved.values.plate, "XYZ");
  assert.deepEqual(f.contexts[1].previous, created.values);
  assert.equal(f.reads() - before, 2); // Existing revision read + final tracking read, no extra previous read.
  assert.equal(Object.hasOwn(saved.values, "previous"), false);
  assert.match(JSON.stringify(f.history), /ABC/); assert.match(JSON.stringify(f.history), /XYZ/);
  const normalized = f.normalized();
  assert.equal((await f.service.save(f.prisma, actor, { ...created.values, plate: "old" })).ok, false);
  assert.equal(f.normalized(), normalized); // Stale revisions never run normalization or hooks.
  const move = await f.service.move(f.prisma, actor, { id: saved.values.id, revision: saved.values.revision, from: "draft", to: "done" });
  assert.ok(move.ok); assert.equal(f.row()?.state, "done");
  assert.equal(f.contexts.at(-1)?.previous?.state, "draft");
  assert.equal(f.normalized(), normalized + 1);
});

test("normalization cannot discard forged fields or bypass validation and auth", async () => {
  const f = fixture();
  for (const extra of [{ createBy: "forged" }, { previous: {} }, { actor: "fake" }]) {
    assert.equal((await f.service.save(f.prisma, actor, { plate: "abc", state: "draft", ...extra })).ok, false);
  }
  assert.equal(f.normalized(), 0);
  for (const plate of [12, "long", "bad"]) {
    const result = await f.service.save(f.prisma, actor, { plate, state: "draft" });
    assert.equal(result.ok, false); if (!result.ok) assert.equal(result.kind, "validation");
  }
  assert.equal(f.row(), null);
  const normalized = f.normalized(); f.revoke();
  assert.equal((await f.service.save(f.prisma, actor, { plate: "abc", state: "draft" })).ok, false);
  assert.equal(f.normalized(), normalized);
});
