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
const { listConfigSchema, listStateSchema } = require("./query.ts");
const { normalizeListState, patchListParams, readListState } = require("./state.ts");
const { readListValue, listDisplayColumn } = require("./types.ts");
const { formatListValue, columnAlignment, visibleListPages, listRecordHref } = require("../../components/ui/list/listFormat.ts");
hooks.deregister();
const config = { model: "partner", searchFields: ["name", "user.login"], columns: [{ field: "name", label: "Nombre", sortable: true }, { field: "user.login", label: "Usuario", sortable: true }] };

test("list configuration rejects unknown models, private fields and query injection", () => {
  for (const patch of [{ model: "constructor" }, { model: "secret" }, { searchFields: ["password"] }, { columns: [{ field: "user.password", label: "Secret" }] }, { where: { id: "x" } }, { include: { user: true } }]) {
    assert.equal(listConfigSchema.safeParse({ ...config, ...patch }).success, false);
  }
  assert.equal(listConfigSchema.safeParse(config).success, true);
});

test("duplicate columns and invisible or non-sortable default sorting are rejected", () => {
  assert.equal(listConfigSchema.safeParse({ ...config, columns: [config.columns[0], config.columns[0]] }).success, false);
  assert.equal(listConfigSchema.safeParse({ ...config, defaultSort: { field: "id", direction: "asc" } }).success, false);
  assert.equal(listConfigSchema.safeParse({ ...config, columns: [{ field: "name", label: "Nombre" }], defaultSort: { field: "name", direction: "asc" } }).success, false);
});

test("partner widgets only resolve approved contact/URL pairs, without expanding searchable fields", () => {
  const column = { field: "name", label: "Contacto", widget: "partner", sortable: true };
  assert.equal(listConfigSchema.safeParse({ ...config, columns: [column] }).success, true);
  assert.equal(listDisplayColumn("partner", column).avatarField, "avatarUrl");
  assert.equal(listDisplayColumn("user", { ...column, field: "partner.name" }).avatarField, "partner.avatarUrl");
  assert.equal(listConfigSchema.safeParse({ model: "user", searchFields: ["login"], columns: [{ ...column, field: "partner.name", avatarField: "partner.avatarUrl" }] }).success, true);
  for (const patch of [{ avatarField: "user.password" }, { avatarField: "__proto__.name" }, { avatarField: "partner.avatarUrl" }, { field: "user.login" }, { widget: "image" }, { widget: undefined, avatarField: "avatarUrl" }, { format: "number" }]) {
    assert.equal(listConfigSchema.safeParse({ ...config, columns: [{ ...column, ...patch }] }).success, false);
  }
  assert.equal(listConfigSchema.safeParse({ ...config, searchFields: ["avatarUrl"] }).success, false);
  assert.equal(listConfigSchema.safeParse({ ...config, columns: [{ field: "avatarUrl", label: "Imagen" }] }).success, false);
});

test("untrusted URL values normalize to permitted search, order and bounded page sizes", () => {
  const state = normalizeListState(config, { query: "  hello  ", page: "-1", pageSize: "99999", sort: "password", direction: "DROP TABLE" });
  assert.deepEqual(state, { query: "hello", page: 1, pageSize: 50, sort: "name", direction: "asc", filters: [] });
  assert.equal(normalizeListState(config, { query: "x".repeat(1000), page: "2.5" }).query.length, 120);
  assert.equal(normalizeListState(config, { page: "2.5" }).page, 1);
  assert.equal(listStateSchema.safeParse({ ...state, pageSize: 51 }).success, false);
  assert.equal(listStateSchema.safeParse({ ...state, page: Number.MAX_SAFE_INTEGER + 1 }).success, false);
});

test("sorting is limited to visible sortable columns, with deterministic defaults", () => {
  assert.equal(normalizeListState(config, { sort: "user.login", direction: "desc" }).sort, "user.login");
  const noSort = { ...config, columns: [{ field: "name", label: "Nombre" }] };
  assert.equal(normalizeListState(noSort, { sort: "name" }).sort, "id");
  assert.equal(normalizeListState({ ...config, defaultSort: { field: "user.login", direction: "desc" } }, {}).direction, "desc");
});

test("query, sort and page-size changes reset pagination while preserving other URL state", () => {
  for (const patch of [{ query: "alex" }, { sort: "user.login", direction: "desc" }, { pageSize: 10 }]) {
    const params = new URLSearchParams(patchListParams("page=4&other=keep&q=old", patch));
    assert.equal(params.has("page"), false);
    assert.equal(params.get("other"), "keep");
  }
  const params = new URLSearchParams(patchListParams("page=4&q=old", { query: "" }));
  assert.equal(params.has("q"), false);
});

test("namespaced lists do not overwrite each other's parameters", () => {
  const next = patchListParams("q=global&contacts_page=2&users_page=4", { query: "alex", pageSize: 1 }, "contacts");
  const params = new URLSearchParams(next);
  assert.equal(params.get("q"), "global");
  assert.equal(params.get("users_page"), "4");
  assert.equal(params.has("contacts_page"), false);
  assert.deepEqual(readListState(config, params, 25, "contacts"), { query: "alex", page: 1, pageSize: 1, sort: "name", direction: "asc", filters: [] });
});

test("public related values handle absent relations and inherited properties safely", () => {
  assert.equal(readListValue({ id: "1", user: null }, "user.login"), null);
  assert.equal(readListValue({ id: "1", user: { login: "alex" } }, "user.login"), "alex");
  assert.equal(readListValue({ id: "1" }, "constructor.name"), null);
});

test("cell formats preserve zero and false, avoid raw objects and default numeric alignment", () => {
  assert.equal(formatListValue(0, { format: "number", decimals: 2 }), "0.00");
  assert.equal(formatListValue(false, { format: "boolean" }), "No");
  assert.equal(formatListValue({ name: "object" }, {}), "—");
  assert.equal(formatListValue(null, {}), "—");
  assert.equal(formatListValue("invalid", { format: "datetime" }), "—");
  assert.equal(columnAlignment({ format: "currency" }), "right");
  assert.equal(columnAlignment({ format: "number", align: "left" }), "left");
});

test("numbered pagination stays bounded at both ends", () => {
  assert.deepEqual(visibleListPages(1, 2), [1, 2]);
  assert.deepEqual(visibleListPages(10, 10), [6, 7, 8, 9, 10]);
  assert.deepEqual(visibleListPages(5, 20), [3, 4, 5, 6, 7]);
});

test("record links encode IDs and preserve the list context for returning", () => {
  const url = listRecordHref("/erp/contactos/{id}", "a/b", "/erp/contactos?q=alex&page=2");
  assert.ok(url.startsWith("/erp/contactos/a%2Fb?"));
  assert.equal(new URL(url, "http://localhost").searchParams.get("returnTo"), "/erp/contactos?q=alex&page=2");
});
