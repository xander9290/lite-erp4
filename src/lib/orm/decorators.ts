import "server-only";
export type ReactionDeclaration = { method: string; fields: readonly string[]; reads?: readonly string[]; writes?: readonly string[]; preview?: readonly string[] };
export type ConstraintDeclaration = { method: string; fields: readonly string[] };
export type DisplayDeclaration = { method: string; fields: readonly string[] };
type Annotation = { kind: "onchange" | "depends"; options: Omit<ReactionDeclaration,"method"> } | { kind:"constraint" | "display"; fields:readonly string[] };
const annotations = new WeakMap<(...args:never[])=>unknown, Annotation[]>();
/** Compatibility adapter for Next's supported legacy decorator transform; no reflect-metadata. */
function annotation(definition:Annotation):MethodDecorator {
  return (target,name,descriptor)=>{
    if(typeof target==="function"||typeof name!=="string"||typeof descriptor.value!=="function") throw new Error("Los decoradores ORM requieren métodos de instancia.");
    const method=descriptor.value as (...args:never[])=>unknown;
    annotations.set(method,[...(annotations.get(method)??[]),definition]);
  };
}
export const onchange = (options:Omit<ReactionDeclaration,"method">) => annotation({kind:"onchange",options});
/** Read-only, non-persisted calculations; dependencies are model fields, outputs are preview fields. */
export const depends = (options:Omit<ReactionDeclaration,"method"|"writes">) => annotation({kind:"depends",options:{...options,writes:[]}});
export const constraint = (...fields:string[]) => annotation({kind:"constraint",fields});
export const displayName = (...fields:string[]) => annotation({kind:"display",fields});

export function decoratedMethods(instance:object) {
  const reactions:ReactionDeclaration[]=[], constraints:ConstraintDeclaration[]=[], displays:DisplayDeclaration[]=[];
  const seen=new Set(Object.getOwnPropertyNames(instance).filter(name=>typeof Reflect.get(instance,name)==="function"));
  for(let proto=Object.getPrototypeOf(instance);proto && proto!==Object.prototype;proto=Object.getPrototypeOf(proto)) {
    for(const name of Object.getOwnPropertyNames(proto)) {
      if(seen.has(name)) continue;
      seen.add(name);
      const descriptor=Object.getOwnPropertyDescriptor(proto,name);
      if(typeof descriptor?.value!=="function") continue;
      for(const definition of annotations.get(descriptor.value)??[]) {
        if(definition.kind==="onchange" || definition.kind==="depends") reactions.push({method:name,...definition.options});
        else if(definition.kind==="constraint") constraints.push({method:name,fields:definition.fields});
        else if(definition.kind==="display") displays.push({method:name,fields:definition.fields});
      }
    }
  }
  return {reactions,constraints,displays};
}
