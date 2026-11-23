import "server-only";
import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { registeredModules as modules } from "../modules/installed";
import { AccessError } from "../auth/policy";
import type { ModelActor } from "../orm/context";
import { accessCatalog } from "./engine";
import { accessOperations, accessPermissionKeys, type AccessPerms } from "./declare";
import { assertUniqueModuleGroups } from "./membership";
import { restrictionFields } from "../modules/element-access";
import { fieldRestrictionKeys, type FieldRestriction } from "./element-policy";
import { registeredGroupMenus } from "../applications/menu-catalog";
import { menuKey } from "./menu-policy";

/** Administration of access control. Every function revalidates an active superuser inside its transaction. */
async function assertAdmin(tx: Prisma.TransactionClient, actor: ModelActor) {
  const user = await tx.user.findUnique({ where: { id: actor.id }, select: { active: true, isAdmin: true, sessionVersion: true } });
  if (!user?.active || user.sessionVersion !== actor.sessionVersion) throw new AccessError("UNAUTHENTICATED");
  if (!user.isAdmin) throw new AccessError("FORBIDDEN");
}
const none: AccessPerms = { read: false, create: false, write: false, unlink: false };
const same = (a: AccessPerms, b: AccessPerms) => accessPermissionKeys.every(operation => Boolean(a[operation]) === Boolean(b[operation]));

export function knownGroup(groupId: unknown) {
  return typeof groupId === "string" ? accessCatalog().groups.get(groupId) : undefined;
}

export async function accessOverview(prisma: PrismaClient, actor: ModelActor) {
  return prisma.$transaction(async tx => {
    await assertAdmin(tx, actor);
    const counts = await tx.accessUserGroup.groupBy({ by: ["groupId"], _count: { _all: true } });
    return modules.filter(definition => definition.access.groups.length).map(definition => ({
      id: definition.id, name: definition.application.name,
      groups: definition.access.groups.map(group => ({
        id: group.id, label: group.label,
        implies: group.implies.map(id => accessCatalog().groups.get(id)?.label ?? id),
        members: counts.find(row => row.groupId === group.id)?._count._all ?? 0,
        implicit: false,
      })),
    }));
  }, { isolationLevel: "RepeatableRead" });
}

export async function groupDetail(prisma: PrismaClient, actor: ModelActor, groupId: string) {
  const group = knownGroup(groupId);
  if (!group) return null;
  return prisma.$transaction(async tx => {
    await assertAdmin(tx, actor);
    const catalog = accessCatalog();
    const [users, members, overrides, states, fieldPolicies, actionPolicies, menus, hiddenMenus] = await Promise.all([
      tx.user.findMany({ select: { id: true, login: true, active: true, isAdmin: true, name: true }, orderBy: { login: "asc" } }),
      tx.accessUserGroup.findMany({ where: { groupId }, select: { userId: true } }),
      tx.accessModelOverride.findMany({ where: { groupId } }),
      tx.accessRuleState.findMany(),
      tx.accessFieldRestriction.findMany({ where: { groupId } }),
      tx.accessActionRestriction.findMany({ where: { groupId } }),
      registeredGroupMenus(group.module),
      tx.accessMenuHidden.findMany({ where: { groupId } }),
    ]);
    const memberIds = new Set(members.map(row => row.userId));
    const models = modules.filter(definition => definition.id === group.module).flatMap(definition => definition.models.map(model => {
      const defaults = catalog.grants.get(model.id)?.find(grant => grant.group === groupId)?.perms ?? none;
      const override = overrides.find(row => row.model === model.id);
      const perms = override ? { read: override.read, create: override.create, write: override.write, unlink: override.unlink, import: override.canImport, export: override.canExport } : defaults;
      return { id: model.id, label: `${definition.application.name} · ${model.label}`, defaults, perms, overridden: Boolean(override) };
    }));
    // Rules of this group, plus global rules of the models it can access.
    const reachable = new Set(models.filter(model => accessOperations.some(operation => model.perms[operation])).map(model => model.id));
    const rules = modules.flatMap(definition => definition.access.rules)
      .filter(rule => rule.groups ? rule.groups.includes(groupId) : rule.models.some(model => reachable.has(model)))
      .map(rule => ({ id: rule.id, label: rule.label, scope: rule.groups ? "grupo" as const : "global" as const, models: rule.models, operations: rule.operations, active: states.find(state => state.ruleId === rule.id)?.active ?? true }));
    return {
      group: { id: group.id, label: group.label, module: group.module, implies: group.implies.map(id => catalog.groups.get(id)?.label ?? id), implicit: false },
      users: users.map(user => ({ id: user.id, login: user.login, name: user.name || user.login, active: user.active, isAdmin: user.isAdmin, member: memberIds.has(user.id) })),
      models, rules,
      menus: menus.map(menu => ({ ...menu, hidden: hiddenMenus.some(row => row.application === menu.application && row.menu === menu.id) })),
      fields: modules.filter(module => module.id === group.module).flatMap(module => module.models.flatMap(model => Object.entries(restrictionFields(model)).map(([field, label]) => ({
        model: model.id, modelLabel: model.label, field, label,
        policy: Object.fromEntries(fieldRestrictionKeys.map(key => [key, fieldPolicies.find(row => row.model === model.id && row.field === field)?.[key] ?? false])) as FieldRestriction,
      })))),
      actions: modules.filter(module => module.id === group.module).flatMap(module => module.models.flatMap(model => (model.contract.actions ?? []).map(action => ({ model: model.id, modelLabel: model.label, name: action.name, label: action.label, blocked: actionPolicies.some(row => row.model === model.id && row.action === action.name) })))),
    };
  }, { isolationLevel: "RepeatableRead" });
}

