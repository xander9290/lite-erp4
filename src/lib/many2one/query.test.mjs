import assert from "node:assert/strict";
import { createRequire, registerHooks } from "node:module";
import test from "node:test";

// Resolve the application's extensionless TS imports with Node's built-in TS support.
const hooks = registerHooks({ resolve(specifier, context, nextResolve) {
  try { return nextResolve(specifier, context); }
  catch (error) {
    if (specifier.startsWith(".") && ["ERR_MODULE_NOT_FOUND", "MODULE_NOT_FOUND"].includes(error.code)) return nextResolve(`${specifier}.ts`, context);
    throw error;
  }
} });
const require = createRequire(import.meta.url);
const { lookupRequestSchema, lookupWords, userLookupWhere, partnerLookupWhere, lookupPage, lookupWindow } = require("./query.ts");
const { formatLookupName } = require("./types.ts");
hooks.deregister();
const input = { model: "user", searchFields: ["login", "partner.name"], displayName: "[{login}] {partner.name}" };

test("lookup boundary rejects private fields, unknown models, relations and injected query options", () => {
  for (const changes of [
    { model: "_prisma_migrations" }, { model: "constructor" },
    { searchFields: ["password"] }, { displayName: "{password}" },
    { searchFields: ["partner.user.password"] }, { displayName: "{__proto__.name}" },
    { where: { password: { contains: "secret" } } }, { include: { partner: true } },
    { displayName: "{login" }, { displayName: "constant only" },
  ]) assert.equal(lookupRequestSchema.safeParse({ ...input, ...changes }).success, false);
  assert.equal(lookupRequestSchema.safeParse(input).success, true);
});

test("lookup boundary bounds page size, input length and ID resolution", () => {
  for (const changes of [{ page: -1 }, { page: 1.5 }, { pageSize: 1000 }, { pageSize: 0 }, { query: "x".repeat(121) }, { id: "" }]) {
    assert.equal(lookupRequestSchema.safeParse({ ...input, ...changes }).success, false);
  }
  assert.equal(lookupRequestSchema.parse({ ...input, id: "user-1" }).pageSize, 10);
});

test("all search words can match different fields, including nullable related records", () => {
  const request = lookupRequestSchema.parse({ ...input, query: "alex aguilar" });
  const where = userLookupWhere(request);
  assert.equal(where.AND.length, 2);
  assert.deepEqual(where.AND[0].OR[0], { login: { contains: "alex", mode: "insensitive" } });
  assert.deepEqual(where.AND[1].OR[1], { partner: { is: { name: { contains: "aguilar", mode: "insensitive" } } } });
  const partner = partnerLookupWhere(lookupRequestSchema.parse({ model: "partner", searchFields: ["user.login"], displayName: "{name}", query: "alex" }));
  assert.deepEqual(partner.AND[0].OR[0], { user: { is: { login: { contains: "alex", mode: "insensitive" } } } });
  assert.deepEqual(userLookupWhere(lookupRequestSchema.parse(input)), { AND: [] });
});

test("search treats SQL pattern wildcards as literal input", () => {
  assert.deepEqual(lookupWords("  50%   user_name a\\b  "), ["50\\%", "user\\_name", "a\\\\b"]);
});

test("display templates handle missing relations and do not render objects or inherited properties", () => {
  assert.equal(formatLookupName({ id: "1", login: "alex", partner: { id: "2", name: "Alex Aguilar" } }, input.displayName), "[alex] Alex Aguilar");
  assert.equal(formatLookupName({ id: "1", login: "alex", partner: null }, input.displayName), "[alex]");
  assert.equal(formatLookupName({ id: "1", partner: null }, "{partner.name}"), "1");
  assert.equal(formatLookupName({ id: "1", partner: { id: "2", name: "Name" } }, "{partner}"), "1");
  assert.equal(formatLookupName({ id: "1" }, "{constructor.name}"), "1");
});

test("pagination clamps out-of-range pages and uses the correct offset and limit", async () => {
  const calls = [];
  const result = await lookupPage({ page: 99, pageSize: 5 }, {
    count: async () => 12,
    read: async (skip, take) => { calls.push([skip, take]); return [{ id: "last" }]; },
  });
  assert.deepEqual(calls, [[10, 5]]);
  assert.equal(result.page, 3);
  assert.equal(result.total, 12);
  assert.deepEqual(result.records, [{ id: "last" }]);
});

test("empty catalogs return page one without reading beyond their bounds", async () => {
  const result = await lookupPage({ page: 9, pageSize: 10 }, { count: async () => 0, read: async () => { throw new Error("unexpected read"); } });
  assert.deepEqual(result, { records: [], total: 0, page: 1, pageSize: 10 });
});

test("batch ID resolution is bounded, unique and mutually exclusive with a single ID", () => {
  for (const changes of [{ ids: [] }, { ids: ["x", "x"] }, { ids: [" "] }, { ids: ["x"], id: "x" }, { ids: Array.from({ length: 101 }, (_, i) => String(i)) }]) {
    assert.equal(lookupRequestSchema.safeParse({ ...input, ...changes }).success, false);
  }
  assert.equal(lookupRequestSchema.safeParse({ ...input, ids: ["a", "b"], searchFields: ["password"] }).success, false);
});

test("batch resolution loads every saved ID, even beyond the dropdown page size", async () => {
  const ids = Array.from({ length: 40 }, (_, index) => `id-${index}`);
  const request = lookupRequestSchema.parse({ ...input, ids, pageSize: 5, page: 4 });
  const result = await lookupPage(lookupWindow(request), {
    count: async () => ids.length,
    read: async (skip, take) => ids.slice(skip, skip + take).map(id => ({ id })),
  });
  assert.equal(result.records.length, 40);
  assert.equal(result.page, 1);
  assert.equal(result.pageSize, 40);
  const single = lookupRequestSchema.parse(input);
  assert.equal(lookupWindow(single), single);
});
