import assert from "node:assert/strict";
import { createRequire, registerHooks } from "node:module";
import test from "node:test";

const hooks = registerHooks({ resolve(specifier, context, nextResolve) {
  try { return nextResolve(specifier, context); }
  catch (error) {
    if (specifier.startsWith(".") && ["ERR_MODULE_NOT_FOUND", "MODULE_NOT_FOUND"].includes(error.code)) return nextResolve(`${specifier}.ts`, context);
    throw error;
  }
} });
const require = createRequire(import.meta.url);
const { formViewDefaults, formViewSchema, selectableStateSchema } = require("./formView.schema.ts");
const { loadFormViewExample, saveFormViewExample, transitionFormViewExample, prepareFormViewReport } = require("./formView.actions.ts");
hooks.deregister();

test("save validates on the server and returns canonical values for RHF reset", async () => {
  const input = { ...formViewDefaults, reference: "  doc-002 ", customer: " Cliente " };
  const result = await saveFormViewExample(input);
  assert.equal(result.ok, true);
  assert.equal(result.values.reference, "DOC-002");
  assert.equal(result.values.customer, "Cliente");
  assert.equal(input.reference, "  doc-002 ");
});

test("rejected saves have field errors and never provide a replacement baseline", async () => {
  const invalid = await saveFormViewExample({ ...formViewDefaults, customer: "", amount: 0 });
  assert.equal(invalid.ok, false);
  assert.ok(invalid.fieldErrors.customer);
  assert.ok(invalid.fieldErrors.amount);
  assert.equal("values" in invalid, false);
  const conflict = await saveFormViewExample({ ...formViewDefaults, reference: "duplicado" });
  assert.equal(conflict.ok, false);
  assert.ok(conflict.fieldErrors.reference);
  assert.equal(conflict.kind, "validation");
  assert.equal("values" in conflict, false);
  const nested = await saveFormViewExample({ ...formViewDefaults, delivery: { ...formViewDefaults.delivery, email: "invalid" } });
  assert.equal(nested.ok, false);
  assert.ok(nested.fieldErrors["delivery.email"]);
});

test("loading provides a complete record or an explicit safe error", async () => {
  const [record, missing] = await Promise.all([loadFormViewExample(), loadFormViewExample("missing")]);
  assert.equal(record.ok, true);
  assert.deepEqual(record.values, formViewDefaults);
  assert.equal(missing.ok, false);
  assert.equal(missing.kind, "server");
  assert.equal("values" in missing, false);
});

test("demo workflow validates both data and allowed transitions", async () => {
  const confirmed = await transitionFormViewExample(formViewDefaults, "confirmed");
  assert.equal(confirmed.ok, true);
  assert.equal(confirmed.values.state, "confirmed");
  assert.equal((await transitionFormViewExample(confirmed.values, "draft")).ok, false);
  assert.equal((await transitionFormViewExample(formViewDefaults, "draft")).ok, false);
  assert.equal((await transitionFormViewExample(formViewDefaults, "arbitrary")).ok, false);
  assert.equal((await transitionFormViewExample({}, "confirmed")).ok, false);
  const cancelled = await transitionFormViewExample(confirmed.values, "cancelled");
  assert.equal(cancelled.ok, true);
  assert.equal((await transitionFormViewExample(cancelled.values, "draft")).ok, true);
});

test("report escapes user content and rejects invalid data", async () => {
  const response = await prepareFormViewReport({ ...formViewDefaults, customer: '<img src=x onerror="alert(1)">', notes: "<script>alert('x')</script>&" });
  assert.equal(response.ok, true);
  assert.ok(response.html.includes("&lt;img"));
  assert.ok(response.html.includes("&lt;script&gt;"));
  assert.equal(response.html.includes("<script>"), false);
  assert.equal(response.html.includes("<img"), false);
  assert.equal((await prepareFormViewReport({})).ok, false);
});

test("statebar examples keep numeric zero and reject unknown or coerced states", () => {
  assert.deepEqual(selectableStateSchema.parse({ stage: 0 }), { stage: 0 });
  for (const stage of [null, "0", 3, undefined]) assert.equal(selectableStateSchema.safeParse({ stage }).success, false);
  assert.equal(formViewSchema.safeParse({ ...formViewDefaults, state: "unexpected" }).success, false);
});