/** Change only the posted menu exceptions; never memberships, CRUD or other saved policies. */
export async function setMenuVisibility(prisma: PrismaClient, actor: ModelActor, groupId: string, changes: readonly { application: string; menu: string; hidden: boolean }[]) {
  const group = knownGroup(groupId);
  if (!group || changes.length > 1000) throw new AccessError("DENIED");
  const available = new Set((await registeredGroupMenus(group.module)).map(menu => menuKey(menu.application, menu.id)));
  const seen = new Set<string>();
  for (const change of changes) {
    const key = menuKey(change.application, change.menu);
    if (!available.has(key) || seen.has(key) || typeof change.hidden !== "boolean") throw new AccessError("DENIED");
    seen.add(key);
  }
  await prisma.$transaction(async tx => {
    await assertAdmin(tx, actor);
    for (const { application, menu, hidden } of changes) {
      if (hidden) await tx.accessMenuHidden.upsert({ where: { groupId_application_menu: { groupId, application, menu } }, create: { groupId, application, menu }, update: {} });
      else await tx.accessMenuHidden.deleteMany({ where: { groupId, application, menu } });
    }
  }, { isolationLevel: "Serializable" });
}

/** Opt-in policies only; deleting a policy restores normal model behavior. */
export async function setFieldRestrictions(prisma: PrismaClient, actor: ModelActor, groupId: string, changes: readonly { model: string; field: string; policy: FieldRestriction }[]) {
  const group = knownGroup(groupId);
  if (!group || changes.length > 2000) throw new AccessError("DENIED");
  const models = modules.find(module => module.id === group.module)?.models ?? [];
  const seen = new Set<string>();
  for (const change of changes) {
    const model = models.find(model => model.id === change.model);
    const key = `${change.model}|${change.field}`;
    if (!model || !Object.hasOwn(restrictionFields(model), change.field) || seen.has(key) || Object.keys(change.policy).some(key => !fieldRestrictionKeys.includes(key as typeof fieldRestrictionKeys[number])) || fieldRestrictionKeys.some(key => typeof change.policy[key] !== "boolean")) throw new AccessError("DENIED");
    seen.add(key);
  }
  await prisma.$transaction(async tx => {
    await assertAdmin(tx, actor);
    for (const { model, field, policy } of changes) {
      const data = { ...policy, noWrite: policy.noWrite || policy.noRead };
      if (!fieldRestrictionKeys.some(key => data[key])) await tx.accessFieldRestriction.deleteMany({ where: { groupId, model, field } });
      else await tx.accessFieldRestriction.upsert({ where: { groupId_model_field: { groupId, model, field } }, create: { groupId, model, field, ...data }, update: data });
    }
  }, { isolationLevel: "Serializable" });
}

