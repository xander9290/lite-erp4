import assert from "node:assert/strict";
import { test } from "node:test";
import { formatPhone } from "./phone";
import { phoneSampleSchema } from "../../../app/sample/sample.schema";

test("phone formats Mexican numbers and is idempotent", () => {
  for (const value of ["3321659874", "523321659874", "+523321659874", " (33) 2165-9874 ", "+52 33 2165 9874"]) {
    assert.equal(formatPhone(value), "+52 33 2165 9874");
    assert.equal(formatPhone(formatPhone(value)), "+52 33 2165 9874");
    assert.equal(phoneSampleSchema.parse({ phone: value }).phone, "+52 33 2165 9874");
  }
});

test("phone preserves incomplete, foreign, extra digits and extensions for validation", () => {
  for (const value of ["33", "+1 212 555 1234", "33216598740", "3321659874 ext 12", "abc3321659874", "++523321659874"]) {
    assert.equal(formatPhone(value), value);
    assert.equal(phoneSampleSchema.safeParse({ phone: value }).success, false);
  }
  assert.equal(formatPhone("   "), "");
  assert.equal(phoneSampleSchema.safeParse({ phone: "" }).success, false);
});
