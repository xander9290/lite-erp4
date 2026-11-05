import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
const { AlertQueue } = createRequire(import.meta.url)("./alertQueue.ts");

test("dialogs stay in FIFO order and resolve their own confirmation", async () => {
  const queue = new AlertQueue();
  const first = queue.confirm({ message: "Continuar" });
  const second = queue.confirm({ message: "Otro" });
  const [one, two] = queue.getSnapshot();
  queue.settle(one.id, false);
  assert.equal(await first, false);
  assert.equal(queue.getSnapshot()[0].id, two.id);
  queue.settle(two.id, true);
  assert.equal(await second, true);
  assert.deepEqual(queue.getSnapshot(), []);
});

test("overlapping loaders close only their own entry and are idempotent", () => {
  const queue = new AlertQueue();
  const first = queue.loading({ message: "Uno" });
  const second = queue.loading({ message: "Dos" });
  const secondId = queue.getSnapshot()[1].id;
  first(); first();
  assert.equal(queue.getSnapshot()[0].id, secondId);
  second();
  assert.equal(queue.getSnapshot().length, 0);
});

test("a queued loading completion does not dismiss the active alert", async () => {
  const queue = new AlertQueue();
  const info = queue.info({ title: "Aviso" });
  const active = queue.getSnapshot()[0];
  const close = queue.loading(); close();
  assert.deepEqual(queue.getSnapshot(), [active]);
  queue.settle(active.id, true); await info;
});

test("withLoading returns results and removes the loader even if the task throws", async () => {
  const queue = new AlertQueue();
  assert.equal(await queue.withLoading(async () => 42), 42);
  const failure = new Error("private technical detail");
  await assert.rejects(queue.withLoading(async () => { throw failure; }), error => error === failure);
  assert.equal(queue.getSnapshot().length, 0);
});

test("disposing resolves pending requests as cancellation and supports strict-mode reactivation", async () => {
  const queue = new AlertQueue();
  const pending = queue.confirm({});
  const info = queue.info({});
  const close = queue.loading();
  queue.dispose();
  assert.equal(await pending, false); await info; close();
  assert.equal(await queue.confirm({}), false);
  assert.equal(queue.getSnapshot().length, 0);
  queue.activate();
  const closeNew = queue.loading(); close();
  assert.equal(queue.getSnapshot().length, 1);
  closeNew();
  const next = queue.confirm({});
  queue.settle(queue.getSnapshot()[0].id, true);
  assert.equal(await next, true);
});

test("snapshots are stable between changes and observers can unsubscribe", () => {
  const queue = new AlertQueue();
  const before = queue.getSnapshot(); let count = 0;
  const unsubscribe = queue.subscribe(() => { count++; });
  assert.equal(queue.getSnapshot(), before);
  const close = queue.loading();
  assert.notEqual(queue.getSnapshot(), before);
  assert.equal(count, 1); unsubscribe(); close();
  assert.equal(count, 1);
});
