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
const { compileColumnFilter, compileListFilters, filterValueError, validateListFilters } = require("./filters.ts");
const { listConfigSchema, listStateSchema } = require("./query.ts");
const { readListState, patchListParams } = require("./state.ts");
const { temporalFilter, filterInputValue } = require("../../components/ui/list/filterInputs.ts");
hooks.deregister();
const config = { model: "partner", columns: [{ field: "name", label: "Nombre", sortable: true }, { field: "user.login", label: "Usuario" }], searchFields: ["name"] };
const dates = { model: "user", columns: [{ field: "lastLogin", label: "Último acceso", type: "datetime" }], searchFields: ["login"] };

test("number comparisons preserve zero, negatives, equality and inclusive ranges", () => {
  assert.deepEqual(compileColumnFilter("number", { field: "amount", operator: "gte", value: "0" }), { amount: { gte: 0 } });
  assert.deepEqual(compileColumnFilter("number", { field: "amount", operator: "neq", value: "-2.5" }), { amount: { not: -2.5 } });
  assert.deepEqual(compileColumnFilter("integer", { field: "quantity", operator: "between", value: "2", to: "10" }), { quantity: { gte: 2, lte: 10 } });
  assert.equal(filterValueError("number", { field: "x", operator: "between", value: "10", to: "2" }) !== null, true);
  for (const value of ["Infinity", "NaN", "0x10", "", "1,200"]) assert.notEqual(filterValueError("number", { field: "x", operator: "eq", value }), null);
  assert.notEqual(filterValueError("integer", { field: "x", operator: "eq", value: "1.5" }), null);
  assert.notEqual(filterValueError("integer", { field: "x", operator: "eq", value: "9007199254740993" }), null);
});

test("false is a valid boolean and operators are type constrained", () => {
  assert.deepEqual(compileColumnFilter("boolean", { field: "active", operator: "eq", value: "false" }), { active: false });
  assert.notEqual(filterValueError("boolean", { field: "active", operator: "gt", value: "true" }), null);
  assert.notEqual(filterValueError("date", { field: "day", operator: "contains", value: "hello" }), null);
});

test("text filters escape pattern characters and nest to-one relation paths", () => {
  assert.deepEqual(compileColumnFilter("text", { field: "user.login", operator: "contains", value: "a_b%" }), { user: { is: { login: { contains: "a\\_b\\%", mode: "insensitive" } } } });
  assert.deepEqual(compileColumnFilter("text", { field: "user.login", operator: "neq", value: "alex" }), { user: { is: { login: { not: "alex", mode: "insensitive" } } } });
});

test("empty optional relations and nullable dates use legal Prisma predicates", () => {
  const emptyRelation = compileListFilters(config, [{ field: "user.login", operator: "empty" }])[0];
  assert.deepEqual(emptyRelation, { OR: [{ user: { is: { login: "" } } }, { user: { is: null } }] });
  assert.deepEqual(compileListFilters(config, [{ field: "name", operator: "empty" }])[0], { OR: [{ name: "" }] });
  assert.deepEqual(compileListFilters(dates, [{ field: "lastLogin", operator: "empty" }])[0], { OR: [{ lastLogin: null }] });
  assert.deepEqual(compileListFilters(dates, [{ field: "lastLogin", operator: "notEmpty" }])[0], { AND: [{ lastLogin: { not: null } }] });
});

test("server rejects hidden/private fields, duplicate filters and disabled column filters", () => {
  assert.notEqual(validateListFilters(config, [{ field: "password", operator: "contains", value: "x" }]), null);
  assert.notEqual(validateListFilters(config, [{ field: "user.password", operator: "eq", value: "x" }]), null);
  assert.notEqual(validateListFilters(config, [{ field: "name", operator: "eq", value: "x" }, { field: "name", operator: "eq", value: "y" }]), null);
  assert.notEqual(validateListFilters({ ...config, columns: [{ field: "name", label: "Nombre", filterable: false }] }, [{ field: "name", operator: "eq", value: "x" }]), null);
  assert.equal(listConfigSchema.safeParse({ ...config, columns: [{ field: "name", label: "Nombre", type: "number" }] }).success, false);
  assert.equal(listConfigSchema.safeParse({ ...dates, columns: [{ field: "lastLogin", label: "Día", type: "date" }] }).success, true);
  assert.equal(listStateSchema.safeParse({ query: "", page: 1, pageSize: 25, sort: "name", direction: "asc", filters: [{ field: "name", operator: "eq", value: "x", where: {} }] }).success, false);
});

