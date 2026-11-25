import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";
import { registeredModules } from "./installed";
import { AccessError } from "../auth/policy";
import type { ModelActor } from "../orm/context";
import { prisma } from "../prisma";
import { createModelService } from "../orm/service";
import { authorizeModel, userGroups, withRelationRead, readActorElementPolicies } from "../access/engine";
import { projectElementAccess } from "./element-access";
import { emptyElementPolicies, hasPrivateFields } from "../access/element-policy";
import { allowsActionGroups, type CapabilityActor } from "../access/capabilities";
import { projectModelAccess } from "./access";
import { createModelImageSigner } from "../uploads/model-image.server";
import { modelLookupSchema, type Many2OneLoader } from "../many2one/model-lookup";
import type { Many2OneOption, Many2OneResult } from "../many2one/types";
import type { FieldMetadata } from "../orm/fields";
import type { ModelAction } from "../orm/model";
import { createRepository } from "./repository";
import { modelIdPattern, type ModelClientConfig, type ModelLineConfig } from "./config";
import type { InsertionViewKind, ModuleDefinition, ModuleModel } from "./define";
import { relationDomains, relationDomainWhere } from "./relation-domains";
import { domainDependencies, domainUsesRecordId } from "../orm/domain-builder";
import { ModelValidationError } from "../orm/context";
import { z } from "zod";
import { transferCollections, transferHeaders } from "../list/transfer-contract";

const modules = registeredModules;

const byModule = new Map<string, ModuleDefinition>();
const byModel = new Map<string, { module: ModuleDefinition; entry: ModuleModel }>();
const byPrismaName = new Map<string, ModuleModel>();
for (const definition of modules) {
  if (byModule.has(definition.id)) throw new Error(`Módulo duplicado: ${definition.id}`);
  byModule.set(definition.id, definition);
  for (const entry of definition.models) {
    byModel.set(entry.id, { module: definition, entry });
    byPrismaName.set(entry.contract.name, entry);
  }
}

/** Installed declarative modules. Icons are attached by the application registry (React-only code). */
export function installedModules(): readonly ModuleDefinition[] { return modules; }
export function getModule(id: string) { return byModule.get(id); }

/** Resolve only registered ids; any other value is rejected before touching services or Prisma. */
export function getModuleModel(id: unknown) {
  if (typeof id !== "string" || !modelIdPattern.test(id)) return undefined;
  return byModel.get(id);
}

type Service = ReturnType<typeof createModelService<Record<string, unknown>>>;

/**
 * «Creado por» of a model: accounts that created records the actor may read in it, searched by
 * contact name. Publishes only the user id and the contact name — never login, roles or any
 * other account field — so readers of the model can label, filter and group by creator without
 * read access to core.user. Native models have no creator column.
 */
export async function creatorLookup(id: string, actor: ModelActor, input: unknown): Promise<Many2OneResult> {
  const found = getModuleModel(id);
  if (!found || found.module.native) throw new Error("MODEL_NOT_FOUND");
  const parsed = modelLookupSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "La búsqueda no es válida." };
  const request = parsed.data;
  return prisma.$transaction(async tx => {
    const scope = await authorizeModel(tx, actor, found.entry.id, "read");
    const policy = projectElementAccess(found.entry, await readActorElementPolicies(tx, actor), modules.flatMap(module => module.models));
    if (!policy.canRead(["createByUser.name"])) throw new AccessError("DENIED");
    const inverse = `${found.entry.contract.name[0].toLowerCase()}${found.entry.contract.name.slice(1)}CreatedRecords`;
    const ids = request.id ? [request.id] : request.ids;
    const where = {
      [inverse]: { some: scope ?? {} },
      ...(ids ? { id: { in: ids } } : request.query.trim() ? { name: { contains: request.query.trim(), mode: "insensitive" as const } } : {}),
    };
    const [total, rows] = await Promise.all([
      tx.user.count({ where }),
      tx.user.findMany({ where, select: { id: true, name: true, login: true }, orderBy: [{ name: "asc" }, { id: "asc" }], skip: ids ? 0 : (request.page - 1) * request.pageSize, take: ids ? ids.length : request.pageSize }),
    ]);
    return { ok: true as const, items: rows.map(row => ({ value: row.id, label: row.name || row.login, record: { id: row.id } })), total, page: ids ? 1 : request.page, pageSize: ids ? ids.length : request.pageSize };
  }, { isolationLevel: "RepeatableRead" });
}
const services = new Map<string, Service>();
const operationActor = new AsyncLocalStorage<ModelActor>();

