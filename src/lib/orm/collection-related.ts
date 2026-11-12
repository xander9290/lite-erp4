import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import type { ListRecord,ListValue } from "@/lib/list/types";
import type { Field } from "./fields";
import type { ModelRepository } from "./repository";

/** Source IDs come only from this authorized page, in the same transaction. */
export async function resolveCollectionRelated<T>(tx:Prisma.TransactionClient, rows:readonly ListRecord[], names:readonly string[], fields:Readonly<Record<string,Field>>, repository:ModelRepository<T>):Promise<ListRecord[]> {
  if (!rows.length || !names.length) return [...rows];
  if (!repository.relatedMany) throw new Error("Actualiza orm:bind para publicar related en colecciones.");
  const roots = new Map<string,string[]>();
  for (const name of names) {
    const descriptor = Object.hasOwn(fields,name) ? fields[name] : undefined;
    if (!descriptor?.metadata.related || descriptor.metadata.sensitive) throw new Error("Campo related no publicado.");
    const root=descriptor.metadata.related.split(".")[0];
    roots.set(root,[...(roots.get(root)??[]),name]);
  }
  const result=rows.map(row=>({...row}));
  for (const [root,outputs] of roots) {
    const ids=[...new Set(rows.map(row=>row[root]).filter((id):id is string=>typeof id==="string"&&!!id))];
    const resolved=new Map<string,Readonly<Record<string,unknown>>>();
    for (let offset=0;offset<ids.length;offset+=100) {
      const batch=await repository.relatedMany(tx,root,ids.slice(offset,offset+100),outputs);
      for(const [id,record] of Object.entries(batch)) resolved.set(id,record);
    }
    for (const row of result) for (const name of outputs) {
      const id=row[root];
      const record=typeof id==="string"?resolved.get(id):undefined;
      const value=fields[name].schema.parse(record&&Object.hasOwn(record,name)?record[name]:null);
      if (value!==null && !["string","number","boolean"].includes(typeof value)) throw new Error("Related no serializable.");
      row[name]=value as ListValue;
    }
  }
  return result;
}
