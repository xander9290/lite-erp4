import "server-only";
import { z } from "zod";
import { isField, type Field, type FieldMetadata } from "./fields";
import type { ModelContext } from "./context";
import { compileModelMethods } from "./reactions";
import type { ReactionDeclaration, ConstraintDeclaration } from "./decorators";
import type { ReactionContext } from "./reactions";
import { displayFieldPaths, displayRelation, projectDisplayRecord } from "./display";

const modelTag = Symbol("orm.model");

/** Declaration base only: no implicit persistence, requests or database connections. */
export abstract class Model {
  declare protected readonly [modelTag]: true;
  readonly onchange?: readonly ReactionDeclaration[];
  readonly constraints?: readonly ConstraintDeclaration[];
  readonly preview?: Readonly<Record<string,Field>>;
  readonly displayRelations?:Readonly<Record<string,{name:string;fields:Readonly<Record<string,Field>>;metadata:Readonly<Record<string,FieldMetadata>>;schema:z.ZodType}>>;
  readonly displayFields?: readonly string[];
  displayName?(record: Readonly<Record<string, unknown>>): string;
  normalize?(values: Readonly<Record<string, unknown>>): Record<string, unknown>;
  beforeSave?(values: Record<string, unknown>, context: ModelContext): Record<string, unknown> | Promise<Record<string, unknown>>;
  afterSave?(record: Record<string, unknown>, context: ModelContext): void | Promise<void>;
}

type Constructor = new () => Model;
type DeclaredFields<I> = { [K in keyof I as I[K] extends Field ? K extends string ? K : never : never]: Extract<I[K], Field> };
type Shape<I> = { [K in keyof DeclaredFields<I>]: DeclaredFields<I>[K]["schema"] };
type Values<I> = { [K in keyof DeclaredFields<I>]: z.output<DeclaredFields<I>[K]["schema"]> };
type Input<I> = { [K in keyof DeclaredFields<I>]: z.input<DeclaredFields<I>[K]["schema"]> };
export type ModelOptions = { readonly name: string; readonly table: string };
const reservedFields = new Set(["id", "revision", "createdAt", "updatedAt", "createBy", "createByUser", "constructor", "prototype"]);

export function defineModel<C extends Constructor>(Declaration: C, options: ModelOptions) {
  if (!options || typeof options.name !== "string" || typeof options.table !== "string" || !/^[A-Z][A-Za-z0-9]*$/.test(options.name) || !/^[a-z][a-z0-9_]*$/.test(options.table)) throw new Error("El modelo necesita un nombre PascalCase y una tabla snake_case válidos.");
  const instance = new Declaration();
  if (!(instance instanceof Model)) throw new Error("La declaración debe extender Model.");
  const fields: Record<string, Field> = {};
  const metadata: Record<string, FieldMetadata> = {};
  const shape: Record<string, z.ZodType> = {};
  for (const [name, value] of Object.entries(instance)) {
    if (["displayFields","onchange","constraints","preview","displayRelations"].includes(name)) continue;
    if (typeof value === "function") continue;
    if (!isField(value)) throw new Error(`${options.name}.${name}: declara el dato mediante Fields.`);
    if (!/^[a-z][A-Za-z0-9]*$/.test(name) || reservedFields.has(name)) throw new Error(`Nombre de campo inválido o reservado: ${name}.`);
    fields[name] = value;
    metadata[name] = value.metadata;
    shape[name] = value.schema;
  }
  if (!Object.keys(fields).length) throw new Error("El modelo debe declarar al menos un Field.");
  for(const [alias,target] of Object.entries(instance.displayRelations??{})) if(displayRelation(metadata,alias)[1].target!==target.name) throw new Error(`Destino inválido: ${alias}.`);
  const methods=compileModelMethods(instance,fields);
  if(methods.display && instance.displayFields) throw new Error("Usa displayFields o @displayName, no ambos.");
  const displayKeys = displayFieldPaths(metadata, methods.display?.fields ?? instance.displayFields);
  // Runtime collection filters precisely the descriptor keys represented by Shape.
  const schema = z.strictObject(shape as Shape<InstanceType<C>>);
  return Object.freeze({
    name: options.name, table: options.table,
    fields: Object.freeze(fields) as Readonly<DeclaredFields<InstanceType<C>>>,
    metadata: Object.freeze(metadata) as Readonly<{ [K in keyof DeclaredFields<InstanceType<C>>]: FieldMetadata }>,
    schema,
    displayFields: displayKeys,
    displayRelations:(instance.displayRelations??{}) as InstanceType<C> extends {displayRelations:infer R}?R:Record<never,never>,
    reactionRules: methods.rules,
    previewFields: methods.preview,
    react(field:string,values:Readonly<Record<string,unknown>>,context:ReactionContext) {return methods.react(field,values,context);},
    displayName(record: Readonly<Record<string, unknown>>): string {
      const projected = projectDisplayRecord(record, displayKeys);
      const label = methods.display ? methods.format(projected) : instance.displayName ? instance.displayName(projected) : projected.name ?? record.id;
      if (typeof label !== "string") throw new Error("displayName debe devolver texto de forma síncrona.");
      return label.trim() || projected.id;
    },
    createDefaults(): Input<InstanceType<C>> {
      return Object.fromEntries(Object.entries(fields).map(([name, field]) => [name, field.createDefault()])) as Input<InstanceType<C>>;
    },
    parse(input: unknown): Values<InstanceType<C>> {
      return schema.parse(input) as Values<InstanceType<C>>;
    },
    normalize(input: Record<string, unknown>): Values<InstanceType<C>> {
      // Unknown input keys must fail even if the normalizer would drop them.
      if (Object.keys(input).some(key => !Object.hasOwn(fields, key))) throw new Error("La normalización sólo acepta campos declarados.");
      const values = Object.freeze({ ...input });
      return schema.parse(instance.normalize ? instance.normalize(values) : values) as Values<InstanceType<C>>;
    },
    async beforeSave(values: Values<InstanceType<C>>, context: ModelContext<Values<InstanceType<C>>>): Promise<Values<InstanceType<C>>> {
      const result=schema.parse(instance.beforeSave ? await instance.beforeSave(values, context) : values) as Values<InstanceType<C>>;
      await methods.constrain(result,context);
      return result;
    },
    async afterSave(record: Record<string, unknown>, context: ModelContext<Values<InstanceType<C>>>) { await instance.afterSave?.(record, context); },
  });
}

type ModelContract = { readonly schema: z.ZodType };
export type ModelInput<T extends ModelContract> = z.input<T["schema"]>;
export type ModelValues<T extends ModelContract> = z.output<T["schema"]>;
