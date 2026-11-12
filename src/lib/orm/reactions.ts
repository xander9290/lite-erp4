import "server-only";
import { z } from "zod";
import type { Field } from "./fields";
import { isField } from "./fields";
import type { ModelContext } from "./context";
import { ModelValidationError } from "./context";
import { decoratedMethods, type ReactionDeclaration, type ConstraintDeclaration, type DisplayDeclaration } from "./decorators";
import type { ReactionRule } from "./reactions.types";

export type ReactionValues = Readonly<Record<string, unknown>>;
export type ReactionContext = Pick<ModelContext,"tx"|"actor"|"id">;
type Declarations = { onchange?:readonly ReactionDeclaration[]; constraints?:readonly ConstraintDeclaration[]; preview?:Readonly<Record<string,Field>> };
const names=(values:readonly string[], allowed:Set<string>)=>Array.isArray(values)&&values.length<=12&&new Set(values).size===values.length&&values.every(name=>allowed.has(name));
const forbidden=new Set(["id","revision","createdAt","updatedAt","createBy","createByUser","constructor","prototype","__proto__"]);
export function compileModelMethods(instance:object & Declarations, fields:Readonly<Record<string,Field>>) {
  const decorated=decoratedMethods(instance);
  const reactions=[...(instance.onchange??[]),...decorated.reactions];
  const constraints=[...(instance.constraints??[]),...decorated.constraints];
  const publicFields=new Set(Object.keys(fields).filter(name=>!fields[name].metadata.sensitive));
  const preview=instance.preview??{};
  if(Object.keys(preview).length>12) throw new Error("Máximo 12 campos de preview.");
  for(const [name,field] of Object.entries(preview)) if(!/^[a-z][A-Za-z0-9]*$/.test(name)||forbidden.has(name)||Object.hasOwn(fields,name)||!isField(field)||field.metadata.sensitive) throw new Error(`Preview inválido: ${name}.`);
  const previews=new Set(Object.keys(preview));
  const method=(name:string) => {
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
      const active=rules.filter(item=>item.rule.fields.includes(field));
      if(!active.length) throw new ModelValidationError("El campo no tiene una reacción registrada.");
      const permitted=new Set(active.flatMap(item=>item.rule.reads));
      if(Object.keys(input).some(name=>!permitted.has(name))) throw new ModelValidationError("El borrador contiene campos no permitidos.");
      const patch:Record<string,unknown>={}, calculated:Record<string,string|number|boolean|null>={};
      for(const {declaration,rule,inputSchema} of active) {
        // Validate supplied dependencies; unrelated required fields may still be empty.
        const values=inputSchema.parse(Object.fromEntries(Object.entries(input).filter(([name])=>rule.reads.includes(name))));
        const output=await method(declaration.method).call(instance,Object.freeze(values),context);
        if(!output||typeof output!=="object"||Array.isArray(output)) throw new ModelValidationError("La reacción debe devolver un patch.");
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
