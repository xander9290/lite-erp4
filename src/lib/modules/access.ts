import { allowsActionGroups, deniedPermissions, type CapabilityActor } from "../access/capabilities";
import type { KanbanTransition } from "../kanban/types";
import type { ModelClientConfig } from "./config";

/** Actor-specific projection; definitions and service caches never hold this result. */
export function projectModelAccess(config: ModelClientConfig, actor: CapabilityActor,
  declarations: readonly { name: string; label: string; groups?: readonly string[] }[], graph?: readonly KanbanTransition[]): ModelClientConfig {
  const permissions = actor.modelAccess[config.id] ?? deniedPermissions;
  const actions = declarations.filter(action => permissions.read && permissions.write && allowsActionGroups(actor, config.module, action.groups));
  const allowed = new Set(actions.map(action => action.name));
  const routes = graph?.filter(route => allowed.has(route.action)).map(({ from, to }) => ({ from, to }));
  const transitions = routes ?? (config.kanbanTransitions === undefined ? undefined : []);
  // «Crear» in a Many2many selector is offered only to actors who may create the target.
  const many2many = config.many2many && Object.fromEntries(Object.entries(config.many2many).map(([field, metadata]) => {
    if (!metadata.create || actor.modelAccess[config.lookups[field]]?.create) return [field, metadata];
    const { create: _create, ...rest } = metadata;
    void _create;
    return [field, rest];
  }));
  return {
    ...config,
    ...(many2many ? { many2many } : {}),
    capabilities: { ...permissions, move: Boolean(config.kanban && permissions.read && permissions.write && (transitions === undefined || transitions.length > 0)) },
    actions: actions.map(({ name, label }) => ({ name, label })),
    ...(transitions !== undefined ? { kanbanTransitions: transitions } : {}),
  };
}
