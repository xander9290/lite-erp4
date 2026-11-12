import assert from "node:assert/strict";
import test from "node:test";
import { createModelReactionEngine,type ReactionState } from "./modelReactionEngine";
import type { ReactionRequest,ReactionResult,ReactionRule } from "@/lib/orm/reactions.types";
const rule:ReactionRule={fields:["source"],reads:["source"],writes:["target"],preview:["label"]};
function harness(rules:readonly ReactionRule[]=[rule]){
  let values:Record<string,unknown>={source:null,target:null};
  let watch:((values:unknown,event:{name?:string})=>void)|undefined;
  let state:ReactionState={preview:{},pending:false,error:null};
  const queue:{request:ReactionRequest;resolve:(value:ReactionResult)=>void}[]=[],waiters:((value:{request:ReactionRequest;resolve:(value:ReactionResult)=>void})=>void)[]=[];
  const engine=createModelReactionEngine({getValues:()=>({...values}),setValue:(name,value)=>{values[name]=value;watch?.(values,{name});},watch:callback=>{watch=callback;return{unsubscribe:()=>{watch=undefined;}};}},{rules,debounceMs:0,load:request=>new Promise(resolve=>{const item={request,resolve};const waiter=waiters.shift();if(waiter)waiter(item);else queue.push(item);})},value=>{state=value;});
  return {engine,get state(){return state;},get values(){return values;},change:(name:string,value:unknown)=>{values[name]=value;watch?.(values,{name});},reset:()=>{values={source:null,target:null};watch?.(values,{});},next:()=>queue.length?Promise.resolve(queue.shift()!):new Promise<{request:ReactionRequest;resolve:(value:ReactionResult)=>void}>(resolve=>waiters.push(resolve))};
}
const result=(value:string):ReactionResult=>({ok:true,patch:{target:value},preview:{label:value}});
test("initial preview stays out of form values, stale replies are ignored and user edits win",async()=>{
  const h=harness();
  const initial=await h.next();initial.resolve(result("initial"));await h.engine.settle();
  assert.equal(h.values.target,null);assert.equal(h.state.preview.label,"initial");
  h.change("source","A");const a=await h.next();
  h.change("source","B");const b=await h.next();
  h.change("target","manual");b.resolve(result("B"));await h.engine.settle();
  a.resolve(result("A"));await new Promise<void>(resolve=>queueMicrotask(()=>resolve()));
  assert.equal(h.values.target,"manual");assert.equal(h.state.preview.label,"B");
  h.engine.dispose();
});
test("reset invalidates pending replies and initializes preview without dirty patches",async()=>{
  const h=harness();const initial=await h.next();initial.resolve(result("initial"));await h.engine.settle();
  h.change("source","old");const old=await h.next();h.reset();
  const fresh=await h.next();fresh.resolve(result("reset"));await h.engine.settle();old.resolve(result("old"));await new Promise<void>(resolve=>queueMicrotask(()=>resolve()));
  assert.equal(h.values.target,null);assert.equal(h.state.preview.label,"reset");h.engine.dispose();
});
test("equivalent trigger groups coalesce, unrelated success preserves errors, correction recovers",async()=>{
  const multi={fields:["source","other"],reads:["source","other"],writes:["target"],preview:[]};
  const independent={fields:["extra"],reads:["extra"],writes:[],preview:["label"]};
  const h=harness([multi,independent]);const initial=await h.next();initial.resolve({ok:true,patch:{},preview:{label:"initial"}});await h.engine.settle();
  h.change("source","bad");h.change("other","v");const bad=await h.next();assert.deepEqual(bad.request.values,{source:"bad",other:"v"});bad.resolve({ok:false,error:"invalid"});assert.equal(await h.engine.settle(),false);
  h.change("extra","ok");const extra=await h.next();extra.resolve({ok:true,patch:{},preview:{label:"ok"}});assert.equal(await h.engine.settle(),false);assert.equal(h.state.error,"invalid");
  h.change("other","fixed");const fixed=await h.next();fixed.resolve({ok:true,patch:{target:"fixed"},preview:{}});assert.equal(await h.engine.settle(),true);assert.equal(h.values.target,"fixed");h.engine.dispose();
});