/** Run a service operation with its authenticated actor available to nested label lookups. */
export function withActor<T>(actor: ModelActor, operation: () => Promise<T>) {
  return operationActor.run(actor, operation);
}

/** The browser names a published owner field, never a target, predicate or dependency list. */
/** Result of creating a related record from a Many2many selector. */
export type QuickCreateResult = { ok: true; item: Many2OneOption; created: boolean } | { ok: false; error: string };

/**
 * «Crear "texto"» of a Many2many declared with `create: true`. The browser only names the
 * owner model and field: the target comes from the declaration. An existing readable record
 * with the same name (case-insensitive) is reused; otherwise the target service creates it
 * with only `name` (its permissions, normalize, hooks, defaults, audit and history apply).
 * It is an independent write: it stays even if the owner record is never saved.
 */
export async function relationQuickCreate(model: string, field: string, actor: ModelActor, input: unknown): Promise<QuickCreateResult> {
  const found = getModuleModel(model);
  const descriptor = found && Object.hasOwn(found.entry.contract.many2manyFields, field) ? found.entry.contract.many2manyFields[field] : undefined;
  if (!found || !descriptor?.many2many.create) throw new Error("Relación no publicada.");
  await prisma.$transaction(async tx => {
    await authorizeModel(tx, actor, model, "read");
    const access = projectElementAccess(found.entry, await readActorElementPolicies(tx, actor), modules.flatMap(module => module.models));
    if (!access.canRead([field]) || access.fields[field]?.noWrite) throw new AccessError("DENIED");
  });
  const target = byPrismaName.get(descriptor.many2many.target);
  if (!target) throw new Error("Relación no publicada.");
  const name = typeof input === "string" ? input.trim().replace(/\s+/g, " ") : "";
  const maxLength = target.metadata.name?.kind === "text" ? target.metadata.name.maxLength ?? 120 : 120;
  if (!name || name.length > Math.min(120, maxLength)) return { ok: false, error: `Escribe un nombre de 1 a ${Math.min(120, maxLength)} caracteres.` };
  const service = modelService(target.id);
  const same = (label: string) => label.trim().replace(/\s+/g, " ").toLocaleLowerCase("es-MX") === name.toLocaleLowerCase("es-MX");
  const existing = await withActor(actor, () => service.lookup(prisma, actor, { query: name, pageSize: 25 }));
  if (existing.ok) { const match = existing.items.find(item => same(item.label)); if (match) return { ok: true, item: match, created: false }; }
  const saved = await service.save(prisma, actor, { ...target.contract.createDefaults(), name });
  if (!saved.ok) return { ok: false, error: "fieldErrors" in saved && saved.fieldErrors?.name ? String(saved.fieldErrors.name) : saved.error };
  const created = await withActor(actor, () => service.lookup(prisma, actor, { ids: [saved.values.id as string] }));
  if (!created.ok || created.items.length !== 1) return { ok: false, error: "Se creó el registro, pero no se pudo leer. Búscalo de nuevo." };
  return { ok: true, item: created.items[0], created: true };
}

