import assert from "node:assert/strict";
import test from "node:test";
import { z } from "zod";
import { recordIdentityShape, validateRecordIdentity } from "./record";

test("record identity refinement accepts form fields and requires paired id/revision", () => {
  const schema = z.strictObject({ name: z.string().min(1), active: z.boolean(), ...recordIdentityShape }).superRefine(validateRecordIdentity);
  assert.equal(schema.safeParse({ name: "Registro", active: true }).success, true);
  assert.equal(schema.safeParse({ name: "Registro", active: true, id: "id", revision: "2026-11-07T00:00:00.000Z" }).success, true);
  for (const extra of [{ id: "id" }, { revision: "2026-11-07T00:00:00.000Z" }, { isAdmin: true }]) assert.equal(schema.safeParse({ name: "Registro", active: true, ...extra }).success, false);
});
