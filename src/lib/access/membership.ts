import type { AccessGroup } from "./declare";

export class GroupMembershipError extends Error {}

/** Only explicit memberships count; implication reuses permissions, not another job. */
export function assertUniqueModuleGroups(ids: Iterable<string>, groups: ReadonlyMap<string, AccessGroup>) {
  const modules = new Map<string, AccessGroup>();
  for (const id of new Set(ids)) {
    const group = groups.get(id);
    if (!group) continue; // Removed declarations cannot grant permissions.
    const previous = modules.get(group.module);
    if (previous) throw new GroupMembershipError(`El usuario no puede pertenecer a dos grupos del módulo ${group.module}: «${previous.label}» y «${group.label}». Retíralo primero del grupo anterior.`);
    modules.set(group.module, group);
  }
}

export function hasModuleGroup(module: string, groups?: ReadonlySet<string>) {
  return Boolean(groups && [...groups].some(id => id.startsWith(`${module}.`)));
}
