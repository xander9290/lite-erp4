import "server-only";
import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { modules } from "@/modules";
import { AccessError } from "../auth/policy";
import type { ModelActor } from "../orm/context";
import { accessCatalog } from "./engine";
import { accessOperations, type AccessPerms } from "./declare";

/** Administration of access control. Every function revalidates an active superuser inside its transaction. */
async function assertAdmin(tx: Prisma.TransactionClient, actor: ModelActor) {
  const user = await tx.user.findUnique({ where: { id: actor.id }, select: { active: true, isAdmin: true, sessionVersion: true } });
  if (!user?.active || user.sessionVersion !== actor.sessionVersion) throw new AccessError("UNAUTHENTICATED");
  if (!user.isAdmin) throw new AccessError("FORBIDDEN");
}
const none: AccessPerms = { read: false, create: false, write: false, unlink: false };
const same = (a: AccessPerms, b: AccessPerms) => accessOperations.every(operation => a[operation] === b[operation]);

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
    const [users, members, overrides, states] = await Promise.all([
      tx.user.findMany({ select: { id: true, login: true, active: true, isAdmin: true, partner: { select: { name: true } } }, orderBy: { login: "asc" } }),
      tx.accessUserGroup.findMany({ where: { groupId }, select: { userId: true } }),
      tx.accessModelOverride.findMany({ where: { groupId } }),
      tx.accessRuleState.findMany(),
    ]);
    const memberIds = new Set(members.map(row => row.userId));
    const models = modules.flatMap(definition => definition.models.map(model => {
      const defaults = catalog.grants.get(model.id)?.find(grant => grant.group === groupId)?.perms ?? none;
      const override = overrides.find(row => row.model === model.id);
      const perms = override ? { read: override.read, create: override.create, write: override.write, unlink: override.unlink } : defaults;
      return { id: model.id, label: `${definition.application.name} · ${model.label}`, defaults, perms, overridden: Boolean(override) };
    }));
    // Rules of this group, plus global rules of the models it can access.
    const reachable = new Set(models.filter(model => accessOperations.some(operation => model.perms[operation])).map(model => model.id));
    const rules = modules.flatMap(definition => definition.access.rules)
      .filter(rule => rule.groups ? rule.groups.includes(groupId) : rule.models.some(model => reachable.has(model)))
      .map(rule => ({ id: rule.id, label: rule.label, scope: rule.groups ? "grupo" as const : "global" as const, models: rule.models, operations: rule.operations, active: states.find(state => state.ruleId === rule.id)?.active ?? true }));
    return {
      group: { id: group.id, label: group.label, module: group.module, implies: group.implies.map(id => catalog.groups.get(id)?.label ?? id) },
      users: users.map(user => ({ id: user.id, login: user.login, name: user.partner?.name ?? user.login, active: user.active, isAdmin: user.isAdmin, member: memberIds.has(user.id) })),
      models, rules,
    };
  }, { isolationLevel: "RepeatableRead" });
}

export async function setGroupMembers(prisma: PrismaClient, actor: ModelActor, groupId: string, userIds: readonly string[]) {
  if (!knownGroup(groupId)) throw new AccessError("DENIED");
  const wanted = new Set(userIds);
  await prisma.$transaction(async tx => {
    await assertAdmin(tx, actor);
    const existing = await tx.user.count({ where: { id: { in: [...wanted] } } });
    if (existing !== wanted.size) throw new Error("Usuario inexistente.");
    await tx.accessUserGroup.deleteMany({ where: { groupId, userId: { notIn: [...wanted] } } });
    await tx.accessUserGroup.createMany({ data: [...wanted].map(userId => ({ userId, groupId })), skipDuplicates: true });
  }, { isolationLevel: "Serializable" });
}

/** Store only differences from the code defaults; matching the defaults removes the override. */
export async function setModelAccess(prisma: PrismaClient, actor: ModelActor, groupId: string, changes: ReadonlyMap<string, AccessPerms>) {
  if (!knownGroup(groupId)) throw new AccessError("DENIED");
  const catalog = accessCatalog();
  for (const model of changes.keys()) if (!catalog.models.has(model)) throw new Error("Modelo inexistente.");
  await prisma.$transaction(async tx => {
    await assertAdmin(tx, actor);
    for (const [model, perms] of changes) {
      const defaults = catalog.grants.get(model)?.find(grant => grant.group === groupId)?.perms ?? none;
      if (same(perms, defaults)) await tx.accessModelOverride.deleteMany({ where: { groupId, model } });
      else await tx.accessModelOverride.upsert({ where: { groupId_model: { groupId, model } }, create: { groupId, model, ...perms }, update: perms });
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
