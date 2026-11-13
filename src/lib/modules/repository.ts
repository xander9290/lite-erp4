import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import type { ModelRepository } from "../orm/repository";
import type { RecordAudit } from "../orm/audit";
import type { FieldMetadata } from "../orm/fields";
import { displayLookupSelect, type DisplayGuard } from "../orm/display";
import { relatedValues } from "../orm/related";
import { ModelValidationError } from "../orm/context";
import { lookupProjectionPlan } from "../orm/generator/display";
import { relatedProjectionPlan } from "../orm/generator/related";
import type { ModuleGeneration } from "../orm/generator/generate";
import type { ModuleModel } from "./define";

type Row = Record<string, unknown> & { id: string; updatedAt: Date };
/** Minimal delegate surface. The delegate name comes from the trusted module registry, never from a request. */
type Delegate = {
  findUnique(args: unknown): Promise<Record<string, unknown> | null>;
  findMany(args: unknown): Promise<Record<string, unknown>[]>;
  create(args: unknown): Promise<Record<string, unknown>>;
  update(args: unknown): Promise<Record<string, unknown>>;
  delete(args: unknown): Promise<unknown>;
  count(args: unknown): Promise<number>;
  groupBy(args: unknown): Promise<Record<string, unknown>[]>;
};
type Guards = Readonly<Record<string, readonly DisplayGuard[]>>;

const auditSelect = { createdAt: true, updatedAt: true, createBy: true, createByUser: { select: { id: true, login: true, partner: { select: { name: true, avatarUrl: true } } } } } as const;
const lowerFirst = (value: string) => value[0].toLowerCase() + value.slice(1);

function delegateOf(tx: Prisma.TransactionClient, name: string): Delegate {
  const delegate = (tx as unknown as Record<string, Delegate | undefined>)[name];
  // Declarative modules have no binding step: a missing delegate means a stale Prisma client.
  if (!delegate || typeof delegate.findMany !== "function") throw new ModelValidationError("El acceso a datos de este módulo no está cargado. Ejecuta orm:sync y reinicia el servidor de desarrollo.");
  return delegate;
}

function auditDto(record: Record<string, unknown>): RecordAudit {
  const user = record.createByUser as { id: string; login: string; partner: { name: string; avatarUrl: string | null } | null } | null;
  return { createdAt: (record.createdAt as Date).toISOString(), updatedAt: (record.updatedAt as Date).toISOString(), createBy: user ? { id: user.id, login: user.login, name: user.partner?.name || user.login, avatarUrl: user.partner?.avatarUrl ?? null } : null };
}

/**
 * Runtime equivalent of the `orm:bind` adapter, built from declared metadata. Same semantics:
 * revision = updatedAt, monotonic advance, createBy only on create, whitelisted projections.
 */
