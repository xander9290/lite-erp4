import assert from "node:assert/strict";
import test from "node:test";
import { Model, defineModel } from "./model";
import { Fields } from "./fields";
import { createModelService } from "./service";
import { unboundRepository } from "./repository";
import { recordAuditColumns } from "./audit";
import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import type { ListState } from "../list/types";
import type { ListActionOptions } from "./domain";

const model = defineModel(class Example extends Model { name = Fields.Text({ required: true }); }, { name: "AuditExample", table: "audit_examples" });
const repository = unboundRepository<{ name: string }>();

test("relation presentation requires a non-sensitive Many2one scalar", () => {
  const related = defineModel(class extends Model {
    name = Fields.Text();
    brandId = Fields.Many2one("Brand");
    hiddenId = Fields.Many2one("Brand", { sensitive: true });
  }, { name: "RelatedExample", table: "related_example" });
  const create = (field: string) => createModelService(related, unboundRepository<ReturnType<typeof related.parse>>(), { columns: [{ field, label: field, widget: "many2one" }], searchFields: [] });
  assert.doesNotThrow(() => create("brandId"));
  for (const field of ["name", "hiddenId", "brand.name", "$labels", "unknown"]) assert.throws(() => create(field));
});

test("collection images require a declared public Image scalar and bounded presentation options", () => {
  const images = defineModel(class extends Model {
    name = Fields.Text();
    photo = Fields.Image({ folder: "tests/photos" });
    hidden = Fields.Image({ folder: "tests/hidden", sensitive: true });
  }, { name: "ImageListTest", table: "image_list_tests" });
  const imageRepository = unboundRepository<ReturnType<typeof images.parse>>();
  const column = { field: "photo", label: "Imagen", widget: "image" as const, type: "text" as const, imageSize: "sm" as const, imageShape: "squared" as const };
  const create = (patch: Record<string, unknown>) => createModelService(images, imageRepository, { columns: [{ ...column, ...patch }], searchFields: [] });
  assert.doesNotThrow(() => create({}));
  for (const patch of [{ field: "name" }, { field: "hidden" }, { field: "createByUser.password" }, { field: "unknown" }, { avatarField: "hidden" }, { imageSize: "huge" }, { imageShape: "other" }, { format: "boolean" }, { type: "integer" }, { widget: undefined }]) assert.throws(() => create(patch), /auditoría habilitada/);
});

test("audit presentation is opt-in and only accepts public paths and approved avatars", () => {
  assert.doesNotThrow(() => createModelService(model, repository, { audit: true, columns: recordAuditColumns, searchFields: ["createByUser.login", "createByUser.partner.name"] }));
  assert.throws(() => createModelService(model, repository, { columns: recordAuditColumns, searchFields: [] }), /auditoría habilitada/);
  for (const field of ["createByUser.password", "createByUser.sessionVersion", "createByUser.partner.email", "audit"]) {
    assert.throws(() => createModelService(model, repository, { audit: true, columns: [{ field, label: field }], searchFields: [] }), /auditoría habilitada/);
    assert.throws(() => createModelService(model, repository, { audit: true, columns: recordAuditColumns, searchFields: [field] }), /búsquedas de texto/);
  }
  assert.throws(() => createModelService(model, repository, { audit: true, columns: [{ ...recordAuditColumns[0], avatarField: "createByUser.password" }], searchFields: [] }), /auditoría habilitada/);
  assert.throws(() => createModelService(model, repository, { audit: true, columns: [{ ...recordAuditColumns[1], type: "text" }], searchFields: [] }), /auditoría habilitada/);
});

const state: ListState = { query: "", sort: "name", direction: "asc", page: 1, pageSize: 10, filters: [] };
const actor = { id: "server-user", sessionVersion: 3 };
function listFixture(account = { active: true, isAdmin: true, sessionVersion: 3 }) {
  const calls: { where: unknown; query?: unknown }[] = [];
  const tx = { user: { findUnique: async () => account } } as unknown as Prisma.TransactionClient;
  const prisma = { $transaction: async (run: (tx: Prisma.TransactionClient) => unknown, options: unknown) => {
    assert.deepEqual(options, { isolationLevel: "RepeatableRead" });
    return run(tx);
  } } as unknown as PrismaClient;
  const service = createModelService(model, { ...repository,
    count: async (_tx, where) => { assert.equal(_tx, tx); calls.push({ where }); return 5; },
    list: async (_tx, query) => { assert.equal(_tx, tx); calls.push({ where: query.where, query }); return [{ id: "own-record", name: "Propio" }]; },
  }, { columns: [{ field: "name", label: "Nombre", sortable: true }], searchFields: ["name"] });
  return { service, prisma, tx, calls };
}

