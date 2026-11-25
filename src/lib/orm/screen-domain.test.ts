import assert from "node:assert/strict";
import test from "node:test";
import type { Prisma, PrismaClient } from "@/generated/prisma/client";
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
  parentId = Fields.Many2one("ScreenContact");
}, { name: "ScreenContact", table: "screen_contacts" });

const actor = { id: "owner", sessionVersion: 1 };
const state: ListState = { query: "", sort: "name", direction: "asc", page: 1, pageSize: 10, filters: [] };
const rows = [
  { id: "root", name: "Principal", type: "contact", parentId: null, createBy: "owner" },
  { id: "delivery", name: "Entrega", type: "delivery", parentId: "root", createBy: "owner" },
  { id: "invoice", name: "Factura", type: "invoice", parentId: "root", createBy: "owner" },
  { id: "hidden", name: "Factura ajena", type: "invoice", parentId: "root", createBy: "another" },
];

/** Minimal Prisma-like matcher: AND, equals/not, in/notIn and plain equality. */
function matches(row: Record<string, unknown>, where: Record<string, unknown>): boolean {
  return Object.entries(where).every(([field, value]) => {
    if (field === "AND") return (value as Record<string, unknown>[]).every(node => matches(row, node));
    if (field === "OR") return (value as Record<string, unknown>[]).some(node => matches(row, node));
    if (value && typeof value === "object") {
      const condition = value as Record<string, unknown>;
      if ("equals" in condition) return row[field] === condition.equals;
      if ("in" in condition) return (condition.in as unknown[]).includes(row[field]);
      if ("notIn" in condition) return !(condition.notIn as unknown[]).includes(row[field]);
      if ("not" in condition) return row[field] !== condition.not;
    }
    return row[field] === value;
  });
}

function fixture() {
  const tx = {} as Prisma.TransactionClient;
  const prisma = { $transaction: async (run: (tx: Prisma.TransactionClient) => unknown) => run(tx) } as unknown as PrismaClient;
  const service = createModelService(model, {
    ...unboundRepository<ReturnType<typeof model.parse>>(),
    count: async (_tx, where) => rows.filter(row => matches(row, where)).length,
    list: async (_tx, query) => rows.filter(row => matches(row, query.where)).slice(query.skip, query.skip + query.take),
  }, {
    list: { fields: ["name", "type"], searchFields: ["name"], sortable: ["name"], filterable: ["type"], groupable: [] },
    kanban: { field: "type" },
    // Default screen domain (what plain links and relations use).
    domain: d => d.eq("type", "contact"),
    // Record rule: only own records.
    authorize: async () => ({ createBy: { equals: actor.id } }),
  });
  return { service, prisma };
}

const ids = (result: Awaited<ReturnType<ReturnType<typeof fixture>["service"]["list"]>>) => {
  assert.ok(result.ok, result.ok ? "" : result.error);
  return result.data.rows.map(row => row.id);
};

test("a screen domain replaces the default collection domain, record rules still apply", async () => {
  const f = fixture();
  assert.deepEqual(ids(await f.service.list(f.prisma, actor, state)), ["root"]);
  const addresses = { domain: (d: import("./domain-builder").DomainBuilder) => d.in("type", ["delivery", "invoice"]) };
  // «Factura ajena» matches the screen domain but the record rule keeps it out.
  assert.deepEqual(ids(await f.service.list(f.prisma, actor, state, addresses)), ["delivery", "invoice"]);
  // A screen without domain shows every readable record (it never widens the record rule).
  assert.deepEqual(ids(await f.service.list(f.prisma, actor, state, {})), ["root", "delivery", "invoice"]);
});

test("Kanban columns use the selected screen domain", async () => {
  const f = fixture();
  const addresses = { domain: (d: import("./domain-builder").DomainBuilder) => d.in("type", ["delivery", "invoice"]) };
  assert.deepEqual(ids(await f.service.kanban(f.prisma, actor, { group: "invoice", state }, addresses)), ["invoice"]);
  assert.deepEqual(ids(await f.service.kanban(f.prisma, actor, { group: "invoice", state })), []);
});

test("filters combine with the screen domain through AND", async () => {
  const f = fixture();
  const addresses = { domain: (d: import("./domain-builder").DomainBuilder) => d.in("type", ["delivery", "invoice"]) };
  const filtered = { ...state, filters: [{ field: "type", operator: "eq" as const, value: "contact" }] };
  assert.deepEqual(ids(await f.service.list(f.prisma, actor, filtered, addresses)), []);
});
