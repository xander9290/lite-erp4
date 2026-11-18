import assert from "node:assert/strict";
import test from "node:test";
import { advanceContactUserRevision } from "./contact-revision";

test("contact edits advance only the linked account revision, monotonically, without revoking its session", async () => {
  const previous = new Date("2099-01-01T00:00:00.000Z");
  let data: Record<string, unknown> | undefined;
  const tx = { user: {
    findUnique: async (query: unknown) => { assert.deepEqual(query, { where: { partnerId: "p1" }, select: { id: true, updatedAt: true } }); return { id: "u1", updatedAt: previous }; },
    update: async (query: { where: unknown; data: Record<string, unknown> }) => { assert.deepEqual(query.where, { id: "u1", updatedAt: previous }); data = query.data; },
  } } as never;
  await advanceContactUserRevision(tx, "p1", previous);
  assert.deepEqual(data, { updatedAt: new Date("2099-01-01T00:00:00.001Z") });
});

test("a contact without an account causes no user write", async () => {
  await advanceContactUserRevision({ user: { findUnique: async () => null, update: async () => assert.fail("unexpected write") } } as never, "p1", new Date());
});
