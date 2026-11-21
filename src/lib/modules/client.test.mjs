import assert from "node:assert/strict";
import test from "node:test";
import { Fields } from "../orm/fields.ts";
import { createRequire, registerHooks } from "node:module";

test("no-read fields stay outside client defaults and required validation, including child rows", () => {
  // Next transforms this import boundary in the browser. Schema checks never call actions.
  const hooks = registerHooks({
    resolve(specifier, context, next) { return specifier === "./actions" && context.parentURL?.endsWith("/modules/client.ts") ? { url: "policy-test:actions", shortCircuit: true } : next(specifier, context); },
    load(url, context, next) { return url === "policy-test:actions" ? { format: "commonjs", source: "module.exports = {}", shortCircuit: true } : next(url, context); },
  });
  let buildModelUI;
  try { ({ buildModelUI } = createRequire(import.meta.url)("./client")); } finally { hooks.deregister(); }
  const policy = { noRead: true, noWrite: true, invisible: false, readOnly: false };
  const fields = { name: Fields.Text({ required: true }).metadata, code: Fields.Text().metadata };
  const config = {
    id: "demo.item", module: "demo", moduleName: "Demo", key: "item", name: "DemoItem", label: "Item", route: "/erp/demo/item",
    fields, fieldAccess: { name: policy }, preview: {}, related: [], reactionRules: [], lookups: {}, actions: [], view: "list",
    list: { fields: ["name"], searchFields: ["name"], sortable: ["name"], groupable: [], filterable: [] },
    lines: { rows: { model: "demo.line", metadata: { target: "DemoLine", inverse: "itemId", minRows: 0, maxRows: 3 }, fields, fieldAccess: { name: policy }, lookups: {}, capabilities: { read: true, create: true, write: true, unlink: true } } },
  };
  const ui = buildModelUI(config);
  assert.equal(Object.hasOwn(ui.createDefaults(), "name"), false);
  assert.equal(Object.hasOwn(ui.recordUI.lines.rows.createRow(), "name"), false);
  assert.ok(ui.schema.safeParse({ ...ui.createDefaults(), rows: [ui.recordUI.lines.rows.createRow()] }).success);
  assert.equal(ui.schema.safeParse({ ...ui.createDefaults(), name: "forged" }).success, false);
});