export function createRepository<T extends Record<string, unknown>>(entry: ModuleModel, module: ModuleGeneration): ModelRepository<T> {
  const metadata: Readonly<Record<string, FieldMetadata>> = entry.contract.metadata;
  const names = Object.keys(metadata);
  const generation = module.models.find(model => model.model.name === entry.contract.name);
  if (!generation) throw new Error(`${entry.id}: el modelo no pertenece al perfil del módulo.`);
  const select = Object.fromEntries([["id", true], ["updatedAt", true], ...names.map(name => [name, true])]);
  const metadataOf = (model: string) => module.models.find(candidate => candidate.model.name === model)?.model.metadata ?? {};
  const guardsOf = (policy: Record<string, readonly { model: string; field: string; target?: string }[]>): Guards =>
    Object.fromEntries(Object.entries(policy).map(([path, guards]) => [path, guards.map(guard => ({ metadata: metadataOf(guard.model)[guard.field], ...(guard.target ? { target: guard.target } : {}) }))]));
  const display = lookupProjectionPlan(module, generation);
  const displayGuards = guardsOf(display.policy);
  const related = relatedProjectionPlan(module, generation);
  const groupFields = new Set(["id", ...names.filter(name => metadata[name].kind !== "datetime"), "createBy"]);

  const dto = (record: Record<string, unknown>) => {
    const row = record as Row;
    const result: Record<string, unknown> = { id: row.id, revision: row.updatedAt.toISOString() };
    for (const name of names) {
      const value = row[name];
      result[name] = metadata[name].kind === "datetime" ? (value instanceof Date ? value.toISOString() : null) : value;
    }
    return result as T & { id: string; revision: string };
  };
  const data = (values: T) => Object.fromEntries(names.map(name => {
    const value = values[name];
    return [name, metadata[name].kind === "datetime" ? (value === null || value === undefined ? null : new Date(value as string)) : value];
  }));
  const relatedGroup = (field: string) => {
    const group = related.find(candidate => candidate.root === field);
    if (!group) throw new Error("Campo related no permitido.");
    return { group, delegate: lowerFirst(group.target), guards: guardsOf(group.policy) };
  };

  return {
    async read(tx, id) { const record = await delegateOf(tx, entry.delegate).findUnique({ where: { id }, select }); return record ? dto(record) : null; },
    async audit(tx, id) { const record = await delegateOf(tx, entry.delegate).findUnique({ where: { id }, select: auditSelect }); return record ? auditDto(record) : null; },
    async create(tx, values, actorId) { return dto(await delegateOf(tx, entry.delegate).create({ data: { ...data(values), createBy: actorId }, select })); },
    async update(tx, id, revision, values) {
      const updatedAt = new Date(Math.max(Date.now(), Date.parse(revision) + 1));
      return dto(await delegateOf(tx, entry.delegate).update({ where: { id, updatedAt: new Date(revision) }, data: { ...data(values), updatedAt }, select }));
    },
    async remove(tx, id, revision) { await delegateOf(tx, entry.delegate).delete({ where: { id, updatedAt: new Date(revision) }, select: { id: true } }); },
    count(tx, where) { return delegateOf(tx, entry.delegate).count({ where }); },
    ...(display.paths.length ? { lookupPaths: display.paths } : {}),
    async lookup(tx, query) {
      const projection = displayLookupSelect(query.fields, displayGuards);
      return delegateOf(tx, entry.delegate).findMany({ where: query.where, select: projection, orderBy: { id: "asc" }, skip: query.skip, take: query.take });
    },
    ...(related.length ? {
      async related(tx: Prisma.TransactionClient, field: string, id: string) {
        const { group, delegate, guards } = relatedGroup(field);
        const row = await delegateOf(tx, delegate).findUnique({ where: { id }, select: displayLookupSelect(Object.keys(group.policy), guards) });
        if (!row) throw new ModelValidationError("El registro relacionado ya no está disponible.");
        return relatedValues(row, group.outputs);
      },
      async relatedMany(tx: Prisma.TransactionClient, field: string, ids: readonly string[], outputs: readonly string[]) {
        if (!ids.length || ids.length > 100 || !outputs.length || outputs.length > 12) throw new Error("Lote related inválido.");
        const { group, delegate, guards } = relatedGroup(field);
        if (outputs.some(name => !Object.hasOwn(group.outputs, name))) throw new Error("Salida related no permitida.");
        const selected = Object.fromEntries(Object.entries(group.outputs).filter(([name]) => outputs.includes(name)));
        const rows = await delegateOf(tx, delegate).findMany({ where: { id: { in: [...new Set(ids)] } }, select: { ...displayLookupSelect([...new Set(Object.values(selected))], guards), id: true } });
        return Object.fromEntries(rows.map(row => [row.id as string, relatedValues(row, selected)]));
      },
    } : {}),
    async groups(tx, query) {
      if (!groupFields.has(query.field)) throw new Error("La columna de agrupación no está habilitada.");
      const rows = await delegateOf(tx, entry.delegate).groupBy({ by: [query.field], where: query.where, orderBy: { [query.field]: "asc" }, skip: query.skip, take: query.take, _count: { _all: true } });
      return rows.map(row => ({ value: row[query.field] as never, count: (row._count as { _all: number })._all }));
    },
    async list(tx, query) {
      // Only the server service supplies these whitelisted scalar predicates and order.
      const order = query.sort === "createByUser.login" ? { createByUser: { login: query.direction } } : query.sort === "createByUser.partner.name" ? { createByUser: { partner: { name: query.direction } } } : { [query.sort]: query.direction };
      const args = { where: query.where, orderBy: [order, ...(query.sort === "id" ? [] : [{ id: "asc" as const }])], skip: query.skip, take: query.take };
      if (query.audit) {
        const rows = await delegateOf(tx, entry.delegate).findMany({ ...args, select: { ...select, ...auditSelect } });
        return rows.map(record => {
          const user = record.createByUser as { id: string; login: string; partner: { name: string; avatarUrl: string | null } | null } | null;
          return { ...dto(record), createdAt: (record.createdAt as Date).toISOString(), updatedAt: (record.updatedAt as Date).toISOString(), createBy: record.createBy as string | null, createByUser: user ? { id: user.id, login: user.login, partner: user.partner ? { name: user.partner.name, avatarUrl: user.partner.avatarUrl } : null } : null };
        });
      }
      return (await delegateOf(tx, entry.delegate).findMany({ ...args, select })).map(dto);
    },
  } as ModelRepository<T>;
}
