import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";
import { assertUniqueModuleGroups, hasModuleGroup } from "./membership";
import { loadElementPolicies } from "./element-policy.server";
import type { Prisma } from "@/generated/prisma/client";
import { registeredModules } from "../modules/installed";
import { extensionWhere } from "../modules/storage";
import { AccessError } from "../auth/policy";
import type { ModelActor } from "../orm/context";
import { compileListDomain } from "../orm/domain";
import { relationFieldName } from "../orm/display";
import type { FieldMetadata } from "../orm/fields";
import { accessOperations, type AccessGrant, type AccessGroup, type AccessOperation, type AccessPerms, type AccessRule } from "./declare";

type Predicate = Record<string, unknown>;
export type AccessCatalog = { owners?: Map<string, { model: string; relation: string }>; groups: Map<string, AccessGroup>; grants: Map<string, AccessGrant[]>; rules: Map<string, AccessRule[]>; models: Map<string, Readonly<Record<string, FieldMetadata>>> };
type Catalog = AccessCatalog;
let catalog: Catalog | undefined;
const installed = registeredModules;
const entries = new Map(installed.flatMap(module => module.models.map(model => [model.id, model] as const)));

/** Declarations of every installed module, indexed once. Code is the source of truth. */
export function accessCatalog(): Catalog {
  if (catalog) return catalog;
  const owners = new Map<string, { model: string; relation: string }>();
  const next: Catalog = { owners, groups: new Map(), grants: new Map(), rules: new Map(), models: new Map() };
  for (const definition of installed) {
    for (const group of definition.access.groups) next.groups.set(group.id, group);
    for (const grant of definition.access.grants) next.grants.set(grant.model, [...next.grants.get(grant.model) ?? [], grant]);
    for (const rule of definition.access.rules) for (const model of rule.models) next.rules.set(model, [...next.rules.get(model) ?? [], rule]);
    for (const model of definition.models) {
      const extended = new Set(model.extensions.flatMap(extension => extension.fields));
      next.models.set(model.id, Object.fromEntries(Object.entries(model.metadata).map(([name, field]) => [name, extended.has(name) ? { ...field, required: false } : field])));
    }
    for (const parent of definition.models) for (const field of Object.values(parent.contract.one2manyFields)) {
      const child = definition.models.find(model => model.contract.name === field.one2many.target);
      if (!child || owners.has(child.id)) throw new Error("Propietario One2many inválido o duplicado.");
      owners.set(child.id, { model: parent.id, relation: relationFieldName(field.one2many.inverse) });
    }
  }
  for (const group of next.groups.values()) for (const implied of group.implies) if (!next.groups.has(implied)) throw new Error(`${group.id}: implica un grupo no instalado: ${implied}.`);
  catalog = next;
  return next;
}

/** Group ids with their implied groups (transitive). Unknown stored ids are ignored. */
export function closeGroups(direct: Iterable<string>, groups = accessCatalog().groups): Set<string> {
  const result = new Set<string>();
  const visit = (id: string) => {
    if (result.has(id) || !groups.has(id)) return;
    result.add(id);
    for (const implied of groups.get(id)!.implies) visit(implied);
  };
  for (const id of direct) visit(id);
  return result;
}

export async function userGroups(tx: Prisma.TransactionClient, userId: string, catalogGroups = accessCatalog().groups) {
  return closeGroups(await directUserGroups(tx, userId, catalogGroups), catalogGroups);
}

async function directUserGroups(tx: Prisma.TransactionClient, userId: string, catalogGroups = accessCatalog().groups) {
  const rows = await tx.accessUserGroup.findMany({ where: { userId }, select: { groupId: true } });
  const direct = rows.map(row => row.groupId);
  assertUniqueModuleGroups(direct, catalogGroups);
  return new Set(direct.filter(id => catalogGroups.has(id)));
}

const relationalRead = new AsyncLocalStorage<{ tx: Prisma.TransactionClient; actor: ModelActor; target: string }>();

/** Internal only: caller resolves a published relation in trusted model metadata. */
export async function withRelationRead<T>(tx: Prisma.TransactionClient, actor: ModelActor, source: string, target: string, run: () => Promise<T>): Promise<T> {
  await authorizeModel(tx, actor, source, "read");
  return relationalRead.run({ tx, actor, target }, run);
}

