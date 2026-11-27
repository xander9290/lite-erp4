import type { ModelEnvironment, ModelEnvironmentModel } from "../orm/environment";
import { nativeModule, type ModuleDefinition, type ModuleModel } from "./define";

/**
 * Models visible in `context.env` of a model's methods: those of its module, its declared
 * dependencies and the native core. Methods added by extensions run in the base model's
 * service, so modules that extend `entry` (and their dependencies) are reachable too.
 */
export function environmentModels(modules: readonly ModuleDefinition[], module: ModuleDefinition, entry?: Pick<ModuleModel, "extensions">): ReadonlyMap<string, string> {
  const byId = new Map(modules.map(definition => [definition.id, definition]));
  const reachable = new Set([nativeModule]);
  const include = (definition: ModuleDefinition | undefined) => {
    if (!definition) return;
    reachable.add(definition.id);
    for (const dependency of definition.profile.module.depends) reachable.add(dependency);
  };
  include(module);
  for (const extension of entry?.extensions ?? []) include(byId.get(extension.module));
  return new Map(modules.filter(definition => reachable.has(definition.id))
    .flatMap(definition => definition.models.map(model => [model.contract.name, model.id] as const)));
}

/**
 * Lazy, immutable `env`: a facade is built only for the model accessed. Unknown names fail with a
 * hint instead of returning undefined; `then`/symbols stay undefined so env is never a thenable.
 */
export function createEnvironment(moduleId: string, models: ReadonlyMap<string, string>, facade: (id: string) => ModelEnvironmentModel): ModelEnvironment {
  return new Proxy({}, {
    get(_target, key) {
      if (typeof key !== "string" || key === "then") return undefined;
      const id = models.get(key);
      if (!id) throw new Error(`env.${key}: modelo no disponible para ${moduleId}. Usa el nombre del modelo (p. ej. DirectoryPartner) y declara su módulo en depends.`);
      return facade(id);
    },
    has: (_target, key) => typeof key === "string" && models.has(key),
    ownKeys: () => [...models.keys()],
    getOwnPropertyDescriptor: (_target, key) => typeof key === "string" && models.has(key) ? { enumerable: true, configurable: true } : undefined,
    set: () => false, defineProperty: () => false, deleteProperty: () => false,
  }) as ModelEnvironment;
}
