import assert from "node:assert/strict";
import test from "node:test";
import { deleteFormRecord, formDeleteReturnHref, formDeleteTarget } from "./formDeletion";
import { UnsavedChanges } from "./unsavedChanges";

const target = { id: "record", revision: "2026-11-12T12:00:00.000Z" };

test("only a saved identity/revision can be deleted; no editable fields are sent", async () => {
  assert.equal(formDeleteTarget({}), null);
  assert.equal(formDeleteTarget({ id: "new" }), null);
  assert.equal(formDeleteTarget({ ...target, revision: "yesterday" }), null);
  assert.deepEqual(formDeleteTarget({ ...target, name: "Unsaved draft" }), target);
  await deleteFormRecord(target, async selected => { assert.deepEqual(selected, [target]); return { ok: true, deleted: 1 }; });
});

test("return destinations retain exact collection queries and reject external/detail paths", () => {
  const base = "/erp/flota/fabricante";
  const filtered = base + "?page=2&query=VW#cards";
  assert.equal(formDeleteReturnHref(filtered, base), filtered);
  assert.equal(formDeleteReturnHref(base + "/tarjetas?page=2", base, [base + "/tarjetas"]), base + "/tarjetas?page=2");
  for (const input of [undefined, "https://evil.test", "//evil.test", "/\\evil.test", "/erp/usuarios", base + "/deleted-id", base + "/nuevo", base + "\n", "javascript:alert(1)", "/erp/flota/%66abricante", "/erp/flota/fabricante/../vehicle"]) assert.equal(formDeleteReturnHref(input, base), base);
  assert.throws(() => formDeleteReturnHref(null, "javascript:alert(1)"));
});

test("cancelled or failed deletion preserves drafts and never navigates", async () => {
  let dirty = true, writes = 0, navigations = 0, prompts = 0;
  const guard = new UnsavedChanges(async () => { throw new Error("No second generic prompt"); });
  guard.register(() => dirty, () => { dirty = false; });
  const remove = async () => {
    await deleteFormRecord(target, async () => { writes++; return { ok: false, kind: "validation", error: "Referenced record" }; });
    navigations++;
  };
  assert.equal(await guard.run(remove, async () => { prompts++; return false; }), false);
  assert.equal(writes, 0); assert.equal(dirty, true);
  await assert.rejects(guard.run(remove, async () => { prompts++; return true; }), /Referenced record/);
  assert.equal(writes, 1); assert.equal(dirty, true); assert.equal(navigations, 0); assert.equal(prompts, 2);
  await guard.run(async () => { await deleteFormRecord(target, async () => ({ ok: true, deleted: 1 })); navigations++; }, async () => true);
  assert.equal(navigations, 1); assert.equal(dirty, false);
});

test("unknown commits or wrong confirmation counts do not count as success", async () => {
  await assert.rejects(deleteFormRecord(target, async () => { throw new Error("Network lost"); }), /No se pudo confirmar/);
  for (const deleted of [0, 2]) await assert.rejects(deleteFormRecord(target, async () => ({ ok: true, deleted })), /No se pudo confirmar/);
});

test("deletion confirms even a clean record and rejects a changed form while confirming", async () => {
  const guard = new UnsavedChanges(async () => true);
  let prompts = 0, writes = 0;
  assert.equal(await guard.run(() => { writes++; }, async () => { prompts++; return false; }), false);
  assert.equal(prompts, 1); assert.equal(writes, 0);
  let settle!: (answer: boolean) => void;
  const pending = guard.run(() => { writes++; }, () => new Promise<boolean>(resolve => { settle = resolve; }));
  await Promise.resolve();
  const unregister = guard.register(() => false);
  settle(true);
  assert.equal(await pending, false); assert.equal(writes, 0);
  unregister();
});

test("an existing leave prompt cannot authorize deletion", async () => {
  let settle!: (answer: boolean) => void;
  let writes = 0;
  const guard = new UnsavedChanges(() => new Promise<boolean>(resolve => { settle = resolve; }));
  guard.register(() => true);
  const leaving = guard.confirm();
  await Promise.resolve();
  assert.equal(await guard.run(() => { writes++; }, async () => true), false);
  settle(true);
  assert.equal(await leaving, true);
  assert.equal(writes, 0);
});
