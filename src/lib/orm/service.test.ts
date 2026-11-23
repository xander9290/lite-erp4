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
import { AccessError } from "../auth/policy";

const model = defineModel(class Example extends Model { name = Fields.Text({ required: true }); }, { name: "AuditExample", table: "audit_examples" });
const repository = unboundRepository<{ name: string }>();

test("nested lookup revalidates read scope and projects displayName within the supplied transaction", async () => {
  const category = defineModel(class Category extends Model {
    name = Fields.Text({ required: true });
    displayName(record: { name: string }) { return `Categoría · ${record.name}`; }
  }, { name: "HistoryCategory", table: "history_categories" });
  const tx = {} as Prisma.TransactionClient, actor = { id: "actor", sessionVersion: 0 };
  let allowed = true, queries = 0;
  const scope = { active: true };
  const service = createModelService(category, {
    ...unboundRepository<ReturnType<typeof category.parse>>(),
    count: async (received, where) => { assert.equal(received, tx); assert.deepEqual(where, { AND: [scope, { id: { in: ["visible", "hidden"] } }] }); return 1; },
    lookup: async (received, query) => {
      queries++; assert.equal(received, tx); assert.deepEqual(query.fields, ["id", "name"]);
      return [{ id: "visible", name: "Soporte", secret: "never publish" }];
    },
  }, { list: { fields: ["name"], searchFields: ["name"] }, authorize: async (received, who, operation) => {
    assert.equal(received, tx); assert.equal(who, actor); assert.equal(operation, "read");
    if (!allowed) throw new AccessError("DENIED");
    return scope;
  } });
  const result = await service.lookupInTransaction(tx, actor, { ids: ["visible", "hidden"] });
  assert.deepEqual(result.items, [{ value: "visible", label: "Categoría · Soporte", record: { id: "visible" } }]);
  assert.doesNotMatch(JSON.stringify(result), /secret|never publish/);
  allowed = false;
  await assert.rejects(service.lookupInTransaction(tx, actor, { ids: ["visible", "hidden"] }), AccessError);
  assert.equal(queries, 1, "denied readers never execute the projection");
});

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

test("badge service columns require public Selection and valid semantic colors", () => {
  const selection = defineModel(class extends Model {
    state = Fields.Selection([{value:"draft",label:"Borrador"}], {required:true});
    name = Fields.Text();
    secret = Fields.Selection([{value:"draft",label:"Secreto"}], {sensitive:true});
  }, {name:"BadgeExample",table:"badge_examples"});
  const create = (patch: Record<string,unknown>) => createModelService(selection, unboundRepository<ReturnType<typeof selection.parse>>(), {
    columns:[{field:"state",label:"Estado",widget:"badge",colors:{draft:"info"},...patch}],searchFields:[],
  });
  assert.doesNotThrow(() => create({}));
  assert.doesNotThrow(() => create({colors:undefined}));
  assert.doesNotThrow(() => create({widget:undefined}));
  for (const patch of [{field:"name"},{field:"secret"},{colors:{other:"info"}},{colors:{draft:"red"}},{field:"name",widget:undefined},{field:"secret",widget:undefined},{format:"number"}]) {
    assert.throws(() => create(patch));
  }
});

