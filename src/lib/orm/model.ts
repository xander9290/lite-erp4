import "server-only";
import { z } from "zod";
import { compileActionParameters, parseActionParameters, type ActionParameterMetadata, type CompiledActionParameters } from "./action-parameters";
import type { ActionDeclaration } from "./decorators";
import { fieldInputSchema } from "./sequence";
import { isField, isOne2many, isMany2many, isChildCollection, type ChildCollectionMetadata, type Many2manyField, type One2manyField, type Field, type FieldMetadata } from "./fields";
import { ModelValidationError, type ModelActor, type ModelContext, type RemoveContext } from "./context";
import type { Prisma } from "@/generated/prisma/client";
import { modelSnapshot } from "./snapshot";
import { compileModelMethods } from "./reactions";
import { decoratedMethods, type ReactionDeclaration, type ConstraintDeclaration } from "./decorators";
import type { ReactionContext } from "./reactions";
import { displayFieldPaths, displayRelation, normalizeDisplayName, projectDisplayRecord } from "./display";

const modelTag = Symbol("orm.model");

/** Declaration base only: no implicit persistence, requests or database connections. */
export abstract class Model {
  declare protected readonly [modelTag]: true;
  readonly onchange?: readonly ReactionDeclaration[];
  readonly constraints?: readonly ConstraintDeclaration[];
  readonly preview?: Readonly<Record<string,Field>>;
  readonly displayRelations?:Readonly<Record<string,{name:string;fields:Readonly<Record<string,Field>>;metadata:Readonly<Record<string,FieldMetadata>>;schema:z.ZodType}>>;
  readonly displayFields?: readonly string[];
  /** Required persistent fields forming a database-enforced compound identity. */
  readonly uniqueTogether?: readonly (readonly string[])[];
  displayName?(record: Readonly<Record<string, unknown>>): string;
  normalize?(values: Readonly<Record<string, unknown>>): Record<string, unknown>;
  beforeSave?(values: Record<string, unknown>, context: ModelContext): Record<string, unknown> | Promise<Record<string, unknown>>;
  afterSave?(record: Record<string, unknown>, context: ModelContext): void | Promise<void>;
  /** Reject a deletion with ModelValidationError; runs in the deletion transaction. */
  beforeRemove?(record: Readonly<Record<string, unknown>>, context: RemoveContext): void | Promise<void>;
}

type Constructor = new () => Model;
type DeclaredFields<I> = { [K in keyof I as I[K] extends { readonly related: string } | {readonly compute:string} ? never : I[K] extends Field ? K extends string ? K : never : never]: Extract<I[K], Field> };
type Shape<I> = { [K in keyof DeclaredFields<I>]: DeclaredFields<I>[K]["schema"] };
type Values<I> = { [K in keyof DeclaredFields<I>]: z.output<DeclaredFields<I>[K]["schema"]> };
type RelationFields<I> = { [K in keyof I as I[K] extends One2manyField | Many2manyField ? K extends string ? K : never : never]: Extract<I[K], One2manyField | Many2manyField> };
type RelationShape<I> = { [K in keyof RelationFields<I>]: RelationFields<I>[K]["schema"] };
type RelationInput<I> = { [K in keyof RelationFields<I>]: z.input<RelationFields<I>[K]["schema"]> };
type Input<I> = { [K in keyof DeclaredFields<I>]: z.input<DeclaredFields<I>[K]["schema"]> };
export type ModelOptions = { readonly name: string; readonly table: string };
const reservedFields = new Set(["id", "revision", "createdAt", "updatedAt", "createBy", "createByUser", "constructor", "prototype"]);

