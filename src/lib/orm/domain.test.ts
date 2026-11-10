import assert from "node:assert/strict";
import test from "node:test";
import { compileListDomain } from "./domain";
import { Fields } from "./fields";
import { defineModel, Model } from "./model";

const model = defineModel(class Example extends Model {
  name = Fields.Text({ required: true });
  active = Fields.Boolean();
  quantity = Fields.Integer();
  status = Fields.Selection([{ value: "draft", label: "Borrador" }, { value: "done", label: "Hecho" }], { required: true });
  partnerId = Fields.Many2one("Partner");
  startsAt = Fields.DateTime();
}, { name: "DomainExample", table: "domain_examples" });
const compile = (value: unknown) => compileListDomain(model.metadata, value);

test("domains preserve exact IDs and native scalar types, independently of displayed columns or audit opt-in", () => {
  assert.deepEqual(compile([
    { field: "createBy", operator: "eq", value: "User-A" },
    { field: "active", operator: "eq", value: true },
    { field: "quantity", operator: "gte", value: 0 },
    { field: "partnerId", operator: "in", value: ["Partner-A", "Partner-B"] },
    { field: "status", operator: "notIn", value: ["done"] },
    { field: "startsAt", operator: "eq", value: null },
  ]), { AND: [
    { createBy: { equals: "User-A" } }, { active: { equals: true } }, { quantity: { gte: 0 } },
    { partnerId: { in: ["Partner-A", "Partner-B"] } }, { status: { notIn: ["done"] } }, { startsAt: { equals: null } },
  ] });
  assert.deepEqual(compile([{ field: "createdAt", operator: "gte", value: "2026-11-08T00:00:00.000Z" }]), { AND: [{ createdAt: { gte: new Date("2026-11-08T00:00:00.000Z") } }] });
  assert.deepEqual(compile([{ field: "name", operator: "contains", value: "100%_literal" }]), { AND: [{ name: { contains: "100\\%\\_literal" } }] });
});

test("logical groups and empty memberships have explicit AND/OR/NOT semantics", () => {
  assert.deepEqual(compile([]), {});
  assert.deepEqual(compile([{ any: [] }]), { id: { in: [] } });
  assert.deepEqual(compile([{ not: { all: [] } }]), { id: { in: [] } });
  assert.deepEqual(compile([{ not: { any: [] } }]), {});
  assert.deepEqual(compile([{ field: "id", operator: "in", value: [] }]), { id: { in: [] } });
  assert.deepEqual(compile([{ not: { field: "id", operator: "in", value: [] } }]), {});
  assert.deepEqual(compile([{ field: "id", operator: "notIn", value: [] }]), {});
  assert.deepEqual(compile([{ any: [{ field: "active", operator: "eq", value: true }, { not: { field: "status", operator: "eq", value: "done" } }] }]), {
    AND: [{ OR: [{ active: { equals: true } }, { NOT: { status: { equals: "done" } } }] }],
  });
});

test("domains reject undefined, raw where, relations, unknown fields, wrong operators and invalid values", () => {
  const invalid: unknown[] = [undefined, null, {}, { AND: [] }, [null],
    [{ createBy: "user" }], [{ field: "missing", operator: "eq", value: true }],
    [{ field: "createByUser.password", operator: "eq", value: "secret" }],
    [{ field: "__proto__", operator: "eq", value: "x" }],
    [{ field: "active", operator: "eq", value: "true" }], [{ field: "active", operator: "in", value: [true] }],
    [{ field: "quantity", operator: "eq", value: 1.5 }], [{ field: "quantity", operator: "gt", value: 2147483648 }],
    [{ field: "quantity", operator: "eq", value: NaN }], [{ field: "quantity", operator: "contains", value: "1" }],
    [{ field: "status", operator: "eq", value: "missing" }], [{ field: "status", operator: "contains", value: "dr" }],
    [{ field: "createdAt", operator: "eq", value: "2026-02-31T00:00:00.000Z" }],
    [{ field: "startsAt", operator: "lt", value: "2026-11-08" }],
    [{ field: "name", operator: "eq", value: null }], [{ field: "createBy", operator: "eq", value: "" }],
    [{ field: "createBy", operator: "in", value: [null] }],
    [{ field: "name", operator: "eq", value: "x", mode: "insensitive" }],
    [{ any: [], field: "active", operator: "eq", value: true }],
    [{ any: [{ all: [] }, { field: "missing", operator: "eq", value: "x" }] }],
  ];
  for (const value of invalid) assert.throws(() => compile(value), /Dominio de lista inválido/);
});

test("domains bound nesting and node counts and reject cyclic definitions", () => {
  const cycle: { not?: unknown } = {}; cycle.not = cycle;
  assert.throws(() => compile([cycle]), /Dominio/);
  assert.throws(() => compile(Array.from({ length: 101 }, () => ({ all: [] }))), /Dominio/);
});
