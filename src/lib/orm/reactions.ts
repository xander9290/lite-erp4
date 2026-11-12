import "server-only";
import { z } from "zod";
import type { Field } from "./fields";
import { isField } from "./fields";
import type { ModelContext } from "./context";
import { ModelValidationError } from "./context";
import { decoratedMethods, type ReactionDeclaration, type ConstraintDeclaration, type DisplayDeclaration } from "./decorators";
import type { ReactionRule } from "./reactions.types";

export type ReactionValues = Readonly<Record<string, unknown>>;
export type ReactionContext = Pick<ModelContext,"tx"|"actor"|"id"> & {
  resolveRelated?: (field: string, id: string) => Promise<Record<string, unknown>>;
};
type Declarations = { onchange?:readonly ReactionDeclaration[]; constraints?:readonly ConstraintDeclaration[]; preview?:Readonly<Record<string,Field>> };
const names=(values:readonly string[], allowed:Set<string>)=>Array.isArray(values)&&values.length<=12&&new Set(values).size===values.length&&values.every(name=>allowed.has(name));
const forbidden=new Set(["id","revision","createdAt","updatedAt","createBy","createByUser","constructor","prototype","__proto__"]);
export function compileModelMethods(instance:object & Declarations, fields:Readonly<Record<string,Field>>, relatedFields:Readonly<Record<string,Field>> = {}, computedFields:Readonly<Record<string,Field>> = {}) {
  const decorated=decoratedMethods(instance);
  const declarations=[...(instance.onchange??[]),...decorated.reactions];
  const constraints=[...(instance.constraints??[]),...decorated.constraints];
  const publicFields=new Set(Object.keys(fields).filter(name=>!fields[name].metadata.sensitive));
  const preview={...instance.preview};
  const computedGroups = new Map<string,string[]>();
  for (const [name, descriptor] of Object.entries(computedFields)) {
    if (Object.hasOwn(preview,name)) throw new Error(`Preview duplicado: ${name}.`);
    const method = descriptor.metadata.compute!;
    preview[name]=descriptor;
    computedGroups.set(method,[...(computedGroups.get(method)??[]),name]);
  }
  const reactions = declarations.map(declaration => {
    const outputs = computedGroups.get(declaration.method);
    if (!outputs) return declaration;
    if (declaration.writes?.length || declaration.preview?.length) throw new Error(`compute ${declaration.method}: declara sólo dependencias, sin writes/preview manuales.`);
    return {...declaration,preview:outputs};
  });
  for (const method of computedGroups.keys()) if (!reactions.some(rule=>rule.method===method)) throw new Error(`compute ${method}: registra sus dependencias con @depends.`);
  const relatedGroups = new Map<string, string[]>();
  for (const [name, descriptor] of Object.entries(relatedFields)) {
    if (Object.hasOwn(preview, name)) throw new Error(`Preview duplicado: ${name}.`);
    const root = descriptor.metadata.related!.split(".")[0];
    if (!Object.hasOwn(fields, root) || fields[root].metadata.kind !== "many2one" || fields[root].metadata.sensitive) throw new Error(`related necesita una relación Many2one local no sensible: ${root}.`);
    preview[name] = descriptor;
    relatedGroups.set(root, [...(relatedGroups.get(root) ?? []), name]);
  }
  for (const [root, outputs] of relatedGroups) reactions.push({method: `$related:${root}`, fields:[root], preview:outputs});
  if(Object.keys(preview).length>12) throw new Error("Máximo 12 campos de preview.");
  for(const [name,field] of Object.entries(preview)) if(!/^[a-z][A-Za-z0-9]*$/.test(name)||forbidden.has(name)||Object.hasOwn(fields,name)||!isField(field)||field.metadata.sensitive) throw new Error(`Preview inválido: ${name}.`);
  const previews=new Set(Object.keys(preview));
  const method=(name:string) => {
    if (name.startsWith("$related:") && relatedGroups.has(name.slice(9))) {
      const root = name.slice(9), outputs = relatedGroups.get(root)!;
      return async (values:ReactionValues, context:ReactionContext) => {
        if (values[root] == null || values[root] === "") return Object.fromEntries(outputs.map(output => [output, null]));
        if (!context.resolveRelated) throw new ModelValidationError("Actualiza orm:bind para resolver los campos relacionados.");
        return context.resolveRelated(root, String(values[root]));
      };
    }
    if(forbidden.has(name)||!["string"].includes(typeof name)) throw new Error("Método de modelo inválido.");
    const fn=Reflect.get(instance,name);
    if(typeof fn!=="function") throw new Error(`No existe el método ${name}.`);
    return fn as (values:ReactionValues,context:ReactionContext|ModelContext)=>unknown;
  };
  const seen=new Set<string>();
  const rules=reactions.map(declaration=>{
    if(seen.has(declaration.method)) throw new Error(`Reacción duplicada: ${declaration.method}.`);
    seen.add(declaration.method); method(declaration.method);
    const rule:ReactionRule={fields:[...declaration.fields],reads:[...(declaration.reads??declaration.fields)],writes:[...(declaration.writes??[])],preview:[...(declaration.preview??[])]};
    if(!rule.fields.length||!names(rule.fields,publicFields)||!names(rule.reads,publicFields)||!rule.fields.every(name=>rule.reads.includes(name))||!names(rule.writes,publicFields)||!names(rule.preview,previews)||!rule.writes.length&&!rule.preview.length) throw new Error(`Contrato onchange inválido: ${declaration.method}.`);
    for(const entries of Object.values(rule)) Object.freeze(entries);
    const inputSchema=z.strictObject(Object.fromEntries(rule.reads.map(name=>[name,fields[name].schema.optional().nullable()])));
    return Object.freeze({declaration,rule:Object.freeze(rule),inputSchema});
  });
  const outputs=new Set<string>();
  for(const {rule} of rules) for(const name of [...rule.writes.map(name=>`patch:${name}`),...rule.preview.map(name=>`preview:${name}`)]) {
    if(outputs.has(name)) throw new Error(`Salida duplicada: ${name}. Agrupa sus disparadores en una sola reacción.`);
    outputs.add(name);
  }
  const constrained=new Set<string>();
  for(const rule of constraints) {
    if(constrained.has(rule.method)||!rule.fields.length||!names(rule.fields,new Set(Object.keys(fields)))) throw new Error(`Restricción inválida/duplicada: ${rule.method}.`);
    constrained.add(rule.method);method(rule.method);
  }
  if(decorated.displays.length>1) throw new Error("Sólo se admite un método displayName decorado.");
  const display:DisplayDeclaration|undefined=decorated.displays[0];
  if(display)method(display.method);
  return {
    rules:Object.freeze(rules.map(item=>item.rule)),
    preview,
    display,
    format(record:ReactionValues) {return method(display!.method).call(instance,record,{} as ReactionContext);},
    async constrain(values:ReactionValues,context:ModelContext) {
      for(const rule of constraints) {
        const result=await method(rule.method).call(instance,Object.freeze({...values}),context);
        if(result!==undefined) throw new Error("Una restricción debe lanzar ModelValidationError o devolver void.");
      }
    },
    async react(field:string,input:Readonly<Record<string,unknown>>,context:ReactionContext) {
      // Apply validated editable patches first; virtual methods in this request
      // see that same effective draft, without another frontend reaction/cascade.
      const active=rules.filter(item=>item.rule.fields.includes(field)).sort((a,b)=>Number(Boolean(b.rule.writes.length))-Number(Boolean(a.rule.writes.length)));
      if(!active.length) throw new ModelValidationError("El campo no tiene una reacción registrada.");
      const permitted=new Set(active.flatMap(item=>item.rule.reads));
      if(Object.keys(input).some(name=>!permitted.has(name))) throw new ModelValidationError("El borrador contiene campos no permitidos.");
      const patch:Record<string,unknown>={}, calculated:Record<string,string|number|boolean|null>={};
      for(const {declaration,rule,inputSchema} of active) {
        // Validate supplied dependencies; unrelated required fields may still be empty.
        const effectiveInput = computedGroups.has(declaration.method) ? {...input,...patch} : input;
        const values=inputSchema.parse(Object.fromEntries(Object.entries(effectiveInput).filter(([name])=>rule.reads.includes(name))));
        const result=await method(declaration.method).call(instance,Object.freeze(values),context);
        const computed = computedGroups.get(declaration.method);
        const output = computed?.length === 1 ? {[computed[0]]:result} : result;
        if(!output||typeof output!=="object"||Array.isArray(output)) throw new ModelValidationError("La reacción debe devolver un patch.");
        if (computed && (Object.keys(output).length!==computed.length || computed.some(name=>!Object.hasOwn(output,name)))) throw new ModelValidationError("El método compute debe devolver todos sus campos declarados.");
        for(const [name,value] of Object.entries(output)) {
          if(rule.writes.includes(name)) {
            if(Object.hasOwn(patch,name)) throw new ModelValidationError("Dos reacciones intentan modificar el mismo campo.");
            patch[name]=fields[name].schema.parse(value);
          } else if(rule.preview.includes(name)) {
            if(Object.hasOwn(calculated,name)) throw new ModelValidationError("Dos cálculos producen el mismo preview.");
            const parsed=preview[name].schema.parse(value);
            if(parsed!==null&&!["string","number","boolean"].includes(typeof parsed)) throw new ModelValidationError("Preview no serializable.");
            calculated[name]=parsed as string|number|boolean|null;
          } else throw new ModelValidationError("La reacción devolvió un campo no autorizado.");
        }
      }
      return {patch,preview:calculated};
    },
  };
}