/** Direct endpoints need an explicit membership in the model's owning module. */
export async function authorizeModelEntry(tx: Prisma.TransactionClient, actor: ModelActor, model: string) {
  const user = await tx.user.findUnique({ where: { id: actor.id }, select: { active: true, isAdmin: true, sessionVersion: true } });
  if (!user?.active || user.sessionVersion !== actor.sessionVersion) throw new AccessError("UNAUTHENTICATED");
  if (!accessCatalog().models.has(model)) throw new AccessError("DENIED");
  if (!user.isAdmin && model === "core.user") throw new AccessError("DENIED"); // Ajustes remains administrative.
  if (!user.isAdmin && !hasModuleGroup(model.split(".")[0], await directUserGroups(tx, actor.id))) throw new AccessError("DENIED");
}

/** Effective permissions of a set of groups on a model: database overrides replace code defaults per group. */
export async function modelPerms(tx: Prisma.TransactionClient, groups: ReadonlySet<string>, model: string): Promise<AccessPerms> {
  const catalog = accessCatalog();
  const defaults = catalog.grants.get(model) ?? [];
  const overrides = groups.size ? await tx.accessModelOverride.findMany({ where: { model, groupId: { in: [...groups] } } }) : [];
  return mergePermissions(groups, defaults, overrides.map(row => ({ ...row, import: row.canImport, export: row.canExport })));
}

function mergePermissions(groups: ReadonlySet<string>, defaults: readonly AccessGrant[], overrides: readonly (AccessPerms & { groupId: string })[]): AccessPerms {
  const result: Record<AccessOperation, boolean> & { import?: boolean; export?: boolean } = { read: false, create: false, write: false, unlink: false };
  for (const group of groups) {
    const perms = overrides.find(row => row.groupId === group) ?? defaults.find(grant => grant.group === group)?.perms;
    if (perms) for (const operation of accessOperations) result[operation] ||= perms[operation];
    if (perms?.import) result.import = true;
    if (perms?.export) result.export = true;
  }
  return result;
}

/** One batch for all models; no record queries/rules and no cache across actors. */
export async function readAccessCapabilities(tx: Prisma.TransactionClient, actor: ModelActor, catalog = accessCatalog()) {
  const user = await tx.user.findUnique({ where: { id: actor.id }, select: { active: true, isAdmin: true, sessionVersion: true } });
  if (!user?.active || user.sessionVersion !== actor.sessionVersion) throw new AccessError("UNAUTHENTICATED");
  const directGroups = user.isAdmin ? new Set<string>() : await directUserGroups(tx, actor.id, catalog.groups);
  const groups = closeGroups(directGroups, catalog.groups);
  const models = [...catalog.models.keys()];
  const overrides = !user.isAdmin && groups.size && models.length ? await tx.accessModelOverride.findMany({ where: { model: { in: models }, groupId: { in: [...groups] } } }) : [];
  const byModel = new Map<string, typeof overrides>();
  for (const row of overrides) byModel.set(row.model, [...(byModel.get(row.model) ?? []), row]);
  const permissions = new Map(models.map(model => [model, user.isAdmin
    ? { read: true, create: true, write: true, unlink: true, import: true, export: true }
    : mergePermissions(groups, catalog.grants.get(model) ?? [], (byModel.get(model) ?? []).map(row => ({ ...row, import: row.canImport, export: row.canExport })))]));
  // These are direct capabilities. Relational reads use their own scoped authorization.
  if (!user.isAdmin) for (const model of models) {
    if (model === "core.user" || !hasModuleGroup(model.split(".")[0], directGroups)) permissions.set(model, { read: false, create: false, write: false, unlink: false });
  }
  // Hints only: a line also needs read access to its owner. The server repeats this check.
  if (!user.isAdmin) for (const [child, owner] of catalog.owners ?? []) {
    if (!permissions.get(owner.model)?.read) permissions.set(child, { read: false, create: false, write: false, unlink: false });
  }
  return {
    isAdmin: user.isAdmin,
    ...await loadElementPolicies(tx, groups),
    directGroups: directGroups as ReadonlySet<string>,
    groups: groups as ReadonlySet<string>,
    modelAccess: Object.freeze(Object.fromEntries([...permissions].map(([model, perms]) => [model, Object.freeze(perms)]))),
  };
}

