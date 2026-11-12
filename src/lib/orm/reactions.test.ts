import assert from "node:assert/strict";
import test from "node:test";
import { Fields,Model,defineModel,onchange,depends,constraint,displayName,ModelValidationError,type ReactionValues,type ModelContext } from "./index";
import { createModelService } from "./service";
import { unboundRepository } from "./repository";
import type { PrismaClient } from "@/generated/prisma/client";
const context={tx:{},actor:{id:"admin",sessionVersion:1},operation:"create",previous:null} as ModelContext;
class Explicit extends Model {
  name=Fields.Text({required:true}); other=Fields.Text({required:true});
  preview={length:Fields.Integer({required:true})};
  onchange=[{method:"change",fields:["name"],writes:["name"],preview:["length"]}];
  change(values:ReactionValues){return {name:String(values.name).toUpperCase(),length:String(values.name).length};}
}
class Decorated extends Model {
  name=Fields.Text({required:true}); other=Fields.Text({required:true});
  preview={length:Fields.Integer({required:true})};
  @onchange({fields:["name"],writes:["name"],preview:["length"]})
  change(values:ReactionValues){return {name:String(values.name).toUpperCase(),length:String(values.name).length};}
  @constraint("name")
  validateName(values:ReactionValues){if(values.name==="blocked")throw new ModelValidationError("Bloqueado.",{name:"Cambia el nombre."});}
  @displayName("name")
  label(values:ReactionValues){return `Registro ${values.name}`;}
}
const make=(cls:new()=>Model)=>defineModel(cls,{name:"ReactionTest",table:"reaction_tests"});
test("explicit and decorated reactions share a strict partial-draft engine and publish identical rules",async()=>{
  const a=make(Explicit),b=make(Decorated);
  assert.deepEqual(a.reactionRules,b.reactionRules);
  const draft={name:"abc"};
  assert.deepEqual(await a.react("name",draft,context),await b.react("name",draft,context));
  assert.deepEqual(await b.react("name",draft,context),{patch:{name:"ABC"},preview:{length:3}});
  assert.deepEqual(draft,{name:"abc"});
  for(const input of [{name:"abc",other:"not declared as input"},{name:5},{name:"abc",createBy:"forged"}]) await assert.rejects(b.react("name",input,context));
  await assert.rejects(b.react("missing",draft,context),/registrada/);
  assert.deepEqual(Object.keys(b.fields),["name","other"]);
  assert.equal(b.displayName({id:"1",name:"ABC",other:"secret"}),"Registro ABC");
});
test("constraints are authoritative after transformations, inherited once and overrides shadow decorators",async()=>{
  const model=make(Decorated);
  await assert.rejects(model.beforeSave({name:"blocked",other:"ok"},context),ModelValidationError);
  class Override extends Decorated {change(values:ReactionValues){return {name:String(values.name),length:String(values.name).length};}}
  assert.equal(make(Override).reactionRules.length,0);
  class Inherit extends Decorated {}
  assert.equal(make(Inherit).reactionRules.length,1);
  class Duplicate extends Decorated {onchange=[{method:"change",fields:["name"],writes:["name"]}];}
  assert.throws(()=>make(Duplicate),/duplicada/);
});
test("preview calculations cannot write model fields and reactions cannot return unregistered output",async()=>{
  class Invalid extends Model {
    name=Fields.Text(); preview={length:Fields.Integer()};
    @depends({fields:["name"],preview:["length"]})
    compute(){return {name:"forged"};}
  }
  await assert.rejects(make(Invalid).react("name",{name:null},context),/no autorizado/);
  class Hidden extends Model {name=Fields.Text({sensitive:true});@onchange({fields:["name"],writes:["name"]}) run(){return {name:"x"};}}
  assert.throws(()=>make(Hidden),/inválido/);
});
test("reaction service validates session and revision in a read-only transaction and fails closed",async()=>{
  const calls:string[]=[];
  let account={active:true,isAdmin:true,sessionVersion:1};
  const tx={$executeRaw:async()=>{calls.push("readonly");},user:{findUnique:async()=>{calls.push("actor");return account;}}};
  const prisma={$transaction:async(run:(tx:unknown)=>unknown)=>run(tx)} as unknown as PrismaClient;
  const model=make(Decorated),repository={...unboundRepository<ReturnType<typeof model.parse>>(),read:async()=>({id:"1",revision:"2026-11-11T00:00:00.000Z",name:"old",other:"ok"})};
  const service=createModelService(model,repository,{columns:[{field:"name",label:"Name"}],searchFields:["name"]});
  const request={field:"name",values:{name:"abc"},id:"1",revision:"2026-11-11T00:00:00.000Z"};
  assert.equal((await service.react(prisma,context.actor,request)).ok,true);
  assert.deepEqual(calls,["readonly","actor"]);
  for(const bad of [{...request,revision:undefined},{...request,revision:"2026-11-10T00:00:00.000Z"},{...request,field:"read"},{...request,actor:"fake"}]) assert.equal((await service.react(prisma,context.actor,bad)).ok,false);
  for(const invalid of [{active:false,isAdmin:true,sessionVersion:1},{active:true,isAdmin:false,sessionVersion:1},{active:true,isAdmin:true,sessionVersion:0}]) {account=invalid;assert.equal((await service.react(prisma,context.actor,request)).ok,false);}
});
