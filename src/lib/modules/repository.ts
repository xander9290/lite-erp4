import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import type { ModelRepository } from "../orm/repository";
import type { RelationAccess } from "../orm/relation-access";
import type { RecordAudit } from "../orm/audit";
import type { FieldMetadata } from "../orm/fields";
import { displayLookupSelect, type DisplayGuard } from "../orm/display";
import { relatedValues } from "../orm/related";
import { maskRelations, relationTargets, withRelationIds } from "../orm/relation-access";
import { many2manyStorage } from "../orm/many2many";
import { ModelValidationError } from "../orm/context";
import { lookupProjectionPlan } from "../orm/generator/display";
import { relatedProjectionPlan } from "../orm/generator/related";
import type { ModuleGeneration } from "../orm/generator/generate";
import type { ModuleModel } from "./define";
import { extensionWhere, storageProjection } from "./storage";
import { nextRevision } from "../orm/revision";

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

const datesSelect = { createdAt: true, updatedAt: true } as const;
const creatorSelect = { ...datesSelect, createBy: true, createByUser: { select: { id: true, login: true, partner: { select: { name: true, avatarUrl: true } } } } } as const;
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
/**
 * Options for native models (core) over hand-written tables. Server-only functions declared
 * by trusted framework code, never by a request.
 */
export type NativeRepositoryOptions = {
  /** Hash or otherwise transform a non-empty write-only secret before storing it. */
  readonly writeOnly?: Readonly<Record<string, (value: string) => Promise<string>>>;
  /** Columns maintained by the system (e.g. lastLogin): read, never written by the service. */
  readonly readOnly?: readonly string[];
  /** Extra columns for an update, computed in its transaction before writing (e.g. revoke sessions). */
  readonly beforeUpdate?: (tx: Prisma.TransactionClient, id: string, values: Readonly<Record<string, unknown>>) => Promise<Record<string, unknown>>;
};