/** Fresh policy snapshot in the operation transaction; administrators keep their bypass. */
export async function readActorElementPolicies(tx: Prisma.TransactionClient, actor: ModelActor) {
  const user = await tx.user.findUnique({ where: { id: actor.id }, select: { active: true, isAdmin: true, sessionVersion: true } });
  if (!user?.active || user.sessionVersion !== actor.sessionVersion) throw new AccessError("UNAUTHENTICATED");
  return loadElementPolicies(tx, user.isAdmin ? new Set<string>() : await userGroups(tx, actor.id));
}

/**
 * Authorize an operation on a module model inside the caller's transaction. Superusers
 * (`isAdmin`) pass; others need a grant from one of their groups. Returns the record-rule
 * predicate the caller must AND into every query and record check, or undefined.
 */
export async function authorizeModel(tx: Prisma.TransactionClient, actor: ModelActor, model: string, operation: AccessOperation): Promise<Predicate | undefined> {
  const user = await tx.user.findUnique({ where: { id: actor.id }, select: { active: true, isAdmin: true, sessionVersion: true } });
  if (!user?.active || user.sessionVersion !== actor.sessionVersion) throw new AccessError("UNAUTHENTICATED");
  if (user.isAdmin) return undefined;
  const { models, rules } = accessCatalog();
  const metadata = models.get(model);
  if (!metadata) throw new AccessError("DENIED");
  const direct = await directUserGroups(tx, actor.id);
  const groups = closeGroups(direct);
  const relation = relationalRead.getStore();
  const related = operation === "read" && relation?.tx === tx && relation.target === model && relation.actor.id === actor.id && relation.actor.sessionVersion === actor.sessionVersion;
  if (!related && model === "core.user") throw new AccessError("DENIED");
  if (!related && !hasModuleGroup(model.split(".")[0], direct)) throw new AccessError("DENIED");
  if (!related && !(await modelPerms(tx, groups, model))[operation]) throw new AccessError("DENIED");
  const candidates = (rules.get(model) ?? []).filter(rule => rule.operations.includes(operation));
  const states = candidates.length ? await tx.accessRuleState.findMany({ where: { ruleId: { in: candidates.map(rule => rule.id) } } }) : [];
  const active = candidates.filter(rule => states.find(state => state.ruleId === rule.id)?.active ?? true);
  const context = Object.freeze({ actor: Object.freeze({ id: actor.id, sessionVersion: actor.sessionVersion }), tx });
  const compile = async (rule: AccessRule) => compileListDomain(metadata, typeof rule.domain === "function" ? await rule.domain(context) : rule.domain);
  // An empty domain compiles to `{}` (always true). Prisma drops empty objects inside OR,
  // so a true rule must be handled here: it removes the restriction instead of being sent.
  const always = (predicate: Predicate) => Object.keys(predicate).length === 0;
  const predicates = (await Promise.all(active.filter(rule => !rule.groups).map(compile))).filter(predicate => !always(predicate));
  const own = await Promise.all(active.filter(rule => rule.groups?.some(group => groups.has(group))).map(compile));
  if (own.length && !own.some(always)) predicates.push({ OR: own });
  // A line is visible only through a readable owner, even in standalone views/lookups.
  // Keep this outside group-rule ORs: a child's own "all records" rule cannot widen it.
  const owner = accessCatalog().owners?.get(model);
  if (owner) {
    const scope = related && relation
      ? await relationalRead.run({ ...relation, target: owner.model }, () => authorizeModel(tx, actor, owner.model, "read"))
      : await authorizeModel(tx, actor, owner.model, "read");
    if (scope) predicates.push({ [owner.relation]: { is: scope } });
  }
  const predicate = predicates.length ? { AND: predicates } : undefined;
  const entry = entries.get(model);
  return predicate && entry ? extensionWhere(entry, predicate) : predicate;
}
