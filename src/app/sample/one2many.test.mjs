import assert from "node:assert/strict";
import { createRequire, registerHooks } from "node:module";
import test from "node:test";

const hooks = registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier === "@/lib/one2many/changes") return nextResolve(new URL("../../lib/one2many/changes.ts", import.meta.url).href, context);
  try { return nextResolve(specifier, context); }
  catch (error) { if (specifier.startsWith(".") && ["ERR_MODULE_NOT_FOUND", "MODULE_NOT_FOUND"].includes(error.code)) return nextResolve(`${specifier}.ts`, context); throw error; }
} });
const require = createRequire(import.meta.url);
const { one2manyDefaults, one2manySchema, createOrderLine, lineSubtotal, orderTotal } = require("./one2many.schema.ts");
const { saveOne2manyExample } = require("./one2many.actions.ts");
const { sameRowData, rowLimits } = require("../../components/ui/form/one2manyValues.ts");
hooks.deregister();

test("demo saves full parent and lines, normalizes values, plans changes and recomputes totals", async () => {
  const input = { ...one2manyDefaults, reference: " ped-002 ", lines: [{ ...one2manyDefaults.lines[1], quantity: 3 }, { ...createOrderLine(), productId: "training", description: " Capacitación ", unitPrice: 800 }] };
  const result = await saveOne2manyExample(input);
  assert.equal(result.ok, true);
  assert.equal(result.values.reference, "PED-002");
  assert.equal(result.values.lines[0].id, "demo-line-2");
  assert.equal(result.values.lines[1].id, undefined);
  assert.equal(result.values.lines[1].description, "Capacitación");
  assert.deepEqual(result.summary, { create: 1, update: 1, delete: 1, total: 2150 });
  assert.equal(input.lines[1].description, " Capacitación ");
});

test("server validation identifies the precise line and does not replace the saved baseline", async () => {
  const input = { ...one2manyDefaults, lines: [{ ...one2manyDefaults.lines[0], description: "BLOQUEADO" }] };
  const result = await saveOne2manyExample(input);
  assert.equal(result.ok, false);
  assert.equal(result.kind, "validation");
  assert.ok(result.fieldErrors["lines.0.description"]);
  assert.equal("values" in result, false);
  const invalid = await saveOne2manyExample({ ...one2manyDefaults, lines: [{ ...createOrderLine(), quantity: null }] });
  assert.equal(invalid.ok, false);
  assert.ok(invalid.fieldErrors["lines.0.quantity"]);
  assert.ok(invalid.fieldErrors["lines.0.productId"]);
});

test("server rejects foreign and duplicate lines, forged totals, and foreign key injection", async () => {
  const line = one2manyDefaults.lines[0];
  for (const lines of [[{ ...line, id: "somebody-elses-line" }], [line, line]]) assert.equal((await saveOne2manyExample({ ...one2manyDefaults, lines })).ok, false);
  assert.equal((await saveOne2manyExample({ ...one2manyDefaults, total: 0 })).ok, false);
  assert.equal((await saveOne2manyExample({ ...one2manyDefaults, lines: [{ ...line, parentId: "another-parent" }] })).ok, false);
});

test("schema checks array length, required row data and decimal precision", () => {
  assert.equal(one2manySchema.safeParse({ ...one2manyDefaults, lines: [] }).success, false);
  assert.equal(one2manySchema.safeParse({ ...one2manyDefaults, lines: Array.from({ length: 21 }, () => one2manyDefaults.lines[0]) }).success, false);
  for (const quantity of [0, -1, 0.001, null]) assert.equal(one2manySchema.safeParse({ ...one2manyDefaults, lines: [{ ...one2manyDefaults.lines[0], quantity }] }).success, false);
  for (const unitPrice of [-1, 1.001, null]) assert.equal(one2manySchema.safeParse({ ...one2manyDefaults, lines: [{ ...one2manyDefaults.lines[0], unitPrice }] }).success, false);
});

test("subtotals round each line and totals sum cents", () => {
  assert.equal(lineSubtotal({ quantity: 3, unitPrice: 0.1 }), 0.3);
  assert.equal(orderTotal([{ quantity: 3, unitPrice: 0.1 }, { quantity: 1, unitPrice: 0.2 }]), 0.5);
  assert.equal(lineSubtotal({ quantity: null, unitPrice: 5 }), 0);
});

test("change snapshots preserve business IDs, Dates and meaningful differences", () => {
  const a = [{ id: 0, data: { description: "a", tags: [1, 2] }, date: new Date("2026-11-01") }];
  const b = structuredClone(a);
  assert.equal(sameRowData(a, b), true);
  b[0].data.description = "b";
  assert.equal(sameRowData(a, b), false);
  assert.equal(sameRowData([{ id: 0 }], [{ id: "0" }]), false);
  assert.equal(sameRowData([], Array(1)), false);
  assert.deepEqual(rowLimits(1, 0), { minimum: 1, maximum: 1 });
});
