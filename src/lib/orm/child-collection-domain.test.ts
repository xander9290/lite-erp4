import assert from "node:assert/strict";
import test from "node:test";
import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { AccessError } from "../auth/policy";
import type { ListState } from "../list/types";
import { Fields } from "./fields";
import { Model, defineModel } from "./model";
import { unboundRepository } from "./repository";
import { createModelService } from "./service";

const model = defineModel(class Contact extends Model {
  name = Fields.Text({ required: true });
  type = Fields.Selection([
    { value: "contact", label: "Contacto" },
    { value: "delivery", label: "Entrega" },
    { value: "invoice", label: "Facturación" },
  ], { required: true });
  parentId = Fields.Many2one("DomainContact");
  secretParentId = Fields.Many2one("DomainContact", { sensitive: true });
}, { name: "DomainContact", table: "domain_contacts" });

const actor = { id: "owner", sessionVersion: 1 };
const state: ListState = { query: "", sort: "name", direction: "asc", page: 1, pageSize: 10, filters: [] };
const rows = [
  { id: "root", name: "Principal", type: "contact", parentId: null, createBy: "owner" },
  { id: "contact", name: "Contacto adicional", type: "contact", parentId: "root", createBy: "owner" },
  { id: "delivery", name: "Entrega", type: "delivery", parentId: "root", createBy: "owner" },
  { id: "invoice", name: "Factura", type: "invoice", parentId: "root", createBy: "owner" },
  { id: "other-parent", name: "Otra dirección", type: "delivery", parentId: "other", createBy: "owner" },
  { id: "hidden", name: "No autorizado", type: "invoice", parentId: "root", createBy: "another" },
];

function matches(row: Record<string, unknown>, where: Record<string, unknown>): boolean {
  return Object.entries(where).every(([field, value]) => {
    if (field === "AND") return (value as Record<string, unknown>[]).every(node => matches(row, node));
    if (value && typeof value === "object" && "equals" in value) return row[field] === value.equals;
    return row[field] === value;
  });
}

function fixture() {
  const calls: { where: Record<string, unknown>; kind: string }[] = [];
  let domains = 0;
  let denied = false;
  const tx = {} as Prisma.TransactionClient;
  const prisma = { $transaction: async (run: (tx: Prisma.TransactionClient) => unknown) => run(tx) } as unknown as PrismaClient;
  const service = createModelService(model, {
    ...unboundRepository<ReturnType<typeof model.parse>>(),
    count: async (_tx, where) => {
      assert.equal(_tx, tx);
      calls.push({ kind: "count", where });
      return rows.filter(row => matches(row, where)).length;
    },
    list: async (_tx, query) => {
      assert.equal(_tx, tx);
      calls.push({ kind: "list", where: query.where });
      return rows.filter(row => matches(row, query.where)).slice(query.skip, query.skip + query.take);
    },
  }, {
    list: { fields: ["name", "type"], searchFields: ["name"], sortable: ["name"], filterable: ["type"], groupable: [] },
    kanban: { field: "type" },
    domain: d => { domains++; return d.eq("type", "contact"); },
    authorize: async (_tx, received, operation) => {
      assert.equal(_tx, tx);
      assert.equal(received, actor);
      assert.equal(operation, "read");
      if (denied) throw new AccessError("DENIED");
      return { createBy: { equals: actor.id } };
    },
  });
  return { service, prisma, calls, domains: () => domains, deny: () => { denied = true; } };
}

test("main lists, custom main actions and Kanban retain the manifest domain", async () => {
  const f = fixture();
  const main = await f.service.list(f.prisma, actor, state);
  assert.ok(main.ok);
  assert.deepEqual(main.data.rows.map(row => row.id), ["root", "contact"]);
  const custom = await f.service.defineListAction({ domain: [{ field: "parentId", operator: "eq", value: "root" }] })(f.prisma, actor, state);
  assert.ok(custom.ok);
  assert.deepEqual(custom.data.rows.map(row => row.id), ["contact"]);
  const board = await f.service.kanban(f.prisma, actor, { group: "delivery", state });
  assert.ok(board.ok);
  assert.equal(board.data.total, 0);
  assert.equal(f.domains(), 3);
});

test("child collections use inverse, record rules and visible filters without the main domain", async () => {
  const f = fixture();
  const load = f.service.defineChildListAction("parentId", "root");
  const result = await load(f.prisma, actor, state);
  assert.ok(result.ok);
  assert.equal(result.data.total, 3);
  assert.deepEqual(result.data.rows.map(row => row.id), ["contact", "delivery", "invoice"]);
  assert.equal(f.calls[0].where, f.calls[1].where, "count and rows share the same source");
  assert.equal(f.domains(), 0, "the root domain callback is not part of the relation source");
  assert.equal(result.data.rows[0].parentId, undefined, "inverse need not be published as a column");
  const filtered = await load(f.prisma, actor, { ...state, filters: [{ field: "type", operator: "eq", value: "invoice" }] });
  assert.ok(filtered.ok);
  assert.equal(filtered.data.total, 1);
  assert.deepEqual(filtered.data.rows.map(row => row.id), ["invoice"]);
  const paged = await load(f.prisma, actor, { ...state, page: 2, pageSize: 1 });
  assert.ok(paged.ok);
  assert.equal(paged.data.total, 3);
  assert.deepEqual(paged.data.rows.map(row => row.id), ["delivery"]);
});

test("child sources keep authorization and reject client attempts to change their binding", async () => {
  const f = fixture();
  const load = f.service.defineChildListAction("parentId", "root");
  for (const extra of [{ domain: [] }, { parentId: "other" }, { collection: "main" }]) {
    assert.equal((await load(f.prisma, actor, { ...state, ...extra })).ok, false);
  }
  assert.equal(f.calls.length, 0);
  f.deny();
  assert.equal((await load(f.prisma, actor, state)).ok, false);
  assert.equal(f.calls.length, 0);
});

test("a child source requires a public Many2one inverse and a valid bound parent ID", () => {
  const f = fixture();
  for (const inverse of ["name", "secretParentId", "unknown"]) {
    assert.throws(() => f.service.defineChildListAction(inverse, "root"), /inversa Many2one pública/);
  }
  for (const id of ["", " ", "x".repeat(101)]) {
    assert.throws(() => f.service.defineChildListAction("parentId", id), /Dominio de lista inválido/);
  }
});
