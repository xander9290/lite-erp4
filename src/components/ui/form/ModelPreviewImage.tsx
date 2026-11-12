"use client";
import Image from "next/image";
import { useContext } from "react";
import { FormModelContext } from "./modelFields";
export default function ModelPreviewImage({name,label="Imagen relacionada",widget="image",shape="rounded"}:{name:string;label?:string;widget?:"image"|"avatar";shape?:"rounded"|"squared"}) {
  const model=useContext(FormModelContext),state=model?.reactionState;
  const value=state?.preview[name];
  return <div className="space-y-2" role="group" aria-label={label}>
    <span className="text-sm font-medium">{label}</span>
    {typeof value==="string"&&value?<Image src={value} alt={label} width={112} height={112} unoptimized className={`h-28 w-28 object-contain ${widget==="avatar"&&shape==="rounded"?"rounded-full":"rounded-none"}`} />:<div className="flex h-28 w-28 items-center justify-center border border-base-300 text-xs text-base-content/50">{state?.pending?"Cargando…":"Sin imagen"}</div>}
  </div>;
}
export function ModelReactionStatus(){
  const model=useContext(FormModelContext),state=model?.reactionState;
  if(state?.error)return <p role="alert" className="text-sm text-error">{state.error} <button type="button" className="btn btn-ghost btn-xs" onClick={model?.retryReaction}>Reintentar</button></p>;
  return state?.pending?<p role="status" className="text-xs text-base-content/50">Actualizando datos relacionados…</p>:null;
}
