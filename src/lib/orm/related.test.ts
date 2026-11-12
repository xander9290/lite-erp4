import assert from "node:assert/strict";
import test from "node:test";
import { Fields, Model, defineModel, type ModelInput } from "./index";
import { relatedProjectionPlan } from "./generator/related";
import { repositoryFiles } from "./generator/bind";
import { relatedValues } from "./related";
import { displayLookupSelect } from "./display";
import { createModelService } from "./service";
import { unboundRepository } from "./repository";
import type { PrismaClient } from "@/generated/prisma/client";
import type { ReactionContext } from "./reactions";

class Maker extends Model {
  name = Fields.Text();
  avatar = Fields.Image({folder:"makers"});
  secret = Fields.Text({sensitive:true});
}
const maker = defineModel(Maker,{name:"RelatedMaker",table:"related_makers"});
class Variant extends Model {
  makerId = Fields.Many2one("RelatedMaker");
}
const variant = defineModel(Variant,{name:"RelatedVariant",table:"related_variants"});
class Vehicle extends Model {
  variantId = Fields.Many2one("RelatedVariant");
  picture = Fields.Image({related:"variantId.makerId.avatar",label:"Fabricante"});
  makerName = Fields.Text({related:"variantId.makerId.name"});
}
const vehicle = defineModel(Vehicle,{name:"RelatedVehicle",table:"related_vehicles"});
const entry = {model:vehicle,clientFields:["variantId"]};
const profile = {id:"related",depends:[],models:[{model:maker,clientFields:["name","avatar","secret"]},{model:variant,clientFields:["makerId"]},entry]};
const actor = {id:"admin",sessionVersion:1};
const context = {tx:{},actor} as ReactionContext;

test("related stays outside persistence, defaults and input types and shares one reaction per root",async()=>{
  const input:ModelInput<typeof vehicle>={variantId:null};
  assert.deepEqual(vehicle.createDefaults(),input);
  assert.deepEqual(Object.keys(vehicle.fields),["variantId"]);
  assert.equal(vehicle.schema.safeParse({...input,picture:"forged"}).success,false);
  assert.equal(vehicle.reactionRules.length,1);
  let calls=0;
  const resolved=await vehicle.react("variantId",{variantId:"one"},{...context,resolveRelated:async(root,id)=>{calls++;assert.equal(root,"variantId");assert.equal(id,"one");return {picture:"https://example.com/logo.png",makerName:"Maker"};}});
  assert.equal(calls,1);
  assert.deepEqual(resolved,{patch:{},preview:{picture:"https://example.com/logo.png",makerName:"Maker"}});
  assert.deepEqual(await vehicle.react("variantId",{variantId:null},context),{patch:{},preview:{picture:null,makerName:null}});
  await assert.rejects(vehicle.react("variantId",{variantId:"one"},context),/orm:bind/);
  await assert.rejects(vehicle.react("variantId",{variantId:"one",picture:"forged"},context),/no permitidos/);
  await assert.rejects(vehicle.react("variantId",{variantId:"one"},{...context,resolveRelated:async()=>({picture:"javascript:bad"})}));
});

test("projection is generated once per relation, validates all publication hops and emits fixed delegates",()=>{
  const [plan]=relatedProjectionPlan(profile,entry);
  assert.deepEqual(plan.outputs,{picture:"maker.avatar",makerName:"maker.name"});
  assert.equal(plan.target,"RelatedVariant");
  const source=repositoryFiles(profile)["RelatedVehicle.store.ts"];
  assert.match(source,/tx\.relatedVariant\.findUnique/);
  assert.equal((source.match(/tx\.relatedVariant\.findUnique/g)??[]).length,1);
  assert.match(source,/RelatedMakerDisplayFields.avatar.metadata/);
  assert.throws(()=>relatedProjectionPlan({...profile,models:profile.models.map(item=>item.model===maker?{...item,clientFields:["name"]}:item)},entry),/publicado/);
  assert.throws(()=>relatedProjectionPlan({...profile,models:profile.models.filter(item=>item.model!==maker)},entry),/mismo perfil/);
  class Private extends Model {variantId=Fields.Many2one("RelatedVariant");value=Fields.Text({related:"variantId.makerId.secret"});}
  assert.throws(()=>relatedProjectionPlan(profile,{model:defineModel(Private,{name:"PrivateExample",table:"private_examples"}),clientFields:["variantId"]}),/sensible/);
  class WrongType extends Model {variantId=Fields.Many2one("RelatedVariant");value=Fields.Image({related:"variantId.makerId.name"});}
  assert.throws(()=>relatedProjectionPlan(profile,{model:defineModel(WrongType,{name:"WrongExample",table:"wrong_examples"}),clientFields:["variantId"]}),/tipo/);
});

test("projection preserves nulls and fails closed if metadata becomes sensitive",()=>{
  assert.deepEqual(relatedValues({maker:null},{picture:"maker.avatar"}),{picture:null});
  assert.deepEqual(relatedValues({maker:{avatar:"x",secret:"private"}},{picture:"maker.avatar"}),{picture:"x"});
  assert.throws(()=>displayLookupSelect(["maker.avatar"],{"maker.avatar":[{metadata:Fields.Image({folder:"x",sensitive:true}).metadata}]}),/sensible/);
  for(const related of ["id","variantId.__proto__.avatar","a.b.c.d.e"]) assert.throws(()=>Fields.Image({related}));
  assert.throws(()=>Fields.Image({related:"variantId.avatar",default:null}),/lectura/);
  assert.throws(()=>Fields.Image({related:"variantId.avatar",tracking:true}),/lectura/);
});

test("service resolves related in the existing authorized readonly transaction and rejects stale revisions",async()=>{
  let active=true,queries=0;
  const tx={$executeRaw:async()=>{},user:{findUnique:async()=>({active,isAdmin:true,sessionVersion:1})}};
  const prisma={$transaction:async(fn:(transaction:unknown)=>unknown)=>fn(tx)} as unknown as PrismaClient;
  const service=createModelService(vehicle,{...unboundRepository<ModelInput<typeof vehicle>>(),
    read:async()=>({id:"saved",revision:"2026-11-12T00:00:00.000Z",variantId:"one"}),
    related:async(transaction,root,id)=>{assert.equal(transaction,tx);assert.equal(root,"variantId");assert.equal(id,"one");queries++;return {picture:null,makerName:"Maker"};},
  },{list:{fields:["variantId"],searchFields:[],sortable:[],filterable:[],groupable:[]}});
  const request={field:"variantId",values:{variantId:"one"}};
  assert.equal((await service.react(prisma,actor,request)).ok,true);
  assert.equal(queries,1);
  assert.equal((await service.react(prisma,actor,{...request,id:"saved",revision:"2026-11-11T00:00:00.000Z"})).ok,false);
  active=false;
  assert.equal((await service.react(prisma,actor,request)).ok,false);
  assert.equal(queries,1);
});
