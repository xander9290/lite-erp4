"use client";
import {useEffect,useRef,useState} from "react";
import type {FieldPath,FieldValues,UseFormReturn} from "react-hook-form";
import {createModelReactionEngine,type FormReactions,type ReactionState} from "./modelReactionEngine";
export type {FormReactions,ReactionState} from "./modelReactionEngine";
export function useModelReactions<T extends FieldValues,C,O>(methods:UseFormReturn<T,C,O>,config?:FormReactions){
  const [state,setState]=useState<ReactionState>({preview:{},pending:false,error:null});
  const engine=useRef<ReturnType<typeof createModelReactionEngine>|null>(null);
  useEffect(()=>{
    if(!config)return;
    const current=createModelReactionEngine({
      getValues:()=>methods.getValues(),
      setValue:(name,value,options)=>methods.setValue(name as FieldPath<T>,value as never,options),
      watch:callback=>methods.watch(callback),
    },config,setState);
    engine.current=current;
    return()=>{current.dispose();if(engine.current===current)engine.current=null;};
  },[methods,config]);
  return {state,settle:()=>engine.current?.settle()??Promise.resolve(true),retry:()=>engine.current?.retry()};
}