export async function relationLookup(model: string, field: string, actor: ModelActor, input: unknown): Promise<Many2OneResult> {
  const found = getModuleModel(model);
  if (!found || !Object.hasOwn(lookupTargets(found.entry), field)) throw new Error("Relación no publicada.");
  const relation = relationDomains(found.entry).find(relation => relation.field === field);
  const envelope = z.strictObject({ request: modelLookupSchema, draft: z.record(z.string(), z.unknown()), record: z.strictObject({ id: z.string().trim().min(1).max(100).optional() }).optional(), filter: z.boolean().default(false) }).parse(input);
  if (envelope.filter && !found.entry.list.fields.includes(field)) throw new Error("Filtro no publicado.");
  const usesRecord = Boolean(relation && !envelope.filter && domainUsesRecordId(relation.domain));
  if (envelope.record && !usesRecord) throw new Error("La relación no utiliza identidad de registro.");
  const target = getModuleModel(lookupTargets(found.entry)[field])!.entry;
  const where = relation && !envelope.filter ? relationDomainWhere(found.entry, target, relation.domain, envelope.draft, envelope.record) : undefined;
  return prisma.$transaction(async tx => {
    // Resolve the source before entering the target's relational read scope.
    if (envelope.record?.id) {
      const source = await modelService(found.entry.id).lookupInTransaction(tx, actor, { id: envelope.record.id });
      if (source.total !== 1) throw new ModelValidationError("El registro actual no está disponible.");
    }
    return withRelationRead(tx, actor, found.entry.id, target.id, async () => {
      const policy = projectElementAccess(found.entry, await readActorElementPolicies(tx, actor), modules.flatMap(module => module.models));
      if (!policy.canRead([field, ...(relation && !envelope.filter ? domainDependencies(relation.domain) : [])])) throw new AccessError("DENIED");
      const service = modelService(target.id);
      const candidates = await service.lookupInTransaction(tx, actor, envelope.request, where);
      if (!envelope.request.id && !envelope.request.ids) return candidates;
      // Resolving saved selections preserves readable labels even when the domain changed.
      const selections = await service.lookupInTransaction(tx, actor, envelope.request);
      const matches = new Set(candidates.items.map(item => item.value));
      return { ...selections, items: selections.items.map(item => ({ ...item, domainValid: matches.has(item.value) })) };
    });
  }, { isolationLevel: "RepeatableRead" });
}

/** Parameter targets are fixed by the published action, never by a client target id. */
export async function parameterLookup(model: string, actionName: string, parameter: string, actor: ModelActor, input: unknown): Promise<Many2OneResult> {
  const found = getModuleModel(model);
  const action = found?.entry.contract.actions?.find(action => action.name === actionName);
  const field = action?.params && Object.hasOwn(action.params, parameter) ? action.params[parameter] : undefined;
  const target = field?.kind === "many2one" ? byPrismaName.get(field.target) : undefined;
  if (!found || !action || !target) throw new AccessError("DENIED");
  return prisma.$transaction(tx => withRelationRead(tx, actor, model, target.id, async () => {
    await authorizeModel(tx, actor, model, "write");
    const access = projectElementAccess(found.entry, await readActorElementPolicies(tx, actor), modules.flatMap(module => module.models));
    if (access.blockedActions.includes(actionName) || access.privateDocument || hasPrivateFields(access.fields)) throw new AccessError("DENIED");
    const user = await tx.user.findUnique({ where: { id: actor.id }, select: { isAdmin: true } });
    if (!user?.isAdmin && !allowsActionGroups({ isAdmin: false, groups: await userGroups(tx, actor.id) }, found.module.id, action.groups)) throw new AccessError("DENIED");
    return modelService(target.id).lookupInTransaction(tx, actor, input);
  }), { isolationLevel: "RepeatableRead" });
}

