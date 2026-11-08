import assert from "node:assert/strict";
import test from "node:test";
import { patientHistorySchema } from "./history.schema";

test("patient history requires an explicit patient and bounded numeric pagination", () => {
  assert.deepEqual(patientHistorySchema.parse({ patientId: " patient-id " }), { patientId: "patient-id", page: 1, pageSize: 10 });
  assert.equal(patientHistorySchema.safeParse({ patientId: "patient-id", pageSize: 50 }).success, true);
  for (const patch of [
    { patientId: null }, { patientId: " " }, { patientId: "x".repeat(101) },
    { page: 0 }, { page: 100001 }, { page: 1.5 }, { page: "1" },
    { pageSize: 0 }, { pageSize: 51 }, { pageSize: Infinity }, { where: {} }, { isAdmin: true },
  ]) assert.equal(patientHistorySchema.safeParse({ patientId: "patient-id", ...patch }).success, false);
});
