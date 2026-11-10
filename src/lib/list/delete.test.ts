import assert from "node:assert/strict";
import test from "node:test";
import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { deleteListSelection, type ListDeleteRepository } from "./delete";
import { listDeleteSelectionSchema } from "./selection";

const revision = "2026-11-08T00:00:00.000Z";
const actor = { id: "admin", sessionVersion: 2 };
const selection = [{ id: "a", revision }, { id: "b", revision }];
function fixture(account = { active: true, isAdmin: true, sessionVersion: 2 }) {
  const calls: string[] = [];
  const tx = { user: { findUnique: async () => { calls.push("authorize"); return account; } } } as unknown as Prisma.TransactionClient;
  const prisma = { $transaction: async (run: (tx: Prisma.TransactionClient) => unknown, options: unknown) => {
    assert.deepEqual(options, { isolationLevel: "Serializable" }); return run(tx);
  } } as unknown as PrismaClient;
  const repository: ListDeleteRepository = {
    read: async (transaction, id) => { assert.equal(transaction, tx); calls.push(`read:${id}`); return { revision }; },
    remove: async (transaction, id, version) => { assert.equal(transaction, tx); assert.equal(version, revision); calls.push(`remove:${id}`); },
  };
  return { prisma, repository, calls };
}
test("deletion selection validates bounded unique IDs and exact revisions", () => {
  assert.equal(listDeleteSelectionSchema.safeParse(selection).success, true);
  for (const input of [[], [...selection, selection[0]], Array.from({ length: 51 }, (_, index) => ({ id: String(index), revision })),
    [{ id: "a" }], [{ id: "a", revision: "yesterday" }], [{ id: "a", revision, isAdmin: true }]]) assert.equal(listDeleteSelectionSchema.safeParse(input).success, false);
});
test("server revalidates session and all revisions before any removal", async () => {
  const { prisma, repository, calls } = fixture();
  assert.deepEqual(await deleteListSelection(prisma, actor, selection, repository), { ok: true, deleted: 2 });
  assert.deepEqual(calls, ["authorize", "read:a", "read:b", "remove:a", "remove:b"]);
});
test("revoked, inactive and nonadmin sessions cannot reach the repository", async () => {
  for (const account of [{ active: false, isAdmin: true, sessionVersion: 2 }, { active: true, isAdmin: false, sessionVersion: 2 }, { active: true, isAdmin: true, sessionVersion: 3 }]) {
    const { prisma, repository, calls } = fixture(account);
    assert.equal((await deleteListSelection(prisma, actor, selection, repository)).ok, false);
    assert.deepEqual(calls, ["authorize"]);
  }
});
test("missing or stale rows reject the whole batch before removal", async () => {
  for (const stale of [null, { revision: "2026-11-09T00:00:00.000Z" }]) {
    const { prisma, repository, calls } = fixture();
    repository.read = async (_tx, id) => id === "b" ? stale : { revision };
    const result = await deleteListSelection(prisma, actor, selection, repository);
    assert.equal(result.ok, false); if (!result.ok) assert.equal(result.kind, "validation");
    assert.ok(!calls.some(call => call.startsWith("remove:")));
  }
});
test("foreign-key, concurrency and unknown-commit errors are reported without claiming success", async () => {
  for (const code of ["P2003", "P2014", "P2025", "P2034", "NETWORK"]) {
    const { prisma, repository } = fixture();
    repository.remove = async () => { throw Object.assign(new Error("failure"), { code }); };
    const result = await deleteListSelection(prisma, actor, selection, repository);
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.kind, code === "NETWORK" ? "server" : "validation");
  }
});
