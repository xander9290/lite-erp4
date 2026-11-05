import assert from "node:assert/strict";
import test from "node:test";
import { UnsavedChanges } from "./unsavedChanges";

test("clean and unmounted forms never ask; any dirty form protects the page", async () => {
  let prompts = 0, dirty = false;
  const guard = new UnsavedChanges(async () => { prompts++; return false; });
  const unregister = guard.register(() => dirty);
  guard.register(() => false);
  assert.equal(await guard.confirm(), true);
  dirty = true;
  assert.equal(await guard.confirm(), false);
  unregister();
  assert.equal(await guard.confirm(), true);
  assert.equal(prompts, 1);
});

test("overlapping attempts share one modal and unmount cancels a pending destination", async () => {
  let answer!: (value: boolean) => void, prompts = 0;
  const guard = new UnsavedChanges(() => { prompts++; return new Promise(resolve => { answer = resolve; }); });
  const unregister = guard.register(() => true);
  const first = guard.confirm(), second = guard.confirm();
  await Promise.resolve();
  assert.equal(first, second); assert.equal(prompts, 1);
  unregister(); answer(true);
  assert.equal(await first, false);
});

test("cancel prevents side effects; accepted logout bypasses a second router prompt", async () => {
  let accepted = false, actions = 0, prompts = 0;
  const guard = new UnsavedChanges(async () => { prompts++; return accepted; });
  guard.register(() => true);
  assert.equal(await guard.run(() => { actions++; }), false);
  accepted = true;
  assert.equal(await guard.run(async () => { actions++; assert.equal(guard.blocked(), false); assert.equal(await guard.confirm(), true); }), true);
  assert.equal(actions, 1); assert.equal(prompts, 2);
  assert.equal(guard.blocked(), true);
});

test("failed actions and failed confirmations retain dirty protection", async () => {
  const guard = new UnsavedChanges(async () => true);
  guard.register(() => true);
  await assert.rejects(guard.run(async () => { throw new Error("Save failed"); }));
  assert.equal(guard.blocked(), true);
  const broken = new UnsavedChanges(async () => { throw new Error("Dialog failed"); });
  broken.register(() => true);
  assert.equal(await broken.confirm(), false);
});

test("discard resets the cached draft only after approval; cancelling retains it", async () => {
  let draft = "changed", accepted = false;
  const guard = new UnsavedChanges(async () => accepted);
  guard.register(() => draft !== "saved", () => { draft = "saved"; });
  assert.equal(await guard.leave(), false); assert.equal(draft, "changed");
  accepted = true;
  assert.equal(await guard.leave(), true); assert.equal(draft, "saved");
  assert.equal(guard.blocked(), false);
});

test("concurrent side effects are blocked and failed effects do not discard the draft", async () => {
  let dirty = true, actions = 0, finish!: () => void;
  let start!: () => void;
  const started = new Promise<void>(resolve => { start = resolve; });
  const guard = new UnsavedChanges(async () => true);
  guard.register(() => dirty, () => { dirty = false; });
  await assert.rejects(guard.run(async () => { throw new Error("Logout failed"); }));
  assert.equal(dirty, true);
  const first = guard.run(() => { actions++; start(); return new Promise<void>(resolve => { finish = resolve; }); });
  await started;
  assert.equal(await guard.run(() => { actions++; }), false);
  finish(); await first;
  assert.equal(actions, 1); assert.equal(dirty, false);
});