export function modelService(id: string): Service {
  const cached = services.get(id);
  if (cached) return cached;
  const found = getModuleModel(id);
  if (!found) throw new Error("MODEL_NOT_FOUND");
  const { module, entry } = found;
  const relations: Record<string, Many2OneLoader> = {};
  for (const [field, target] of Object.entries(lookupTargets(entry))) {
    // Labels reuse the actor of the current list operation; the lookup revalidates it in its own transaction.
    // Many2many columns (tags) also resolve their names per page.
    if (entry.list.fields.includes(field) || Object.hasOwn(entry.contract.many2manyFields, field)) relations[field] = async request => {
      const actor = operationActor.getStore();
      if (!actor) throw new AccessError("UNAUTHENTICATED");
      return prisma.$transaction(tx => withRelationRead(tx, actor, entry.id, target, () => modelService(target).lookupInTransaction(tx, actor, request)), { isolationLevel: "RepeatableRead" });
    };
  }
  if (!module.native && entry.list.fields.includes("createBy")) relations.createBy = async request => {
    const actor = operationActor.getStore();
    if (!actor) throw new AccessError("UNAUTHENTICATED");
    return creatorLookup(entry.id, actor, request);
  };
  // Runtime projection uses composed contracts across installed modules; generation still
  // uses each owner's uncomposed profile so extension columns stay in companion tables.
  const runtimeModels = modules.flatMap(definition => definition.models);
  const runtimeProfile = { ...module.profile.module, models: runtimeModels.map(model => ({ model: model.contract, clientFields: model.clientFields })) };
  const service = createModelService(entry.contract, createRepository(entry, runtimeProfile, runtimeModels, { creator: !module.native, ...(module.native ? entry.declaration.repository : {}) }), {
    lines: Object.fromEntries(Object.entries(entry.contract.one2manyFields).map(([name, field]) => {
      const child = module.models.find(model => model.contract.name === field.one2many.target)!;
      return [name, { metadata: field.one2many, child: () => modelService(child.id).transaction }];
    })),
    owners: module.models.flatMap(parent => Object.values(parent.contract.one2manyFields).filter(field => field.one2many.target === entry.contract.name).map(field => ({ inverse: field.one2many.inverse, parent: () => modelService(parent.id).transaction }))),
    list: entry.list, audit: true, defaultSort: entry.defaultSort, domain: entry.screens[entry.defaultScreen].domain,
    elementAccess: async (tx, actor) => projectElementAccess(entry, await readActorElementPolicies(tx, actor), runtimeModels),
    validateRelations: async (tx, actor, values, record) => {
      for (const [field, targetId] of Object.entries(lookupTargets(entry))) {
        const relation = relationDomains(entry).find(relation => relation.field === field);
        const selected = Object.hasOwn(entry.contract.many2manyFields, field) ? (values[field] as string[] | undefined) ?? [] : values[field] ? [String(values[field])] : [];
        if (!selected.length) continue;
        const target = getModuleModel(targetId)!.entry;
        const draft = Object.fromEntries((relation ? domainDependencies(relation.domain) : []).map(name => [name, values[name]]));
        const where = relation ? relationDomainWhere(entry, target, relation.domain, draft, record) : undefined;
        const result = await withRelationRead(tx, actor, entry.id, target.id, () => modelService(target.id).lookupInTransaction(tx, actor, { ids: selected }, where));
        if (result.total !== selected.length) throw new ModelValidationError("Revisa las relaciones seleccionadas.", { [field]: "La selección no cumple el dominio vigente o no está disponible." });
      }
    },
    collectionNullable: entry.extensions.flatMap(extension => extension.fields),
    // Group access and record rules, revalidated inside each service transaction.
    authorize: (tx, actor, operation) => authorizeModel(tx, actor, entry.id, operation),
    activityLabels: async (tx, actor, target, ids) => {
      const related = byPrismaName.get(target);
      // Unregistered/manual targets have no declarative read contract. Do not query them.
      if (!related) return new Map<string, string>();
      try {
        const result = await withRelationRead(tx, actor, entry.id, related.id, () => modelService(related.id).lookupInTransaction(tx, actor, { ids }));
        return new Map(result.items.map(item => [item.value, item.label]));
      } catch (error) {
        if (error instanceof AccessError && error.code === "DENIED") return new Map<string, string>();
        throw error;
      }
    },
    // Related records shown through displayName/related paths obey the target's read access and rules.
    relationAccess: (tx, actor) => async (target, ids) => {
      const related = byPrismaName.get(target);
      // Infrastructure/manual models (User) carry no module record rules.
      if (!related) return new Set(ids);
      let scope: Record<string, unknown> | undefined;
      try { scope = await withRelationRead(tx, actor, entry.id, related.id, () => authorizeModel(tx, actor, related.id, "read")); }
      catch (error) { if (error instanceof AccessError && error.code === "DENIED") return new Set<string>(); throw error; }
      const delegate = (tx as unknown as Record<string, { findMany(args: unknown): Promise<{ id: string }[]> }>)[related.delegate];
      const rows = await delegate.findMany({ where: { AND: [{ id: { in: [...ids] } }, ...(scope ? [scope] : [])] }, select: { id: true } });
      return new Set(rows.map(row => row.id));
    },
    // Actions with groups: superusers pass; others need one of the groups (local keys belong to this module).
    authorizeAction: async (tx, actor, action) => {
      const user = await tx.user.findUnique({ where: { id: actor.id }, select: { isAdmin: true } });
      if (user?.isAdmin) return;
      const policy = projectElementAccess(entry, await readActorElementPolicies(tx, actor), runtimeModels);
      if (policy.blockedActions.includes(action.name) || policy.privateDocument || hasPrivateFields(policy.fields)) throw new AccessError("DENIED");
      const groups = await userGroups(tx, actor.id);
      if (!allowsActionGroups({ isAdmin: false, groups }, module.id, action.groups)) throw new AccessError("DENIED");
    },
    ...(entry.kanban ? { kanban: { field: entry.kanban, ...(entry.kanbanTransitions !== undefined ? {transitions:entry.kanbanTransitions} : {}) } } : {}),
    ...(Object.keys(relations).length ? { relations } : {}),
  });
  services.set(id, service);
  return service;
}