export function defineModel<C extends Constructor>(Declaration: C, options: ModelOptions) {
  if (!options || typeof options.name !== "string" || typeof options.table !== "string" || !/^[A-Z][A-Za-z0-9]*$/.test(options.name) || !/^[a-z][a-z0-9_]*$/.test(options.table)) throw new Error("El modelo necesita un nombre PascalCase y una tabla snake_case válidos.");
  const instance = new Declaration();
  if (!(instance instanceof Model)) throw new Error("La declaración debe extender Model.");
  const fields: Record<string, Field> = {};
  const one2manyFields: Record<string, One2manyField> = {};
  // Read-only relations: presented by the form, never part of the document.
  const childCollections: Record<string, ChildCollectionMetadata> = {};
  const many2manyFields: Record<string, Many2manyField> = {};
  const relatedFields: Record<string, Field> = {};
  const computedFields: Record<string, Field> = {};
  const metadata: Record<string, FieldMetadata> = {};
  const shape: Record<string, z.ZodType> = {};
  for (const [name, value] of Object.entries(instance)) {
    if (["displayFields","onchange","constraints","preview","displayRelations","uniqueTogether"].includes(name)) continue;
    if (typeof value === "function") continue;
    if (isMany2many(value)) {
      if (!/^[a-z][A-Za-z0-9]*$/.test(name) || reservedFields.has(name)) throw new Error(`Nombre Many2many inválido: ${name}.`);
      many2manyFields[name] = value; continue;
    }
    if (isChildCollection(value)) {
      if (!/^[a-z][A-Za-z0-9]*$/.test(name) || reservedFields.has(name)) throw new Error(`Nombre de relación de consulta inválido: ${name}.`);
      childCollections[name] = value.collection; continue;
    }
    if (isOne2many(value)) {
      if (!/^[a-z][A-Za-z0-9]*$/.test(name) || reservedFields.has(name)) throw new Error(`Nombre One2many inválido: ${name}.`);
      one2manyFields[name] = value; continue;
    }
    if (!isField(value)) throw new Error(`${options.name}.${name}: declara el dato mediante Fields.`);
    if (!/^[a-z][A-Za-z0-9]*$/.test(name) || reservedFields.has(name)) throw new Error(`Nombre de campo inválido o reservado: ${name}.`);
    if (value.metadata.related) { relatedFields[name] = value; continue; }
    if (value.metadata.compute) { computedFields[name] = value; continue; }
    fields[name] = value;
    metadata[name] = value.metadata;
    shape[name] = value.schema;
  }
  if (Object.entries(metadata).some(([name, field]) => field.sequence && `${options.name}.${name}`.length > 200)) throw new Error("La clave de secuencia supera 200 caracteres.");
  if (!Object.keys(fields).length) throw new Error("El modelo debe declarar al menos un Field.");
  if (instance.uniqueTogether !== undefined && !Array.isArray(instance.uniqueTogether)) throw new Error("uniqueTogether debe ser una lista de claves compuestas.");
  const uniqueTogether = (instance.uniqueTogether ?? []).map(keys => {
    if (!Array.isArray(keys) || keys.length < 2 || keys.length > 4 || new Set(keys).size !== keys.length || keys.some(name => !metadata[name]?.required || metadata[name].sensitive || metadata[name].sequence || !["text", "integer", "selection", "many2one"].includes(metadata[name].kind) || (metadata[name].kind === "text" && metadata[name].writeOnly))) throw new Error("uniqueTogether requiere entre 2 y 4 campos persistentes obligatorios, públicos y sin repetir.");
    return Object.freeze([...keys]);
  });
  if (uniqueTogether.length > 4 || new Set(uniqueTogether.map(keys => [...keys].sort().join("|"))).size !== uniqueTogether.length) throw new Error("uniqueTogether admite hasta cuatro claves compuestas distintas.");
  for(const [alias,target] of Object.entries(instance.displayRelations??{})) if(displayRelation(metadata,alias)[1].target!==target.name) throw new Error(`Destino inválido: ${alias}.`);
  const methods=compileModelMethods(instance,fields,relatedFields,computedFields,Object.keys({ ...one2manyFields, ...many2manyFields }));
  if(methods.display && instance.displayFields) throw new Error("Usa displayFields o @displayName, no ambos.");
  const displayKeys = displayFieldPaths(metadata, methods.display?.fields ?? instance.displayFields);
  const actions = compileActions(options.name, instance, decoratedMethods(instance).actions);
  // Runtime collection filters precisely the descriptor keys represented by Shape.
  const schema = z.strictObject(shape as Shape<InstanceType<C>>);
  const formSchema = z.strictObject({ ...Object.fromEntries(Object.entries(fields).map(([name, field]) => [name, fieldInputSchema(field)])), ...Object.fromEntries(Object.entries({ ...one2manyFields, ...many2manyFields }).map(([name, field]) => [name, field.schema])) } as Shape<InstanceType<C>> & RelationShape<InstanceType<C>>);
  return Object.freeze({
    name: options.name, table: options.table,
    uniqueTogether: Object.freeze(uniqueTogether),
    fields: Object.freeze(fields) as Readonly<DeclaredFields<InstanceType<C>>>,
    metadata: Object.freeze(metadata) as Readonly<{ [K in keyof DeclaredFields<InstanceType<C>>]: FieldMetadata }>,
    schema, formSchema, many2manyFields: Object.freeze(many2manyFields), one2manyFields: Object.freeze(one2manyFields) as Readonly<Record<string, One2manyField>>,
    childCollections: Object.freeze(childCollections) as Readonly<Record<string, ChildCollectionMetadata>>,
    displayFields: displayKeys,
    displayRelations:(instance.displayRelations??{}) as InstanceType<C> extends {displayRelations:infer R}?R:Record<never,never>,
    reactionRules: methods.rules,
    previewFields: methods.preview,
    relatedFields: Object.freeze(relatedFields),
    computedFields: Object.freeze(computedFields),
    computedRules: methods.computedRules,
    computeCollection(names: readonly string[], values: Readonly<Record<string, unknown>>, context: ReactionContext) { return methods.compute(names, values, context); },
    react(field:string,values:Readonly<Record<string,unknown>>,context:ReactionContext) {return methods.react(field,values,context);},
    displayName(record: Readonly<Record<string, unknown>>): string {
      const projected = projectDisplayRecord(record, displayKeys);
      const label = methods.display ? methods.format(projected) : instance.displayName ? instance.displayName(projected) : "";
      return normalizeDisplayName(label, record, metadata);
    },
    createDefaults(): Input<InstanceType<C>> & RelationInput<InstanceType<C>> {
      return Object.fromEntries(Object.entries({...fields,...one2manyFields,...many2manyFields}).map(([name, field]) => [name, field.createDefault()])) as Input<InstanceType<C>> & RelationInput<InstanceType<C>>;
    },
    parse(input: unknown): Values<InstanceType<C>> {
      return schema.parse(input) as Values<InstanceType<C>>;
    },
    normalize(input: Record<string, unknown>): Values<InstanceType<C>> {
      // Unknown input keys must fail even if the normalizer would drop them.
      if (Object.keys(input).some(key => !Object.hasOwn(fields, key) && !Object.hasOwn(one2manyFields, key) && !Object.hasOwn(many2manyFields, key))) throw new Error("La normalización sólo acepta campos declarados.");
      const values = modelSnapshot(input);
      return formSchema.parse(instance.normalize ? instance.normalize(values) : values) as Values<InstanceType<C>>;
    },
    async prepareSave(values: Values<InstanceType<C>>, context: ModelContext<Values<InstanceType<C>>>) {
      return formSchema.parse(instance.beforeSave ? await instance.beforeSave(values, context) : values) as Values<InstanceType<C>>;
    },
    async constrain(values: Readonly<Record<string, unknown>>, context: ModelContext<Values<InstanceType<C>>>) { await methods.constrain(values,context); },
    async beforeSave(values: Values<InstanceType<C>>, context: ModelContext<Values<InstanceType<C>>>): Promise<Values<InstanceType<C>>> {
      const result=formSchema.parse(instance.beforeSave ? await instance.beforeSave(values, context) : values) as Values<InstanceType<C>>;
      await methods.constrain(result,context);
      return result;
    },
    async afterSave(record: Record<string, unknown>, context: ModelContext<Values<InstanceType<C>>>) { await instance.afterSave?.(record, context); },
    async beforeRemove(record: Readonly<Record<string, unknown>>, context: RemoveContext) { await instance.beforeRemove?.(modelSnapshot(record as Record<string, unknown>), Object.freeze({ ...context })); },
    /** Published business actions (name/label/groups). Only these names can be executed. */
    actions: actions.list,
    parseActionParams(name: string, input: unknown): Record<string, unknown> {
      const declared = actions.byName.get(name);
      if (!declared) throw new ModelValidationError("La acción no está publicada en este modelo.");
      return parseActionParameters(declared.parameters, input);
    },
    /** Run a published action; returns a validated patch of declared fields (possibly empty). */
    async runAction(name: string, record: Readonly<Record<string, unknown>>, context: ActionContext, params?: unknown): Promise<Record<string, unknown>> {
      const declared = actions.byName.get(name);
      if (!declared) throw new ModelValidationError("La acción no está publicada en este modelo.");
      const method = Reflect.get(instance, declared.method) as (...args: unknown[]) => unknown;
      const parsed = modelSnapshot(parseActionParameters(declared.parameters, params));
      const args = declared.parameters ? [modelSnapshot(record), parsed, Object.freeze({ ...context })] : [modelSnapshot(record), Object.freeze({ ...context })];
      const result = await method.apply(instance, args);
      if (result === undefined || result === null) return {};
      if (typeof result !== "object" || Array.isArray(result)) throw new Error(`${options.name}.${declared.method}: una acción devuelve un objeto con campos declarados o nada.`);
      const unknownKey = Object.keys(result).find(key => !Object.hasOwn(fields, key) && !Object.hasOwn(one2manyFields, key) && !Object.hasOwn(many2manyFields, key));
      if (unknownKey) throw new Error(`${options.name}.${declared.method}: «${unknownKey}» no es un campo declarado.`);
      return { ...(result as Record<string, unknown>) };
    },
  });
}