test("list actions AND their server domain with visible filters for the same count and paginated query", async () => {
  const { service, prisma, tx, calls } = listFixture();
  const own = service.defineListAction({ domain: context => {
    assert.equal(context.tx, tx); assert.deepEqual(context.actor, actor);
    return [{ field: "createBy", operator: "eq", value: context.actor.id }];
  } });
  const result = await own(prisma, actor, { ...state, page: 999, pageSize: 2, filters: [{ field: "name", operator: "contains", value: "auto" }] });
  assert.ok(result.ok); assert.equal(result.data.page, 3); assert.equal(result.data.total, 5);
  assert.equal(calls[0].where, calls[1].where);
  assert.deepEqual(calls[0].where, { AND: [{ AND: [{ createBy: { equals: actor.id } }] }, { name: { contains: "auto", mode: "insensitive" } }] });
  assert.deepEqual(calls[1].query, { where: calls[0].where, sort: "name", direction: "asc", skip: 4, take: 2, audit: false });
  calls.length = 0;
  await own(prisma, actor, state);
  assert.deepEqual(calls[0].where, { AND: [{ AND: [{ createBy: { equals: actor.id } }] }] });
});

test("domain callbacks run only after the transaction revalidates active admin and session version", async () => {
  for (const account of [{ active: false, isAdmin: true, sessionVersion: 3 }, { active: true, isAdmin: false, sessionVersion: 3 }, { active: true, isAdmin: true, sessionVersion: 4 }]) {
    const { service, prisma, calls } = listFixture(account);
    let invoked = false;
    const load = service.defineListAction({ domain: () => { invoked = true; return []; } });
    assert.equal((await load(prisma, actor, state)).ok, false);
    assert.equal(invoked, false); assert.equal(calls.length, 0);
  }
});

test("client attempts to supply a domain or actor are rejected and malformed callbacks never fall back to an unfiltered read", async () => {
  const { service, prisma, calls } = listFixture();
  const own = service.defineListAction({ domain: ({ actor }) => [{ field: "createBy", operator: "eq", value: actor.id }] });
  for (const extra of [{ domain: [] }, { where: {} }, { actor: { id: "other" } }]) assert.equal((await own(prisma, actor, { ...state, ...extra })).ok, false);
  for (const domain of [() => null, () => undefined, () => [{ field: "missing", operator: "eq", value: true }], () => { throw new Error("Unavailable context"); }]) {
    const action = service.defineListAction({ domain } as unknown as ListActionOptions<{ name: string }>);
    assert.equal((await action(prisma, actor, state)).ok, false);
  }
  assert.equal(calls.length, 0);
  assert.throws(() => service.defineListAction({ domain: null } as unknown as ListActionOptions<{ name: string }>), /Dominio/);
  assert.throws(() => service.defineListAction({ where: {} } as unknown as ListActionOptions<{ name: string }>), /domain/);
});

test("grouping and leaf pagination retain the authorized domain and filters in the same snapshot", async () => {
  const { prisma, tx } = listFixture();
  const calls: Record<string, unknown>[] = [];
  const service = createModelService(model, { ...repository,
    count: async (_tx, where) => { assert.equal(_tx, tx); calls.push(where); return 12; },
    groups: async (_tx, query) => { assert.equal(_tx, tx); calls.push(query); return [{ value: "A", count: 8 }, { value: "B", count: 4 }]; },
    list: async (_tx, query) => { assert.equal(_tx, tx); calls.push(query); return [{ id: "one", name: "A" }]; },
  }, { columns: [{ field: "name", label: "Nombre", sortable: true, groupable: true }], searchFields: ["name"] });
  const mine = service.defineListAction({ domain: ({ actor }) => [{ field: "createBy", operator: "eq", value: actor.id }] });
  const request = { ...state, pageSize: 1, groupBy: ["name"], query: "A" };
  const root = await mine(prisma, actor, request);
  assert.ok(root.ok); assert.equal(root.data.hasMoreGroups, true); assert.deepEqual(root.data.groups, [{ value: "A", count: 8 }]);
  assert.equal(calls[1].where, calls[0]); assert.equal(calls[1].take, 2);
  const leaf = await mine(prisma, actor, { ...request, groupPath: ["A"], page: 2 });
  assert.ok(leaf.ok); assert.equal(leaf.data.groups, undefined); assert.equal(calls[3].skip, 1);
  assert.deepEqual(calls[2], { AND: [{ name: "A" }, { AND: [{ createBy: { equals: actor.id } }] }, { OR: [{ name: { contains: "A", mode: "insensitive" } }] }] });
  assert.equal(calls[3].where, calls[2]);
  calls.length = 0;
  for (const patch of [{ groupBy: ["password"] }, { groupBy: ["name", "name"] }, { groupPath: ["A", "B"] }]) assert.equal((await mine(prisma, actor, { ...request, ...patch })).ok, false);
  assert.equal(calls.length, 0);
});

test("group queries never run for inactive, non-admin or stale sessions", async () => {
  for (const account of [{ active: false, isAdmin: true, sessionVersion: 3 }, { active: true, isAdmin: false, sessionVersion: 3 }, { active: true, isAdmin: true, sessionVersion: 4 }]) {
    const { service, prisma, calls } = listFixture(account);
    assert.equal((await service.list(prisma, actor, { ...state, groupBy: ["name"] })).ok, false);
    assert.equal(calls.length, 0);
  }
});
