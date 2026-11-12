import assert from "node:assert/strict";
import test from "node:test";
import { Fields,Model,defineModel } from "./index";
import { createModelService } from "./service";
import { unboundRepository } from "./repository";
import type { ModelRepository } from "./repository";
import type { PrismaClient } from "@/generated/prisma/client";
import type { ListRecord,ListState } from "@/lib/list/types";
import { resolveCollectionRelated } from "./collection-related";
import { modelColumns } from "./presentation";

class Vehicle extends Model {
  name=Fields.Text();modelId=Fields.Many2one("PublicModel");
  state=Fields.Selection([{value:"draft",label:"Borrador"},{value:"done",label:"Hecho"}],{required:true});
  photo=Fields.Image({related:"modelId.makerId.avatar",label:"Fabricante"});
}
const model=defineModel(Vehicle,{name:"RelatedCollection",table:"related_collection"});
type Values={name:string|null;modelId:string|null;state:"draft"|"done"};
const actor={id:"admin",sessionVersion:1};
const state:ListState={query:"",page:1,pageSize:10,sort:"name",direction:"asc",filters:[]};
const policy={fields:["name","modelId","state","photo"],searchFields:["name"],sortable:["name"],filterable:["name"],groupable:["modelId"]};
const source:ListRecord[]=[{id:"a",name:"A",modelId:"m1",state:"draft",secret:"private"},{id:"b",name:"B",modelId:"m1",state:"draft"},{id:"c",name:"C",modelId:null,state:"draft"}];

test("list, card source and kanban enrich only this page, batch duplicate references and preserve publication",async()=>{
  let active=true,batches=0;const where:unknown[]=[];
  const tx={user:{findUnique:async()=>({active,isAdmin:true,sessionVersion:1})}};
  const prisma={$transaction:async(fn:(transaction:unknown)=>unknown)=>fn(tx)} as unknown as PrismaClient;
  const repository:ModelRepository<Values>={...unboundRepository<Values>(),count:async()=>source.length,
    list:async(_tx,query)=>{where.push(query.where);return source;},
    relatedMany:async(transaction,field,ids,outputs)=>{assert.equal(transaction,tx);assert.equal(field,"modelId");assert.deepEqual(ids,["m1"]);assert.deepEqual(outputs,["photo"]);batches++;return {m1:{photo:"https://example.com/avatar.png",secret:"never published"}};},
  };
  const service=createModelService(model,repository,{list:policy,kanban:{field:"state"}});
  const result=await service.list(prisma,actor,state);
  assert.ok(result.ok);
  assert.equal(result.data.rows[0].photo,"https://example.com/avatar.png");
  assert.equal(result.data.rows[1].photo,result.data.rows[0].photo);
  assert.equal(result.data.rows[2].photo,null);
  assert.equal(result.data.rows[0].secret,undefined);
  assert.equal(source[0].photo,undefined);
  assert.equal(batches,1);
  assert.equal((await service.kanban(prisma,actor,{group:"draft",state})).ok,true);
  assert.equal(batches,2);assert.match(JSON.stringify(where[1]),/draft/);
  const restricted=service.defineListAction({domain:[{field:"state",operator:"eq",value:"draft"}]});
  assert.equal((await restricted(prisma,actor,state)).ok,true);assert.equal(batches,3);
  active=false;
  assert.equal((await service.list(prisma,actor,state)).ok,false);assert.equal(batches,3);
});

test("related are display-only capabilities; fabricated filters/order/groups never reach repositories",async()=>{
  const repository=unboundRepository<Values>();
  for (const key of ["searchFields","sortable","filterable","groupable"] as const) assert.throws(()=>createModelService(model,repository,{list:{...policy,[key]:["photo"]}}),/related/);
  const fields={photo:{metadata:{...model.relatedFields.photo.metadata,readOnly:true}}};
  assert.equal(modelColumns(fields,[{field:"photo",imageShape:"squared"}])[0].widget,"image");
  assert.throws(()=>modelColumns(fields,[{field:"photo",groupable:true}]),/lectura/);
  let read=0;
  const prisma={$transaction:async(fn:(tx:unknown)=>unknown)=>fn({user:{findUnique:async()=>({active:true,isAdmin:true,sessionVersion:1})}})} as unknown as PrismaClient;
  const service=createModelService(model,{...repository,count:async()=>{read++;return 1;},list:async()=>source},{list:policy});
  for(const request of [{...state,sort:"photo"},{...state,groupBy:["photo"]},{...state,filters:[{field:"photo",operator:"eq",value:"x"}]}]) assert.equal((await service.list(prisma,actor,request)).ok,false);
  assert.equal(read,0);
  assert.equal((await service.list(prisma,actor,state)).ok,false); // Old binding cannot silently omit a requested related.
});

test("Many2one groups keep exact IDs with duplicate labels and expand with the same key",async()=>{
  const predicates:unknown[]=[];
  const repository:ModelRepository<Values>={...unboundRepository<Values>(),count:async()=>2,list:async(_tx,q)=>{predicates.push(q.where);return [];},groups:async()=>[{value:"m1",count:1},{value:"m2",count:1}]};
  const prisma={$transaction:async(fn:(tx:unknown)=>unknown)=>fn({user:{findUnique:async()=>({active:true,isAdmin:true,sessionVersion:1})}})} as unknown as PrismaClient;
  const service=createModelService(model,repository,{list:{...policy,fields:["name","modelId","state"]},relations:{modelId:async()=>({ok:true,items:[{value:"m1",label:"Mismo nombre",record:{id:"m1"}},{value:"m2",label:"Mismo nombre",record:{id:"m2"}}],total:2,page:1,pageSize:10})}});
  const result=await service.list(prisma,actor,{...state,groupBy:["modelId"]});assert.ok(result.ok);
  assert.deepEqual(result.data.groups,[{value:"m1",count:1,label:"Mismo nombre"},{value:"m2",count:1,label:"Mismo nombre"}]);
  assert.equal((await service.list(prisma,actor,{...state,groupBy:["modelId"],groupPath:["m2"]})).ok,true);
  assert.match(JSON.stringify(predicates[0]),/"modelId":"m2"/);
});

test("batch resolver is bounded and validates URL results before publishing",async()=>{
  const tx={} as Parameters<typeof resolveCollectionRelated>[0];
  let calls=0;
  const rows=Array.from({length:205},(_,index)=>({id:String(index),modelId:`m${index}`}));
  const repository:ModelRepository<Values>={...unboundRepository<Values>(),relatedMany:async(_tx,_root,ids)=>{assert.ok(ids.length<=100);calls++;return Object.fromEntries(ids.map(id=>[id,{photo:null}]));}};
  const result=await resolveCollectionRelated(tx,rows,["photo"],model.relatedFields,repository);
  assert.equal(result.length,205);assert.equal(calls,3);
  const prototypeId=await resolveCollectionRelated(tx,[{id:"safe",modelId:"__proto__"}],["photo"],model.relatedFields,{...repository,relatedMany:async()=>Object.fromEntries([["__proto__",{photo:"https://example.com/safe.png"}]])});
  assert.equal(prototypeId[0].photo,"https://example.com/safe.png");
  await assert.rejects(resolveCollectionRelated(tx,[{id:"x",modelId:"m"}],["photo"],model.relatedFields,{...repository,relatedMany:async()=>({m:{photo:"javascript:unsafe"}})}));
});