export function createRepository<T extends Record<string, unknown>>(entry: ModuleModel, module: ModuleGeneration, models: readonly ModuleModel[] = [entry], options: { creator?: boolean } & NativeRepositoryOptions = {}): ModelRepository<T> {
  // Native tables (core: partners/users) are hand-written and have no creator column.
  const creator = options.creator !== false;
  const secrets = new Map(Object.entries(options.writeOnly ?? {}));
  const systemColumns = new Set(options.readOnly ?? []);
  for (const [name, field] of Object.entries(entry.contract.metadata as Readonly<Record<string, FieldMetadata>>)) {
    // A write-only secret without its transform would be stored as plain text: refuse to start.
    if (field.kind === "text" && field.writeOnly && !secrets.has(name)) throw new Error(`${entry.id}.${name}: un campo writeOnly necesita su transformación en el repositorio.`);
  }
  const auditSelect = creator ? creatorSelect : datesSelect;
  const many = Object.entries(entry.contract.many2manyFields).map(([field, descriptor]) => ({ field, maximum: descriptor.many2many.maxSelected, ...many2manyStorage(entry.contract, field) }));
  const metadata: Readonly<Record<string, FieldMetadata>> = entry.contract.metadata;
  // Fields of extensions live in companion tables owned by the extending modules (1:1 relation).
  // An inherited relation (Odoo _inherits, e.g. User → Partner) is a 1:1 row read and written the
  // same way, but its table has no creator column and the foreign key lives on this model.
  const companions = entry.extensions.filter(extension => extension.relation && extension.fields.length) as readonly { relation: string; fields: readonly string[]; inherits?: boolean }[];
  const storage = storageProjection(entry, models);
  const whereOf = (where: Record<string, unknown>) => extensionWhere(entry, where);
  const extended = new Set(companions.flatMap(companion => companion.fields));
  const names = Object.keys(metadata).filter(name => !extended.has(name));
  const generation = { model: entry.contract, clientFields: entry.clientFields };
  if (!module.models.some(model => model.model.name === entry.contract.name)) throw new Error(`${entry.id}: el modelo no pertenece al perfil del módulo.`);
  const select = Object.fromEntries([["id", true], ["updatedAt", true], ...names.filter(name => !secrets.has(name)).map(name => [name, true]),
    ...companions.map(companion => [companion.relation, { select: Object.fromEntries(companion.fields.map(name => [name, true])) }])]);
  const recordSelect = { ...select, ...Object.fromEntries(many.map(link => [link.source, { select: { targetId: true }, orderBy: { targetId: "asc" }, take: link.maximum + 1 }])) };
  const metadataOf = (model: string) => model === entry.contract.name ? metadata : module.models.find(candidate => candidate.model.name === model)?.model.metadata ?? {};
  const guardsOf = (policy: Record<string, readonly { model: string; field: string; target?: string }[]>): Guards =>
    Object.fromEntries(Object.entries(policy).map(([path, guards]) => [path, guards.map(guard => ({ metadata: metadataOf(guard.model)[guard.field], ...(guard.target ? { target: guard.target } : {}) }))]));
  const profile = { ...module, models: module.models.map(model => model.model.name === entry.contract.name ? generation : model) };
  const display = lookupProjectionPlan(profile, generation);
  const displayGuards = guardsOf(display.policy);
  const displayTargets = relationTargets(display.policy);
  const related = relatedProjectionPlan(profile, generation);
  const groupFields = new Set(["id", ...names.filter(name => metadata[name].kind !== "datetime" && !secrets.has(name)), ...(creator ? ["createBy"] : [])]);

  const dto = (record: Record<string, unknown>, defaults = true, includeMany = true) => {
    const row = record as Row;
    const result: Record<string, unknown> = { id: row.id, revision: row.updatedAt.toISOString() };
    const read = (name: string, value: unknown) => metadata[name].kind === "datetime" ? (value instanceof Date ? value.toISOString() : null) : value;
    // Secrets are never read back: the form receives them empty.
    for (const name of names) result[name] = secrets.has(name) ? null : read(name, row[name]);
    for (const link of includeMany ? many : []) {
      const rows = row[link.source] as { targetId: string }[];
      if (!Array.isArray(rows) || rows.length > link.maximum) throw new ModelValidationError("La relación supera el límite declarado. Revisa su configuración.");
      result[link.field] = rows.map(row => row.targetId);
    }
    for (const companion of companions) {
      const extension = row[companion.relation] as Record<string, unknown> | null | undefined;
      // Records saved before the extension was installed have no companion row: present defaults.
      for (const name of companion.fields) result[name] = extension ? read(name, extension[name]) : (defaults && metadata[name].defaultKind === "literal" ? metadata[name].defaultValue ?? null : null);
    }
    return result as T & { id: string; revision: string };
  };
  const write = (fields: readonly string[], values: T) => Object.fromEntries(fields.map(name => {
    const value = values[name];
    return [name, metadata[name].kind === "datetime" ? (value === null || value === undefined ? null : new Date(value as string)) : value];
  }));
  const data = async (values: T) => {
    const result = write(names.filter(name => !secrets.has(name) && !systemColumns.has(name)), values);
    // An empty secret keeps the stored one (update) and is rejected by the model when required (create).
    for (const [name, transform] of secrets) if (typeof values[name] === "string" && values[name]) result[name] = await transform(values[name] as string);
    return result;
  };
  // Nested writes keep base and companions in one statement, transaction and revision.
  const nested = (values: T, actorId?: string, revision?: Date) => ({ ...Object.fromEntries(many.map(link => [link.source, { ...(actorId ? {} : { deleteMany: {} }), create: (values[link.field] as string[]).map(targetId => ({ targetId })) }])), ...Object.fromEntries(companions.map(companion => {
    const fields = write(companion.fields, values);
    if (companion.inherits && revision) fields.updatedAt = revision;
    return [companion.relation, actorId ? { create: { ...fields, ...(companion.inherits ? {} : { createBy: actorId }) } } : { upsert: { create: fields, update: fields } }];
  })) });
  const relatedGroup = (field: string) => {
    const group = related.find(candidate => candidate.root === field);
    if (!group) throw new Error("Campo related no permitido.");
    // Guard 0 is the local root relation; projected paths start at the root target.
    return { group, delegate: lowerFirst(group.target), model: storage.target(group.target), guards: guardsOf(group.policy), targets: relationTargets(group.policy, 1) };
  };

  return {
    async read(tx, id) { const record = await delegateOf(tx, entry.delegate).findUnique({ where: { id }, select: recordSelect }); return record ? dto(record) : null; },
    async audit(tx, id) { const record = await delegateOf(tx, entry.delegate).findUnique({ where: { id }, select: auditSelect }); return record ? auditDto(record) : null; },
    async create(tx, values, actorId) { return dto(await delegateOf(tx, entry.delegate).create({ data: { ...await data(values), ...(creator ? { createBy: actorId } : {}), ...nested(values, actorId) }, select: recordSelect })); },
    async update(tx, id, revision, values) {
      const inherited = companions.filter(companion => companion.inherits);
      const related = inherited.length ? await delegateOf(tx, entry.delegate).findUnique({ where: { id }, select: Object.fromEntries(inherited.map(companion => [companion.relation, { select: { updatedAt: true } }])) }) : null;
      const updatedAt = nextRevision(new Date(revision), ...inherited.flatMap(companion => {
        const row = related?.[companion.relation] as { updatedAt: Date } | null | undefined;
        return row ? [row.updatedAt] : [];
      }));
      return dto(await delegateOf(tx, entry.delegate).update({ where: { id, updatedAt: new Date(revision) }, data: { ...await data(values), ...nested(values, undefined, updatedAt), ...(await options.beforeUpdate?.(tx, id, values) ?? {}), updatedAt }, select: recordSelect }));
    },
    async remove(tx, id, revision) { await delegateOf(tx, entry.delegate).delete({ where: { id, updatedAt: new Date(revision) }, select: { id: true } }); },
    count(tx, where) { return delegateOf(tx, entry.delegate).count({ where: whereOf(where) }); },
    ...(display.paths.length ? { lookupPaths: display.paths } : {}),
    async lookup(tx, query) {
      const projection = withRelationIds(displayLookupSelect(query.fields, displayGuards));
      const records = await delegateOf(tx, entry.delegate).findMany({ where: whereOf(query.where), select: storage.select(projection), orderBy: { id: "asc" }, skip: query.skip, take: query.take });
      const rows = records.map(row => storage.row(row));
      await maskRelations(rows, displayTargets, query.access);
      return rows;
    },
    ...(related.length ? {
      async related(tx: Prisma.TransactionClient, field: string, id: string, access?: RelationAccess) {
        const { group, delegate, model, guards, targets } = relatedGroup(field);
        // A related record the actor cannot read is presented empty, like an unset relation.
        if (access && !(await access(group.target, [id])).has(id)) return Object.fromEntries(Object.keys(group.outputs).map(name => [name, null]));
        const projection = withRelationIds(displayLookupSelect(Object.keys(group.policy), guards));
        const record = await delegateOf(tx, delegate).findUnique({ where: { id }, select: model ? storage.select(projection, model) : projection });
        if (!record) throw new ModelValidationError("El registro relacionado ya no está disponible.");
        const row = model ? storage.row(record, model) : record;
        await maskRelations([row], targets, access);
        return relatedValues(row, group.outputs);
      },
      async relatedMany(tx: Prisma.TransactionClient, field: string, ids: readonly string[], outputs: readonly string[], access?: RelationAccess) {
        if (!ids.length || ids.length > 100 || !outputs.length || outputs.length > 12) throw new Error("Lote related inválido.");
        const { group, delegate, model, guards, targets } = relatedGroup(field);
        if (outputs.some(name => !Object.hasOwn(group.outputs, name))) throw new Error("Salida related no permitida.");
        const selected = Object.fromEntries(Object.entries(group.outputs).filter(([name]) => outputs.includes(name)));
        const unique = [...new Set(ids)];
        // Unreadable roots are omitted: the collection presents their outputs empty.
        const readable = access ? [...await access(group.target, unique)] : unique;
        if (!readable.length) return {};
        const projection = { ...withRelationIds(displayLookupSelect([...new Set(Object.values(selected))], guards)), id: true };
        const records = await delegateOf(tx, delegate).findMany({ where: { id: { in: readable } }, select: model ? storage.select(projection, model) : projection });
        const rows = records.map(row => model ? storage.row(row, model) : row);
        await maskRelations(rows, targets, access);
        return Object.fromEntries(rows.map(row => [row.id as string, relatedValues(row, selected)]));
      },
    } : {}),
    async groups(tx, query) {
      const companion = entry.extensions.find(extension => extension.fields.includes(query.field));
      if (companion?.relation && companion.delegate) {
        const field = query.field;
        const where = whereOf(query.where);
        const delegate = delegateOf(tx, companion.delegate);
        // PostgreSQL sorts NULL last in ascending order. Page non-null groups in SQL,
        // then append one empty group (including records with no companion row).
        const presentWhere = { AND: [{ record: { is: where } }, ...(!metadata[field].required ? [{ [field]: { not: null } }] : [])] };
        const args = { by: [field], where: presentWhere, orderBy: { [field]: "asc" }, _count: { _all: true } };
        const rows = await delegate.groupBy({ ...args, skip: query.skip, take: query.take });
        const groups = rows.map(row => ({ value: row[field] as never, count: (row._count as { _all: number })._all }));
        if (groups.length < query.take && (groups.length || query.skip === 0 || (await delegate.groupBy({ ...args, skip: query.skip - 1, take: 1 })).length)) {
          const empty = await delegateOf(tx, entry.delegate).count({ where: { AND: [where, whereOf({ [field]: null })] } });
          if (empty) groups.push({ value: null as never, count: empty });
        }
        return groups;
      }
      if (!groupFields.has(query.field)) throw new Error("La columna de agrupación no está habilitada.");
      const rows = await delegateOf(tx, entry.delegate).groupBy({ by: [query.field], where: whereOf(query.where), orderBy: { [query.field]: "asc" }, skip: query.skip, take: query.take, _count: { _all: true } });
      return rows.map(row => ({ value: row[query.field] as never, count: (row._count as { _all: number })._all }));
    },
    async list(tx, query) {
      // Only the server service supplies these whitelisted scalar predicates and order.
      const companion = companions.find(companion => companion.fields.includes(query.sort));
      const order = companion ? { [companion.relation]: { [query.sort]: query.direction } } : query.sort === "createByUser.login" ? { createByUser: { login: query.direction } } : query.sort === "createByUser.partner.name" ? { createByUser: { partner: { name: query.direction } } } : { [query.sort]: query.direction };
      const args = { where: whereOf(query.where), orderBy: [order, ...(query.sort === "id" ? [] : [{ id: "asc" as const }])], skip: query.skip, take: query.take };
      if (query.audit) {
        const rows = await delegateOf(tx, entry.delegate).findMany({ ...args, select: { ...select, ...auditSelect } });
        return rows.map(record => {
          const user = record.createByUser as { id: string; login: string; partner: { name: string; avatarUrl: string | null } | null } | null;
          return { ...dto(record, false, false), createdAt: (record.createdAt as Date).toISOString(), updatedAt: (record.updatedAt as Date).toISOString(), createBy: (record.createBy as string | null | undefined) ?? null, createByUser: user ? { id: user.id, login: user.login, partner: user.partner ? { name: user.partner.name, avatarUrl: user.partner.avatarUrl } : null } : null };
        });
      }
      return (await delegateOf(tx, entry.delegate).findMany({ ...args, select })).map(row => dto(row, false, false));
    },
  } as ModelRepository<T>;
}
