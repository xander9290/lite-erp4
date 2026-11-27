/**
 * `context.env`: access from model methods to other registered models, inside the transaction
 * and with the authenticated actor of the running operation. Every call goes through the
 * target's service (group access, record rules, field policies, normalize, Zod, hooks,
 * constraints, history); it is never a Prisma delegate, never lazy and never elevated.
 * Phase 1 reads; phase 2 writes through the services, with nested-write guards.
 */
import type { DomainBuilder, DomainExpression } from "./domain-builder";
import { ModelValidationError } from "./context";

/**
 * Augmented by the generated `src/generated/orm/actions/<module>/environment.ts` files:
 * `DirectoryPartner: { name: string; vat: string | null; ... }`.
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface ModelEnvironmentRegistry {}

type FieldName<T> = Extract<keyof T, string>;
export type EnvironmentRecord<T, F extends FieldName<T>> = Readonly<Pick<T, F> & { id: string }>;
/** Same builder as manifest/relation domains, without draft or record references. */
export type EnvironmentDomain<T> = (d: DomainBuilder<FieldName<T> | "id">) => DomainExpression<FieldName<T> | "id">;
export type EnvironmentSearchOptions<T, F extends FieldName<T>> = {
  /** Persistent public fields to project (1–30). `id` is always included. */
  readonly fields: readonly F[];
  /** Default 100, maximum 500. */
  readonly limit?: number;
  readonly offset?: number;
  readonly order?: FieldName<T> | "id";
  readonly direction?: "asc" | "desc";
};
/** Persistent public scalar fields; the target's normalize/Zod/hooks validate them. */
export type EnvironmentValues<T> = Partial<T>;
/** Saved record: its ID plus the persistent public fields the actor may read. */
export type EnvironmentSaved<T> = Readonly<Partial<T> & { id: string }>;

export interface ReadOnlyModelEnvironmentModel<T = Record<string, unknown>> {
  /** Records matching `domain` (null = all readable ones), in a bounded page. */
  search<F extends FieldName<T>>(domain: EnvironmentDomain<T> | null, options: EnvironmentSearchOptions<T, F>): Promise<readonly EnvironmentRecord<T, F>[]>;
  /** One record, or null when it does not exist or is not readable for the actor. */
  read<F extends FieldName<T>>(id: string, fields: readonly F[]): Promise<EnvironmentRecord<T, F> | null>;
  /** Batch read (up to 500 IDs) in the requested order; missing/unreadable IDs are omitted. */
  readMany<F extends FieldName<T>>(ids: readonly string[], fields: readonly F[]): Promise<readonly EnvironmentRecord<T, F>[]>;
  count(domain?: EnvironmentDomain<T> | null): Promise<number>;
}

export interface ModelEnvironmentModel<T = Record<string, unknown>> extends ReadOnlyModelEnvironmentModel<T> {
  /** Create with the model defaults plus `values` (create access, hooks, history). */
  create(values: EnvironmentValues<T>): Promise<EnvironmentSaved<T>>;
  /** Partial update of a readable/writable record; its current revision is read in this transaction. */
  write(id: string, values: EnvironmentValues<T>): Promise<EnvironmentSaved<T>>;
  /** Delete one record (unlink access, beforeRemove, Restrict relations still apply). */
  unlink(id: string): Promise<void>;
}

export type ModelEnvironment = { readonly [K in keyof ModelEnvironmentRegistry]: ModelEnvironmentModel<ModelEnvironmentRegistry[K]> };
/** Reactions, computed fields and constraints: queries only, never writes. */
export type ReadOnlyModelEnvironment = { readonly [K in keyof ModelEnvironmentRegistry]: ReadOnlyModelEnvironmentModel<ModelEnvironmentRegistry[K]> };

/** Contexts built outside a registered module (tests, samples) get an explicit error on use. */
export const unavailableEnvironment: ModelEnvironment = new Proxy({}, {
  get(_target, key) {
    if (typeof key !== "string" || key === "then") return undefined;
    throw new Error(`env.${key}: el entorno de modelos sólo está disponible en módulos registrados.`);
  },
}) as ModelEnvironment;

/** Same models, without create/write/unlink: a write attempt fails with a clear message. */
export function readOnlyEnvironment(env: ModelEnvironment): ReadOnlyModelEnvironment {
  const blocked = (key: string, operation: string) => () => Promise.reject(new ModelValidationError(`env.${key}.${operation}: este contexto sólo puede consultar (reacciones, cálculos y restricciones). Escribe desde hooks o acciones.`));
  return new Proxy({}, {
    get(_target, key) {
      if (typeof key !== "string" || key === "then") return undefined;
      const model = (env as unknown as Record<string, ModelEnvironmentModel>)[key];
      return Object.freeze({
        search: model.search.bind(model), read: model.read.bind(model), readMany: model.readMany.bind(model), count: model.count.bind(model),
        create: blocked(key, "create"), write: blocked(key, "write"), unlink: blocked(key, "unlink"),
      });
    },
    has: (_target, key) => key in env,
    ownKeys: () => Reflect.ownKeys(env),
    getOwnPropertyDescriptor: (_target, key) => Reflect.getOwnPropertyDescriptor(env, key),
    set: () => false, defineProperty: () => false, deleteProperty: () => false,
  }) as ReadOnlyModelEnvironment;
}

/** Nested env writes allowed inside one operation (A writes B, whose hook writes C). */
export const MAX_ENVIRONMENT_WRITE_DEPTH = 3;

/**
 * Per-transaction guard. `frames` are the records a service is saving, running an action on or
 * removing; while an env write is in progress (depth > 0) none of them may be persisted or
 * removed again, so an outer operation never continues with a stale revision.
 */
type WriteGuard = { depth: number; frames: { model: string; id?: string }[] };
const guards = new WeakMap<object, WriteGuard>();
export function writeGuard(tx: object): WriteGuard {
  let guard = guards.get(tx);
  if (!guard) guards.set(tx, guard = { depth: 0, frames: [] });
  return guard;
}

export function busyRecordError(model: string) {
  return new ModelValidationError(`env.${model}: no se puede modificar ni eliminar un registro que esta misma operación está guardando, ejecutando o eliminando (ni sus líneas). Devuelve el cambio desde el hook o la acción en lugar de escribirlo con env.`);
}

/** Run an env write one level deeper; rejects re-entrant writes beyond the limit. */
export async function nestedWrite<R>(tx: object, model: string, operation: () => Promise<R>): Promise<R> {
  const guard = writeGuard(tx);
  if (guard.depth >= MAX_ENVIRONMENT_WRITE_DEPTH) throw new ModelValidationError(`env.${model}: se superó el máximo de ${MAX_ENVIRONMENT_WRITE_DEPTH} escrituras anidadas. Revisa hooks que se llaman entre sí.`);
  guard.depth++;
  try { return await operation(); }
  finally { guard.depth--; }
}

/** Mark a record as in progress for the duration of `operation` (save, action, removal). */
export async function withFrame<R>(tx: object, frame: { model: string; id?: string }, operation: () => Promise<R>): Promise<R> {
  const guard = writeGuard(tx);
  if (guard.depth > 0 && frame.id && guard.frames.some(item => item.model === frame.model && item.id === frame.id)) throw busyRecordError(frame.model);
  guard.frames.push(frame);
  try { return await operation(); }
  finally { guard.frames.splice(guard.frames.lastIndexOf(frame), 1); }
}
