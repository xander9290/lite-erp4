"use server";
import type { ModelLookupRequest } from "@/lib/many2one/model-lookup";
import { modelLookupSchema } from "@/lib/many2one/model-lookup";
import type { ReactionRequest, ReactionResult } from "@/lib/orm/reactions.types";
import type { ReactionContext } from "@/lib/orm/reactions";
import { relatedValues } from "@/lib/orm/related";
import { relatedImageModel } from "./related-image.model";
import { resolveCollectionRelated } from "@/lib/orm/collection-related";
import { unboundRepository } from "@/lib/orm/repository";
import type { Prisma } from "@/generated/prisma/client";
import type { ListState,ListResult } from "@/lib/list/types";
import type { KanbanRequest } from "@/lib/kanban/types";
import { createDemoRecords,demoPage,demoGroups } from "./collection-demo";
import { Fields, Model, defineModel } from "@/lib/orm";
import { resolveDisplayNames } from "@/lib/orm/display.server";

// Public fixture only. No database, credentials, persistence or real ERP records.
const rows = [
  {id:"with-photo",label:"Modelo con imagen",maker:{avatar:"https://res.cloudinary.com/demo/image/upload/sample.jpg"}},
  {id:"without-photo",label:"Modelo sin imagen",maker:null},
];
export async function lookupRelatedImage(input:ModelLookupRequest) {
  const parsed = modelLookupSchema.safeParse(input);
  if (!parsed.success) return {ok:false as const,error:"Consulta no válida."};
  const {id,ids,query,page,pageSize}=parsed.data;
  const found=rows.filter(row=>id?row.id===id:ids?ids.includes(row.id):row.label.toLowerCase().includes(query.toLowerCase()));
  return {ok:true as const,total:found.length,page,pageSize,items:found.slice((page-1)*pageSize,page*pageSize).map(row=>({value:row.id,label:row.label,record:{id:row.id}}))};
}
export async function reactRelatedImage(input:ReactionRequest):Promise<ReactionResult> {
  try {
    const result=await relatedImageModel.react(input.field,input.values,{
      resolveRelated:async (_field,id)=>{
        const row=rows.find(row=>row.id===id);
        if (!row) throw new Error("Modelo ficticio no disponible.");
        return relatedValues(row,{photo:"maker.avatar"});
      },
    } as ReactionContext);
    return {ok:true,...result};
  } catch { return {ok:false,error:"No se pudo cargar la imagen del ejemplo."}; }
}

const collectionRows=createDemoRecords().slice(0,3).map((row,index)=>({...row,status:demoGroups[index].value,modelId:index===1?"without-photo":"with-photo"}));
const collectionDisplayModel=defineModel(class extends Model {
  name=Fields.Text({required:true});
  displayName(record:Readonly<Record<string,unknown>>):string { return `Ficha · ${record.name}`; }
},{name:"CollectionDisplayDemo",table:"collection_display_demo"});
async function relatedCollectionPage(state:ListState,group?:string):Promise<ListResult> {
  const page=demoPage(collectionRows,state,group);
  if (!page.ok) return page;
  try {
    // The repository is a public in-memory fixture; actual apps use generated Prisma bindings.
    const repository={...unboundRepository(),relatedMany:async(_tx:Prisma.TransactionClient,_field:string,ids:readonly string[])=>Object.fromEntries(ids.map(id=>[id,relatedValues(rows.find(row=>row.id===id),{photo:"maker.avatar"})]))};
    const enriched=await resolveCollectionRelated({} as Prisma.TransactionClient,page.data.rows,["photo"],relatedImageModel.relatedFields,repository);
    const names=await resolveDisplayNames({} as Prisma.TransactionClient,enriched,collectionDisplayModel,repository);
    return {...page,data:{...page.data,rows:enriched.map(row=>({...row,$displayName:names.get(row.id)!}))}};
  } catch { return {ok:false,error:"No se pudo resolver la imagen relacionada del ejemplo."}; }
}
export async function sampleRelatedImagesList(state:ListState):Promise<ListResult> {return relatedCollectionPage(state);}
export async function sampleRelatedImagesKanban({state,group}:KanbanRequest):Promise<ListResult> {
  if (!demoGroups.some(item=>item.value===group)) return {ok:false,error:"Grupo no válido."};
  return relatedCollectionPage(state,group);
}
