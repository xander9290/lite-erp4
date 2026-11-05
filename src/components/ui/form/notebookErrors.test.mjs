import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
const { formErrorPaths, fieldHasError, invalidFieldNames } = createRequire(import.meta.url)("./notebookErrors.ts");

test("nested Zod/RHF paths include arrays and date ranges without traversing cyclic refs", () => {
  const ref = {}; ref.current = ref;
  const errors = {
    delivery: { email: { type: "invalid_format", message: "Correo inválido", ref } },
    lines: [{ price: { type: "min", message: "Requerido" } }],
    period: { start: { type: "required", message: "Inicio requerido" } },
  };
  assert.deepEqual(formErrorPaths(errors), ["delivery.email", "lines.0.price", "period.start"]);
  assert.equal(fieldHasError("delivery.email", formErrorPaths(errors)), true);
  assert.equal(fieldHasError("period", formErrorPaths(errors)), true);
  assert.equal(fieldHasError("lines.0.price", formErrorPaths(errors)), true);
});

test("one2many row errors select the leaf Field and aggregate errors select its group", () => {
  const names = ["lines", "lines.0.quantity", "lines.0.description", "lines.1.quantity"];
  assert.deepEqual([...invalidFieldNames(names, ["lines.1.quantity"])], ["lines.1.quantity"]);
  assert.deepEqual([...invalidFieldNames(names, ["lines"])], ["lines"]);
  assert.deepEqual([...invalidFieldNames(names, ["lines.root"])], ["lines"]);
  assert.deepEqual([...invalidFieldNames(["delivery.email", "delivery.instructions"], ["delivery"])], ["delivery.email", "delivery.instructions"]);
  assert.equal(invalidFieldNames(names, ["linesTotal"]).size, 0);
});

test("field names that resemble RHF metadata are still supported", () => {
  assert.deepEqual(formErrorPaths({ type: { type: "required" }, message: { message: "Requerido" }, ref: { type: "required" } }), ["type", "message", "ref"]);
});

test("parent errors match descendants but unrelated prefixes do not", () => {
  assert.equal(fieldHasError("delivery.email", ["delivery"]), true);
  assert.equal(fieldHasError("price", ["priceTotal"]), false);
  assert.equal(fieldHasError("line", ["lines.0.price"]), false);
  assert.equal(fieldHasError("delivery.instructions", ["delivery.email"]), false);
  assert.deepEqual(formErrorPaths(null), []);
  assert.deepEqual(formErrorPaths({}), []);
  assert.equal(fieldHasError("notes", ["root.server"]), false);
});
