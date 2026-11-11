import assert from "node:assert/strict";
import test from "node:test";
import { createQueryActions } from "./query-actions";
import { AccessError } from "../auth/policy";
import type { PrismaClient } from "@/generated/prisma/client";

test("query actions authorize each invocation, retain failures and never leak exceptions", async () => {
  const prisma = {} as PrismaClient;
  let authorized = 0, queries = 0;
  let denied = false;
  const failure = { ok: false as const, error: "Error de consulta" };
  const actions = createQueryActions({ prisma, authorize: async () => {
    authorized++; if (denied) throw new AccessError("FORBIDDEN");
    return { id: "server-user", sessionVersion: 1 };
  } }, {
    search: async (db, actor, input: { query: string }) => { queries++; assert.equal(db, prisma); assert.equal(actor.id, "server-user"); return { ok: true as const, query: input.query }; },
    rejected: async () => failure,
    broken: async () => { throw new Error("private SQL detail"); },
  });
  assert.deepEqual(await actions.search({ query: "test" }), { ok: true, query: "test" });
  assert.equal(await actions.rejected(undefined), failure);
  assert.deepEqual(await actions.broken(undefined), { ok: false, error: "No se pudo completar la consulta." });
  denied = true;
  const deniedResult = await actions.search({ query: "test" });
  assert.equal(deniedResult.ok, false); assert.equal(queries, 1); assert.equal(authorized, 4);
});