export async function setActionRestrictions(prisma: PrismaClient, actor: ModelActor, groupId: string, changes: readonly { model: string; action: string; blocked: boolean }[]) {
  const group = knownGroup(groupId);
  if (!group || changes.length > 1000) throw new AccessError("DENIED");
  const models = modules.find(module => module.id === group.module)?.models ?? [];
  const seen = new Set<string>();
  for (const change of changes) {
    const key = `${change.model}|${change.action}`;
    if (seen.has(key) || typeof change.blocked !== "boolean" || !models.find(model => model.id === change.model)?.contract.actions?.some(action => action.name === change.action)) throw new AccessError("DENIED");
    seen.add(key);
  }
  await prisma.$transaction(async tx => {
    await assertAdmin(tx, actor);
    for (const { model, action, blocked } of changes) {
      if (!blocked) await tx.accessActionRestriction.deleteMany({ where: { groupId, model, action } });
      else await tx.accessActionRestriction.upsert({ where: { groupId_model_action: { groupId, model, action } }, create: { groupId, model, action }, update: {} });
    }
  }, { isolationLevel: "Serializable" });
}

export async function setGroupMembers(prisma: PrismaClient, actor: ModelActor, groupId: string, userIds: readonly string[]) {
  if (!knownGroup(groupId)) throw new AccessError("DENIED");
  const wanted = new Set(userIds);
  await prisma.$transaction(async tx => {
    await assertAdmin(tx, actor);
    const existing = await tx.user.count({ where: { id: { in: [...wanted] } } });
    if (existing !== wanted.size) throw new Error("Usuario inexistente.");
    const memberships = await tx.accessUserGroup.findMany({ where: { userId: { in: [...wanted] }, groupId: { not: groupId } }, select: { userId: true, groupId: true } });
    for (const userId of wanted) assertUniqueModuleGroups([groupId, ...memberships.filter(row => row.userId === userId).map(row => row.groupId)], accessCatalog().groups);
    await tx.accessUserGroup.deleteMany({ where: { groupId, userId: { notIn: [...wanted] } } });
    await tx.accessUserGroup.createMany({ data: [...wanted].map(userId => ({ userId, groupId })), skipDuplicates: true });
  }, { isolationLevel: "Serializable" });
}

/** Store only differences from the code defaults; matching the defaults removes the override. */
export async function setModelAccess(prisma: PrismaClient, actor: ModelActor, groupId: string, changes: ReadonlyMap<string, AccessPerms>) {
  const group = knownGroup(groupId);
  if (!group) throw new AccessError("DENIED");
  const catalog = accessCatalog();
  for (const model of changes.keys()) {
    if (!catalog.models.has(model)) throw new Error("Modelo inexistente.");
    if (model.split(".")[0] !== group.module) throw new AccessError("DENIED");
  }
  await prisma.$transaction(async tx => {
    await assertAdmin(tx, actor);
    for (const [model, perms] of changes) {
      const defaults = catalog.grants.get(model)?.find(grant => grant.group === groupId)?.perms ?? none;
      if (same(perms, defaults)) await tx.accessModelOverride.deleteMany({ where: { groupId, model } });
      else {
        const data = { read: perms.read, create: perms.create, write: perms.write, unlink: perms.unlink, canImport: Boolean(perms.import), canExport: Boolean(perms.export) };
        await tx.accessModelOverride.upsert({ where: { groupId_model: { groupId, model } }, create: { groupId, model, ...data }, update: data });
      }
    }
  }, { isolationLevel: "Serializable" });
}

/** Rules are active by default; only deactivations are stored. */
export async function setRulesActive(prisma: PrismaClient, actor: ModelActor, states: ReadonlyMap<string, boolean>) {
  const rules = new Set(modules.flatMap(definition => definition.access.rules.map(rule => rule.id)));
  for (const id of states.keys()) if (!rules.has(id)) throw new Error("Regla inexistente.");
  await prisma.$transaction(async tx => {
    await assertAdmin(tx, actor);
    for (const [ruleId, active] of states) {
      if (active) await tx.accessRuleState.deleteMany({ where: { ruleId } });
      else await tx.accessRuleState.upsert({ where: { ruleId }, create: { ruleId, active }, update: { active } });
    }
  }, { isolationLevel: "Serializable" });
}