/** Many2one fields whose target is a registered module model. Manual models (User) need their own provider. */
function lookupTargets(entry: ModuleModel): Record<string, string> {
  const targets: Record<string, string> = {};
  for (const [field, metadata] of Object.entries(entry.metadata)) {
    if (metadata.kind !== "many2one" || metadata.sensitive) continue;
    if (!entry.clientFields.includes(field) && !entry.list.fields.includes(field)) continue;
    const target = byPrismaName.get(metadata.target);
    if (target) targets[field] = target.id;
  }
  for (const [field, descriptor] of Object.entries(entry.contract.many2manyFields)) {
    const target = byPrismaName.get(descriptor.many2many.target);
    if (!target) throw new Error(`${entry.id}.${field}: Many2many requiere un destino declarativo registrado.`);
    targets[field] = target.id;
  }
  return targets;
}

const signers = new Map<string, ReturnType<typeof createModelImageSigner>>();
export function imageSigner(id: string) {
  const found = getModuleModel(id);
  if (!found) throw new Error("MODEL_NOT_FOUND");
  let signer = signers.get(id);
  if (!signer) {
    const images = Object.entries(found.entry.metadata).filter(([, field]) => field.kind === "image" && !field.sensitive).map(([name]) => name);
    // Uploading needs create or write access. Session lookup is loaded on demand so the
    // registry stays usable outside Next (scripts, tests).
    const authorize = async () => {
      const actor = await (await import("../auth/access")).requireUser();
      await prisma.$transaction(async tx => {
        try { await authorizeModel(tx, actor, id, "write"); }
        catch (error) { if (error instanceof AccessError && error.code === "DENIED") await authorizeModel(tx, actor, id, "create"); else throw error; }
      });
    };
    const uploadSigner = createModelImageSigner({ authorize }, { metadata: found.entry.metadata }, images);
    signer = async field => {
      if (typeof field !== "string") throw new AccessError("DENIED");
      const actor = await (await import("../auth/access")).requireUser();
      await prisma.$transaction(async tx => {
        const policy = projectElementAccess(found.entry, await readActorElementPolicies(tx, actor), modules.flatMap(module => module.models));
        if (policy.fields[field]?.noRead || policy.fields[field]?.noWrite) throw new AccessError("DENIED");
      }, { isolationLevel: "RepeatableRead" });
      return uploadSigner(field);
    };
    signers.set(id, signer);
  }
  return signer;
}

