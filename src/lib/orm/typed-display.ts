import "server-only";
import type { z } from "zod";
import type { Field } from "./fields";
import { displayFieldPaths, displayRelation, projectDisplayRecord } from "./display";

type DisplayModel = { fields: Readonly<Record<string, Field>>; metadata: Readonly<Record<string, Field["metadata"]>>; schema: z.ZodType; displayFields?: readonly string[] };
type Scalars<M extends DisplayModel> = Extract<keyof M["fields"], string> | "id";
type Alias<K extends string> = K extends `${infer A}Id` ? A : `${K}Record`;
type Aliases<M extends DisplayModel> = Alias<Extract<keyof M["fields"], string>>;
type Value<M extends DisplayModel, K extends string> = K extends "id" ? string : K extends keyof M["fields"] ? z.output<M["fields"][K]["schema"]> : never;
type RelationKey<M extends DisplayModel, A extends string> = { [K in Extract<keyof M["fields"], string>]: Alias<K> extends A ? K : never }[Extract<keyof M["fields"], string>];
type Relations<M> = M extends { readonly displayRelations: infer R extends Record<string, DisplayModel> } ? R : Record<never, never>;
type Paths<M extends DisplayModel, R extends Record<string, DisplayModel>, Depth extends readonly unknown[] = []> = Scalars<M> | (Depth["length"] extends 3 ? never : { [A in Extract<keyof R, string>]: `${A}.${Paths<R[A], Relations<R[A]>, [...Depth, unknown]>}` }[Extract<keyof R, string>]);
type Member<M extends DisplayModel, R extends Record<string, DisplayModel>, P extends string> = P extends `${infer A}.${infer K}` ? A extends keyof R ? { readonly [N in A]: Member<R[A], Relations<R[A]>, K> | (null extends Value<M, RelationKey<M, A>> ? null : never) } : never : { readonly [K in P]: Value<M, K> };
type Intersect<U> = (U extends unknown ? (value: U) => void : never) extends (value: infer I) => void ? I : never;
export type DisplayValues<M extends DisplayModel, R extends Record<string, DisplayModel>, P extends string> = Readonly<{ id: string } & Intersect<Member<M, R, P>>>;

/** Typed opt-in for scalar dependencies and up to three declared Many2one hops. */
export function withDisplayName<M extends DisplayModel, const R extends Record<string, DisplayModel>, const P extends readonly Paths<M, R>[]>(
  model: M, relations: R & Record<Exclude<keyof R, Aliases<M>>, never>, paths: P,
  format: (record: DisplayValues<M, R, P[number]>) => string,
) {
  for (const [alias, target] of Object.entries(relations) as [string, DisplayModel][]) {
    const [, field] = displayRelation(model.metadata, alias);
    if (!("name" in target) || field.target !== target.name) throw new Error(`Destino de displayName incompatible: ${alias}.`);
  }
  const fields = displayFieldPaths(model.metadata, paths);
  for (const path of fields) {
    const parts = path.split(".");
    let current: DisplayModel = model;
    let targets: Record<string, DisplayModel> = relations;
    for (let index = 0; index < parts.length; index++) {
      const name = parts[index];
      if (index === parts.length - 1) {
        if (name !== "id" && (!Object.hasOwn(current.fields, name) || current.fields[name].metadata.sensitive)) throw new Error(`Dependencia de displayName inválida: ${path}.`);
      } else {
        const [, relation] = displayRelation(current.metadata, name);
        const target = targets[name];
        if (!target || !("name" in target) || relation.target !== target.name) throw new Error(`Dependencia de displayName inválida: ${path}.`);
        current = target;
        targets = "displayRelations" in target ? target.displayRelations as Record<string, DisplayModel> : {};
      }
    }
  }
  return Object.freeze({ ...model, displayRelations: Object.freeze({ ...relations }), displayFields: fields,
    displayName(record: Readonly<Record<string, unknown>>): string {
      const label = format(projectDisplayRecord(record, fields) as DisplayValues<M, R, P[number]>);
      if (typeof label !== "string") throw new Error("displayName debe devolver texto de forma síncrona.");
      return label.trim() || String(record.id);
    },
  });
}

/** Infer decorated display projections from a class's Fields and declared displayRelations. */
type DeclarationModel<I> = {
 fields:{[K in keyof I as I[K] extends {readonly related:string} | {readonly compute:string} ? never : I[K] extends Field ? K extends string ? K : never : never]:Extract<I[K],Field>};
 metadata:Readonly<Record<string,Field["metadata"]>>;schema:z.ZodType;
};
export type DisplayOf<I,R extends Record<string,DisplayModel>,P extends Paths<DeclarationModel<I>,R>> = DisplayValues<DeclarationModel<I>,R,P>;
export type DisplayRecord<I,P extends Paths<DeclarationModel<I>,Relations<I>>> = DisplayValues<DeclarationModel<I>,Relations<I>,P>;
