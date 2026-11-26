import type { AccessPerms } from "./declare";
import type { ElementPolicies } from "./element-policy";
import type { HiddenPage } from "../modules/pages";

/** UI hints by model, never a substitute for transactional authorization. */
export type ModelCapabilities = AccessPerms & { readonly move: boolean };
export type CapabilityActor = Partial<ElementPolicies> & {
  /** Notebook pages hidden for the actor (presentation; empty for administrators). */
  readonly hiddenPages?: readonly HiddenPage[];
  readonly isAdmin: boolean;
  readonly groups: ReadonlySet<string>;
  readonly modelAccess: Readonly<Record<string, AccessPerms>>;
};
export const deniedPermissions: AccessPerms = Object.freeze({ read: false, create: false, write: false, unlink: false });
export const deniedCapabilities: ModelCapabilities = Object.freeze({ ...deniedPermissions, move: false });

/** Same group predicate for published actions and their server authorization. */
export function allowsActionGroups(actor: Pick<CapabilityActor, "isAdmin" | "groups">, module: string, groups?: readonly string[]) {
  return actor.isAdmin || !groups || groups.some(group => actor.groups.has(group.includes(".") ? group : `${module}.${group}`));
}

export function modelUiCapabilities(capabilities?: ModelCapabilities) {
  const value = capabilities ?? deniedCapabilities;
  return {
    read: value.read,
    create: value.read && value.create,
    write: value.read && value.write,
    unlink: value.read && value.unlink,
    move: value.read && value.write && value.move,
  };
}