test("legacy Kanban moves stay compatible, while an explicit empty graph never writes", async () => {
  const workflow=defineModel(class extends Model {
    name=Fields.Text({required:true});
    estado=Fields.Selection([{value:"a",label:"A"},{value:"b",label:"B"}],{required:true});
  },{name:"LegacyBoard",table:"legacy_board"});
  for(const transitions of [undefined,[]] as const) {
    const original={id:"r1",revision:"2026-11-14T00:00:00.000Z",name:"A",estado:"a" as const};
    let stored: ReturnType<typeof workflow.parse> & {id:string;revision:string}={...original};
    let writes=0;
    const tx={} as Prisma.TransactionClient;
    const prisma={$transaction:async(run:(tx:Prisma.TransactionClient)=>unknown,options:unknown)=>{
      assert.deepEqual(options,{isolationLevel:"Serializable"}); return run(tx);
    }} as unknown as PrismaClient;
    const service=createModelService(workflow,{
      ...unboundRepository<ReturnType<typeof workflow.parse>>(),
      read:async()=>({...stored}),
      update:async(_tx,_id,_revision,values)=>{
        writes++; stored={...stored,...values,revision:"2026-11-14T00:00:01.000Z"}; return {...stored};
      },
    },{columns:[{field:"name",label:"Nombre"},{field:"estado",label:"Estado"}],searchFields:["name"],
      kanban:{field:"estado",...(transitions?{transitions}:{})},authorize:async()=>undefined});
    const actor={id:"actor",sessionVersion:0};
    assert.equal((await service.move(prisma,actor,{...original,from:"a",to:"b"})).ok,false,"extra fields rejected");
    assert.equal((await service.move(prisma,actor,{id:original.id,revision:original.revision,from:"a",to:"a"})).ok,true);
    assert.equal(writes,0,"same-state request is a no-op");
    const result=await service.move(prisma,actor,{id:original.id,revision:original.revision,from:"a",to:"b"});
    assert.equal(result.ok,transitions===undefined);
    assert.equal(writes,transitions===undefined?1:0);
    assert.equal(stored.estado,transitions===undefined?"b":"a");
  }
});

test("audit presentation is opt-in and only accepts public paths and approved avatars", () => {
  assert.doesNotThrow(() => createModelService(model, repository, { audit: true, columns: recordAuditColumns, searchFields: ["createByUser.login", "createByUser.name"] }));
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

test("server list policy projects rows, rejects manipulated capabilities and resolves all collection labels", async () => {
  const related=defineModel(class extends Model { name=Fields.Text({required:true}); brandId=Fields.Many2one("Brand"); state=Fields.Selection([{value:"draft",label:"Borrador"}],{required:true}); hidden=Fields.Text(); },{name:"PolicyWork",table:"policy_work"});
  let reads=0, lookups=0;
  const tx={user:{findUnique:async()=>({active:true,isAdmin:true,sessionVersion:3})}} as unknown as Prisma.TransactionClient;
  const prisma={$transaction:async(run:(tx:Prisma.TransactionClient)=>unknown)=>run(tx)} as unknown as PrismaClient;
  const service=createModelService(related,{...unboundRepository<ReturnType<typeof related.parse>>(),count:async()=>1,
    list:async()=>{reads++;return [{id:"1",revision:"rev",name:"Car",brandId:"brand",state:"draft",hidden:"private"}];},
    groups:async()=>[{value:"brand",count:1}],
  },{list:{fields:["name","brandId","state"],searchFields:["name"],sortable:["name"],groupable:["brandId"],filterable:["name"]},kanban:{field:"state"},relations:{brandId:async request=>{
    lookups++;assert.deepEqual(request.ids,["brand"]);return {ok:true,total:1,page:1,pageSize:100,items:[{value:"brand",label:"Marca",record:{id:"brand"}}]};
  }}});
  for(const result of [await service.list(prisma,actor,state),await service.defineListAction({domain:[{field:"state",operator:"eq",value:"draft"}]})(prisma,actor,state),await service.kanban(prisma,actor,{group:"draft",state})]) {
    assert.ok(result.ok);assert.equal(result.data.rows[0].hidden,undefined);assert.deepEqual(result.data.rows[0].$labels,{brandId:{value:"brand",label:"Marca"}});
  }
  const grouped=await service.list(prisma,actor,{...state,groupBy:["brandId"]}); assert.ok(grouped.ok);assert.equal(grouped.data.groups?.[0].label,"Marca");
  assert.equal(lookups,4);
  const before=reads;
  for(const bad of [{...state,sort:"hidden"},{...state,groupBy:["hidden"]},{...state,filters:[{field:"hidden",operator:"eq",value:"x"}]}]) assert.equal((await service.list(prisma,actor,bad)).ok,false);
  assert.equal(reads,before);
  assert.throws(()=>createModelService(related,unboundRepository(),{list:{fields:["name"],searchFields:["hidden"]}}),/política/);
});