test("filter URLs round-trip without overwriting another list or retaining a stale page", () => {
  const filters = [{ field: "name", operator: "contains", value: "alex" }];
  const next = patchListParams("contacts_page=5&users_filters=keep&other=ok", { filters }, "contacts");
  const params = new URLSearchParams(next);
  assert.equal(params.has("contacts_page"), false);
  assert.equal(params.get("users_filters"), "keep");
  assert.equal(params.get("other"), "ok");
  assert.deepEqual(readListState(config, params, 25, "contacts").filters, filters);
  assert.equal(new URLSearchParams(patchListParams(next, { filters: [] }, "contacts")).has("contacts_filters"), false);
});

test("malformed filters remain an explicit error instead of turning into an unfiltered read", () => {
  for (const payload of ["{", "null", JSON.stringify([{ field: "name", operator: "constructor" }]), JSON.stringify([{ field: "name", operator: "eq", value: {} }])]) {
    assert.equal(readListState(config, new URLSearchParams({ filters: payload })).invalidFilters, true);
  }
});

test("day filters include all local hours using UTC and an exclusive next-midnight boundary", () => {
  const previous = process.env.TZ;
  process.env.TZ = "America/Mexico_City";
  try {
    const day = temporalFilter("lastLogin", "eq", "2026-11-04", "", "day");
    assert.equal(day.value, "2026-11-04T06:00:00.000Z");
    assert.equal(day.to, "2026-11-05T06:00:00.000Z");
    const compiled = compileColumnFilter("datetime", day).lastLogin;
    assert.equal(compiled.gte.toISOString(), day.value);
    assert.equal(compiled.lt.toISOString(), day.to);
    assert.equal(filterInputValue(day.to, "day", true), "2026-11-04");
    assert.deepEqual(compileColumnFilter("datetime", { ...day, operator: "gt" }), { lastLogin: { gte: new Date(day.to) } });
    assert.deepEqual(compileColumnFilter("datetime", { ...day, operator: "lte" }), { lastLogin: { lt: new Date(day.to) } });
  } finally { if (previous === undefined) delete process.env.TZ; else process.env.TZ = previous; }
});

test("DST days use 23 or 25 hours, and nonexistent local hours are rejected", () => {
  const previous = process.env.TZ;
  process.env.TZ = "America/New_York";
  try {
    const spring = temporalFilter("day", "eq", "2026-03-08", "", "day");
    const fall = temporalFilter("day", "eq", "2026-11-01", "", "day");
    assert.equal((Date.parse(spring.to) - Date.parse(spring.value)) / 3600000, 23);
    assert.equal((Date.parse(fall.to) - Date.parse(fall.value)) / 3600000, 25);
    assert.throws(() => temporalFilter("day", "eq", "2026-03-08T02:30", "", "instant"), /no existe/);
  } finally { if (previous === undefined) delete process.env.TZ; else process.env.TZ = previous; }
});

test("date ranges include the final day, while instant ranges preserve exact milliseconds", () => {
  const day = temporalFilter("date", "between", "2026-11-01", "2026-11-04", "day");
  assert.equal(filterValueError("date", day), null);
  assert.equal(filterInputValue(day.to, "day", true), "2026-11-04");
  const instant = temporalFilter("lastLogin", "between", "2026-11-04T08:46:01.123", "2026-11-04T08:50:00.456", "instant");
  assert.equal(filterValueError("datetime", instant), null);
  assert.equal(compileColumnFilter("datetime", instant).lastLogin.lte.getUTCMilliseconds(), 456);
  assert.throws(() => temporalFilter("date", "between", "2026-11-04", "2026-11-01", "day"), /anterior/);
  assert.throws(() => temporalFilter("date", "eq", "2026-02-30", "", "day"), /no existe/);
  assert.notEqual(filterValueError("datetime", { field: "x", operator: "eq", precision: "instant", value: "2026-02-30T00:00:00Z" }), null);
});

test("calendar boundaries preserve years below 100 instead of interpreting them as 1900-based", () => {
  const day = temporalFilter("date", "eq", "0099-12-31", "", "day");
  assert.equal(filterInputValue(day.value), "0099-12-31");
  assert.equal(filterInputValue(day.to), "0100-01-01");
  assert.equal(filterInputValue(day.to, "day", true), "0099-12-31");
});
