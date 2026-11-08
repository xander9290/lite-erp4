import "server-only";
import { z } from "zod";
import { isField, type Field, type FieldMetadata } from "./fields";
import type { ModelContext } from "./context";

const modelTag = Symbol("orm.model");

/** Declaration base only: no implicit persistence, requests or database connections. */
export abstract class Model {
  declare protected readonly [modelTag]: true;
  beforeSave?(values: Record<string, unknown>, context: ModelContext): Record<string, unknown> | Promise<Record<string, unknown>>;
  afterSave?(record: Record<string, unknown>, context: ModelContext): void | Promise<void>;
}

type Constructor = new () => Model;
type DeclaredFields<I> = { [K in keyof I as I[K] extends Field ? K extends string ? K : never : never]: Extract<I[K], Field> };
type Shape<I> = { [K in keyof DeclaredFields<I>]: DeclaredFields<I>[K]["schema"] };
type Values<I> = { [K in keyof DeclaredFields<I>]: z.output<DeclaredFields<I>[K]["schema"]> };
type Input<I> = { [K in keyof DeclaredFields<I>]: z.input<DeclaredFields<I>[K]["schema"]> };
export type ModelOptions = { readonly name: string; readonly table: string };
const reservedFields = new Set(["id", "revision", "createdAt", "updatedAt", "constructor", "prototype"]);

export function defineModel<C extends Constructor>(Declaration: C, options: ModelOptions) {
  if (!options || typeof options.name !== "string" || typeof options.table !== "string" || !/^[A-Z][A-Za-z0-9]*$/.test(options.name) || !/^[a-z][a-z0-9_]*$/.test(options.table)) throw new Error("El modelo necesita un nombre PascalCase y una tabla snake_case válidos.");
  const instance = new Declaration();
  if (!(instance instanceof Model)) throw new Error("La declaración debe extender Model.");
  const fields: Record<string, Field> = {};
  const metadata: Record<string, FieldMetadata> = {};
  const shape: Record<string, z.ZodType> = {};
  for (const [name, value] of Object.entries(instance)) {
    if (typeof value === "function") continue;
    if (!isField(value)) throw new Error(`${options.name}.${name}: declara el dato mediante Fields.`);
    if (!/^[a-z][A-Za-z0-9]*$/.test(name) || reservedFields.has(name)) throw new Error(`Nombre de campo inválido o reservado: ${name}.`);
    fields[name] = value;
    metadata[name] = value.metadata;
    shape[name] = value.schema;
  }
  if (!Object.keys(fields).length) throw new Error("El modelo debe declarar al menos un Field.");
  // Runtime collection filters precisely the descriptor keys represented by Shape.
  const schema = z.strictObject(shape as Shape<InstanceType<C>>);
  return Object.freeze({
    name: options.name, table: options.table,
    fields: Object.freeze(fields) as Readonly<DeclaredFields<InstanceType<C>>>,
    metadata: Object.freeze(metadata) as Readonly<{ [K in keyof DeclaredFields<InstanceType<C>>]: FieldMetadata }>,
    schema,
    createDefaults(): Input<InstanceType<C>> {
      return Object.fromEntries(Object.entries(fields).map(([name, field]) => [name, field.createDefault()])) as Input<InstanceType<C>>;
    },
    parse(input: unknown): Values<InstanceType<C>> {
      return schema.parse(input) as Values<InstanceType<C>>;
    },
    async beforeSave(values: Values<InstanceType<C>>, context: ModelContext): Promise<Values<InstanceType<C>>> {
      return schema.parse(instance.beforeSave ? await instance.beforeSave(values, context) : values) as Values<InstanceType<C>>;
    },
    async afterSave(record: Record<string, unknown>, context: ModelContext) { await instance.afterSave?.(record, context); },
  });
}

type ModelContract = { readonly schema: z.ZodType };
export type ModelInput<T extends ModelContract> = z.input<T["schema"]>;
export type ModelValues<T extends ModelContract> = z.output<T["schema"]>;