/** Line contracts of a model, recursively (sub-lines of nested documents). Names/metadata only. */
function lineConfigs(module: ModuleDefinition, owner: ModuleModel, access?: CapabilityActor): Record<string, ModelLineConfig> {
  return Object.fromEntries(Object.entries(owner.contract.one2manyFields).map(([name, field]) => {
    const child = module.models.find(model => model.contract.name === field.one2many.target)!;
    const nested = lineConfigs(module, child, access);
    const fieldAccess = projectElementAccess(child, { fieldAccess: access?.fieldAccess ?? {}, blockedActions: access?.blockedActions ?? {} }, modules.flatMap(module => module.models)).fields;
    return [name, {
      fieldAccess,
      metadata: field.one2many, model: child.id,
      fields: Object.fromEntries(Object.entries(child.metadata).filter(([key]) => key !== field.one2many.inverse).map(([key, field]) => {
        if (!fieldAccess[key]?.noRead) return [key, field];
        const { defaultValue: _defaultValue, ...safe } = field;
        void _defaultValue;
        return [key, { ...safe, defaultKind: "empty" as const }];
      })),
      lookups: Object.fromEntries(Object.entries(lookupTargets(child)).filter(([key]) => key !== field.one2many.inverse)),
      capabilities: access?.modelAccess[child.id] ?? { read: false, create: false, write: false, unlink: false },
      ...(Object.keys(nested).length ? { lines: nested } : {}),
    }];
  }));
}

/**
 * Children of a parent record for a read-only relation: the parent must be readable by the
 * actor, and the child list keeps its own permissions, rules and field policy, AND the fixed
 * `<inverse> = parentId` domain set here (never by the browser). The main collection
 * domain does not narrow this independent relation source. Paginated, no row limit.
 */
export async function childCollectionList(parentModel: string, field: string, parentId: unknown, actor: ModelActor, state: unknown) {
  const found = getModuleModel(parentModel);
  const collection = found && Object.hasOwn(found.entry.contract.childCollections, field) ? found.entry.contract.childCollections[field] : undefined;
  if (!found || !collection || typeof parentId !== "string" || !parentId.trim() || parentId.length > 100) throw new Error("MODEL_NOT_FOUND");
  await prisma.$transaction(async tx => {
    await authorizeModel(tx, actor, found.entry.id, "read");
    if (!projectElementAccess(found.entry, await readActorElementPolicies(tx, actor), modules.flatMap(module => module.models)).canRead([field])) throw new AccessError("DENIED");
  }, { isolationLevel: "RepeatableRead" });
  const parent = await modelService(found.entry.id).read(prisma, actor, parentId);
  if (!parent.ok) return { ok: false as const, error: parent.error };
  const child = byPrismaName.get(collection.target)!;
  const service = modelService(child.id);
  return withActor(actor, () => service.defineChildListAction(collection.inverse, parentId)(prisma, actor, state));
}

