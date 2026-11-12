"use server";
import { z } from "zod";
import { sampleReactionModel } from "./reaction-model";
import { ModelValidationError } from "@/lib/orm";
import type { ModelContext } from "@/lib/orm";
import type { ReactionRequest,ReactionResult } from "@/lib/orm/reactions.types";
const fakeTx=new Proxy({},{get(){throw new Error("El ejemplo no tiene acceso a datos.");}}) as ModelContext["tx"];
const context={tx:fakeTx,actor:Object.freeze({id:"sample",sessionVersion:0})};
export async function sampleOnchange(input:ReactionRequest):Promise<ReactionResult>{
  try {
    const request=z.strictObject({field:z.string().max(60),values:z.record(z.string(),z.unknown())}).parse(input);
    if(JSON.stringify(request.values).length>2000)throw new Error("Borrador demasiado grande.");
    return {ok:true,...await sampleReactionModel.react(request.field,request.values,context)};
  }catch{return {ok:false,error:"Revisa las dependencias del ejemplo."};}
}
export async function validateReactionExample(input:unknown){
  try {
    const values=sampleReactionModel.parse(input);
    await sampleReactionModel.beforeSave(values,{...context,operation:"create",previous:null});
    return {ok:true as const};
  }catch(error){return {ok:false as const,error:error instanceof ModelValidationError?error.message:"Revisa los valores del ejemplo."};}
}