export type ModelAction = { readonly name: string; readonly label: string; readonly groups?: readonly string[]; readonly params?: ActionParameterMetadata };
/** Context of a business action: same transaction and authenticated actor as the save pipeline. */
export type ActionContext = { readonly tx: Prisma.TransactionClient; readonly actor: Readonly<ModelActor>; readonly action: string };
/** Saved record received by an action method: declared values plus identity and revision. */
export type ActionRecord<I> = Readonly<Values<I> & RelationInput<I> & { id: string; revision: string }>;
/** Patch an action may return: only declared fields. */
export type ActionPatch<I> = Partial<Values<I> & RelationInput<I>> | void;

const internalMethods = new Set(["normalize", "beforeSave", "afterSave", "beforeRemove", "displayName", "constructor"]);
function compileActions(model: string, instance: object, declarations: readonly ActionDeclaration[]) {
  const byName = new Map<string, { method: string; label: string; groups?: readonly string[]; parameters?: CompiledActionParameters }>();
  for (const declaration of declarations) {
    if (!/^[a-z][A-Za-z0-9]*$/.test(declaration.method) || internalMethods.has(declaration.method)) throw new Error(`${model}.${declaration.method}: nombre de acción inválido o reservado.`);
    if (typeof declaration.label !== "string" || !declaration.label.trim()) throw new Error(`${model}.${declaration.method}: la acción necesita label.`);
    if (declaration.groups !== undefined && (!Array.isArray(declaration.groups) || !declaration.groups.length || declaration.groups.some(group => typeof group !== "string" || !/^[a-z][a-z0-9-]*(?:.[a-z][a-z0-9-]*)?$/.test(group)))) throw new Error(`${model}.${declaration.method}: groups usa claves de grupo.`);
    if (typeof Reflect.get(instance, declaration.method) !== "function") throw new Error(`${model}.${declaration.method}: la acción debe ser un método.`);
    if (byName.has(declaration.method)) throw new Error(`${model}.${declaration.method}: acción duplicada.`);
    byName.set(declaration.method, { method: declaration.method, label: declaration.label, groups: declaration.groups, parameters: compileActionParameters(declaration.params) });
  }
  if (byName.size > 20) throw new Error(`${model}: máximo 20 acciones publicadas.`);
  const list: readonly ModelAction[] = Object.freeze([...byName.values()].map(({ method, label, groups, parameters }) => Object.freeze({ name: method, label, ...(groups ? { groups: Object.freeze([...groups]) } : {}), ...(parameters ? { params: parameters.metadata } : {}) })));
  return { list, byName };
}

/** Form values of a declaration, for typed custom views: `FieldText<FormValues<typeof Tarea>> name="name"`. Type-only; the class stays server-only. */
export type FormValues<C extends Constructor> = Input<InstanceType<C>> & RelationInput<InstanceType<C>> & { id?: string; revision?: string };

type ModelContract = { readonly schema: z.ZodType };
export type ModelInput<T extends ModelContract> = T extends { readonly formSchema: z.ZodType } ? z.input<T["formSchema"]> : z.input<T["schema"]>;
export type ModelValues<T extends ModelContract> = z.output<T["schema"]>;
