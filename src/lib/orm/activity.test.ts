import assert from "node:assert/strict";
import test from "node:test";
import { Fields } from "./fields";
import { trackedChanges, activityNoteSchema, activityRequestSchema } from "./activity";
import { fieldExpression } from "./generator/generate";
import { readActivity } from "./activity.server";
import type { Prisma } from "@/generated/prisma/client";

test("creation is a summary without an initial field snapshot; comparisons start on edits", () => {
  const metadata = { name: Fields.Text({ tracking: true }).metadata, active: Fields.Boolean({ tracking: true }).metadata };
  assert.deepEqual(trackedChanges(metadata, null, { name: "Nuevo", active: true }), []);
  assert.deepEqual(trackedChanges(metadata, { name: "Nuevo", active: true }, { name: "Editado", active: true }).map(change => [change.field, change.before, change.after]), [["name", "Nuevo", "Editado"]]);
});

test("old creation snapshots are hidden on read while edit differences remain visible", async () => {
  const change = { field: "name", label: "Nombre", type: "text", before: null, after: "Valor inicial anterior" };
  const common = { createdAt: new Date("2026-11-10T18:00:00.000Z"), body: null, changes: [change], actor: { id: "author", login: "demo", partner: null } };
  const tx = { recordActivity: { findMany: async () => [{ ...common, id: "old-create", kind: "create" }, { ...common, id: "edit", kind: "update" }] } } as unknown as Prisma.TransactionClient;
  const page = await readActivity(tx, "Example", { name: Fields.Text({ tracking: true }).metadata }, { id: "record" });
  assert.deepEqual(page.entries[0].changes, []);
  assert.deepEqual(page.entries[1].changes, [change]);
});

test("tracking is explicit, retains false/zero/null, and never captures untracked or sensitive fields", () => {
  const metadata = {
    name: Fields.Text({ tracking: true, label: "Nombre" }).metadata,
    active: Fields.Boolean({ tracking: true }).metadata,
    count: Fields.Integer({ tracking: true }).metadata,
    secret: Fields.Text({ sensitive: true }).metadata,
    plain: Fields.Text().metadata,
  };
  const changes = trackedChanges(metadata, { name: "Anterior", active: true, count: 1, secret: "viejo" }, { name: null, active: false, count: 0, secret: "nuevo", plain: "ignorado" });
  assert.deepEqual(changes.map(change => [change.field, change.before, change.after]), [["name", "Anterior", null], ["active", true, false], ["count", 1, 0]]);
  assert.deepEqual(trackedChanges(metadata, { active: false, count: 0 }, { active: false, count: 0 }), []);
  assert.throws(() => Fields.Text({ tracking: true, sensitive: true }), /sensible/);
  assert.throws(() => Fields.Text({ tracking: "yes" } as never), /booleano/);
});

test("selection labels are snapshots and the generator preserves tracking declarations", () => {
  const field = Fields.Selection([{ value: "draft", label: "Borrador" }, { value: "done", label: "Terminado" }], { tracking: true });
  const [change] = trackedChanges({ status: field.metadata }, { status: "draft" }, { status: "done" });
  assert.equal(change.beforeLabel, "Borrador"); assert.equal(change.afterLabel, "Terminado");
  assert.match(fieldExpression(field.metadata), /"tracking":true/);
});

test("note and cursor contracts reject forged actor, model, revisions, blank notes and oversized bodies", () => {
  const valid = { id: "record", body: " Nota interna ", requestId: "cf4a9d98-7aee-4b1c-9d76-14ada55938d2" };
  assert.equal(activityNoteSchema.parse(valid).body, "Nota interna");
  for (const patch of [{ actorId: "another" }, { model: "Other" }, { changes: [] }, { body: " " }, { body: "x".repeat(4001) }, { requestId: "invalid" }]) assert.equal(activityNoteSchema.safeParse({ ...valid, ...patch }).success, false);
  assert.equal(activityRequestSchema.safeParse({ id: "record", model: "Other" }).success, false);
  assert.equal(activityRequestSchema.safeParse({ id: "record", cursor: { id: "x", createdAt: "invalid" } }).success, false);
});