export function modelClientConfig(id: string, access?: CapabilityActor, nested = true): ModelClientConfig {
  const found = getModuleModel(id);
  if (!found) throw new Error("MODEL_NOT_FOUND");
  const { module, entry } = found;
  const { contract } = entry;
  const elements = projectElementAccess(entry, access ? { fieldAccess: access.fieldAccess ?? {}, blockedActions: access.blockedActions ?? {} } : emptyElementPolicies, modules.flatMap(module => module.models));
  const published = (entry.contract.actions ?? []) as readonly ModelAction[];
  const config: ModelClientConfig = {
    fieldAccess: elements.fields,
    ...(entry.declaration.transfer ? { transfer: { key: entry.declaration.transfer.key, fields: transferHeaders(entry.declaration.transfer), collections: transferCollections(entry.declaration.transfer),
      canImport: Boolean(access?.isAdmin || (access?.modelAccess[id]?.read && access.modelAccess[id]?.import && (access.modelAccess[id]?.create || access.modelAccess[id]?.write))),
      canExport: Boolean(access?.isAdmin || (access?.modelAccess[id]?.read && access.modelAccess[id]?.export)),
    } } : {}),
    id: entry.id, module: module.id, moduleName: module.application.name, key: entry.key, name: contract.name, label: entry.label, route: entry.route,
    fields: Object.fromEntries(entry.clientFields.map(name => {
      const field = entry.metadata[name];
      if (!elements.fields[name]?.noRead) return [name, field];
      const { defaultValue: _defaultValue, ...safe } = field;
      void _defaultValue;
      return [name, { ...safe, defaultKind: "empty" as const }];
    })),
    preview: Object.fromEntries(Object.entries((contract.previewFields ?? {}) as Readonly<Record<string, { metadata: FieldMetadata }>>).map(([name, field]) => [name, field.metadata])),
    related: Object.keys(contract.relatedFields ?? {}),
    reactionRules: (contract.reactionRules ?? []).filter(rule => elements.canRead([...rule.fields, ...rule.reads, ...rule.preview]) && rule.writes.every(name => !elements.fields[name]?.noWrite)),
    lookups: lookupTargets(entry),
    many2many: Object.fromEntries(Object.entries(contract.many2manyFields).map(([name, field]) => [name, field.many2many])),
    lines: lineConfigs(module, entry, access),
    // Names and labels only; the server validates the name and re-checks permissions on every call.
    actions: published.map(({ name, label, params }) => ({ name, label, ...(params ? { params, sourceModel: entry.id, lookups: Object.fromEntries(Object.entries(params).filter(([, field]) => field.kind === "many2one").map(([name, field]) => {
      const target = field.kind === "many2one" && byPrismaName.get(field.target);
      if (!target) throw new Error(`${entry.id}: parámetro Many2one sin destino declarativo registrado.`);
      return [name, target.id];
    })) } : {}) })),
    list: { fields: entry.list.fields, searchFields: entry.list.searchFields, sortable: entry.list.sortable ?? [], groupable: entry.list.groupable ?? [], filterable: entry.list.filterable ?? [] },
    view: entry.view,
    collectionViews: entry.collectionViews,
    // Plain JSON: omit absent options instead of sending undefined.
    ...(entry.kanban ? { kanban: entry.kanban } : {}),
    ...(entry.kanbanTransitions !== undefined ? {kanbanTransitions:entry.kanbanTransitions.map(({from,to})=>({from,to}))} : {}),
    ...(entry.defaultSort ? { defaultSort: entry.defaultSort } : {}),
    ...(entry.declaration.audit ? { audit: true as const } : {}),
    // Fields added by other modules, presented in their own group (names only).
    ...(entry.extensions.length ? { extensions: entry.extensions.map(extension => ({ module: extension.module, label: extension.label, fields: [...extension.fields, ...extension.computed, ...(extension.many2many?.map(link => link.field) ?? [])], depends: [...(extension.depends ?? [])], ...(extension.insertions ? { insertions: Object.keys(extension.insertions) as InsertionViewKind[] } : {}) })) } : {}),
  };
  // One level of read-only relations: each child config omits its own collections (no cycles).
  const collections = nested ? Object.entries(entry.contract.childCollections).map(([name, collection]) => {
    const child = byPrismaName.get(collection.target)!;
    return [name, { label: collection.label ?? child.label, inverse: collection.inverse, ...(collection.invisible !== undefined ? { invisible: collection.invisible } : {}), config: modelClientConfig(child.id, access, false) }] as const;
  }) : [];
  const withCollections = collections.length ? { ...config, collections: Object.fromEntries(collections) } : config;
  return access ? projectModelAccess(withCollections, access, published, entry.kanbanTransitions) : withCollections;
}
