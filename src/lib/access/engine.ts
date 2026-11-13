import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { modules } from "@/modules";
import { AccessError } from "../auth/policy";
import type { ModelActor } from "../orm/context";
import { compileListDomain } from "../orm/domain";
import type { FieldMetadata } from "../orm/fields";
import { accessOperations, type AccessGrant, type AccessGroup, type AccessOperation, type AccessPerms, type AccessRule } from "./declare";

type Predicate = Record<string, unknown>;
type Catalog = { groups: Map<string, AccessGroup>; grants: Map<string, AccessGrant[]>; rules: Map<string, AccessRule[]>; models: Map<string, Readonly<Record<string, FieldMetadata>>> };
let catalog: Catalog | undefined;

/** Declarations of every installed module, indexed once. Code is the source of truth. */
export function accessCatalog(): Catalog {
  if (catalog) return catalog;
  const next: Catalog = { groups: new Map(), grants: new Map(), rules: new Map(), models: new Map() };
  for (const definition of modules) {
    for (const group of definition.access.groups) next.groups.set(group.id, group);
    for (const grant of definition.access.grants) next.grants.set(grant.model, [...next.grants.get(grant.model) ?? [], grant]);
    for (const rule of definition.access.rules) for (const model of rule.models) next.rules.set(model, [...next.rules.get(model) ?? [], rule]);
    for (const model of definition.models) next.models.set(model.id, model.metadata);
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

export async function userGroups(tx: Prisma.TransactionClient, userId: string) {
  const rows = await tx.accessUserGroup.findMany({ where: { userId }, select: { groupId: true } });
  return closeGroups(rows.map(row => row.groupId));
}

/** Effective permissions of a set of groups on a model: database overrides replace code defaults per group. */
export async function modelPerms(tx: Prisma.TransactionClient, groups: ReadonlySet<string>, model: string): Promise<AccessPerms> {
  const defaults = accessCatalog().grants.get(model) ?? [];
  const overrides = groups.size ? await tx.accessModelOverride.findMany({ where: { model, groupId: { in: [...groups] } } }) : [];
  const result = { read: false, create: false, write: false, unlink: false };
  for (const group of groups) {
    const perms = overrides.find(row => row.groupId === group) ?? defaults.find(grant => grant.group === group)?.perms;
    if (perms) for (const operation of accessOperations) result[operation] ||= perms[operation];
  }
  return result;
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
  const groups = await userGroups(tx, actor.id);
  if (!(await modelPerms(tx, groups, model))[operation]) throw new AccessError("DENIED");
  const candidates = (rules.get(model) ?? []).filter(rule => rule.operations.includes(operation));
  if (!candidates.length) return undefined;
  const states = await tx.accessRuleState.findMany({ where: { ruleId: { in: candidates.map(rule => rule.id) } } });
  const active = candidates.filter(rule => states.find(state => state.ruleId === rule.id)?.active ?? true);
  const context = Object.freeze({ actor: Object.freeze({ id: actor.id, sessionVersion: actor.sessionVersion }), tx });
  const compile = async (rule: AccessRule) => compileListDomain(metadata, typeof rule.domain === "function" ? await rule.domain(context) : rule.domain);
  // An empty domain compiles to `{}` (always true). Prisma drops empty objects inside OR,
  // so a true rule must be handled here: it removes the restriction instead of being sent.
  const always = (predicate: Predicate) => Object.keys(predicate).length === 0;
  const predicates = (await Promise.all(active.filter(rule => !rule.groups).map(compile))).filter(predicate => !always(predicate));
  const own = await Promise.all(active.filter(rule => rule.groups?.some(group => groups.has(group))).map(compile));
  if (own.length && !own.some(always)) predicates.push({ OR: own });
  return predicates.length ? { AND: predicates } : undefined;
}
