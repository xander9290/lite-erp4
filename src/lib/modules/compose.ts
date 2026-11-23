import "server-only";
import { resolveFormView } from "./form-view";
import { compileModuleModel, nativeModule, type ModuleDefinition, type ModuleExtension, type ModuleModel } from "./define";
import { extensionFields, extensionMany2many } from "./extend";
import { many2manyStorage } from "../orm/many2many";
import { relationFieldName } from "../orm/display";
import { validateModuleDomains } from "./relation-domains";
import { validateModuleTransfers } from "../list/transfer-contract";

/**
 * Compose the extensions declared by registered modules onto their base models:
 * `Final = extB(extA(Base))`, ordered by dependency depth and then by module id, so the
 * result never depends on the order of src/modules/index.ts. Pure: no database access.
 */
export function composeModules(definitions: readonly ModuleDefinition[]): readonly ModuleDefinition[] {
  const byId = new Map(definitions.map(definition => [definition.id, definition]));
  const depth = (id: string, seen: readonly string[] = []): number => {
    if (seen.includes(id)) throw new Error(`Dependencias en ciclo: ${[...seen, id].join(" → ")}.`);
    const depends = byId.get(id)?.application.depends ?? [];
    return depends.length ? 1 + Math.max(...depends.map(next => depth(next, [...seen, id]))) : 0;
  };
  const closure = (id: string, seen = new Set<string>()): Set<string> => {
    for (const next of byId.get(id)?.application.depends ?? []) if (!seen.has(next)) { seen.add(next); closure(next, seen); }
    return seen;
  };
  const registeredModels = new Map(definitions.flatMap(definition => definition.models.map(model => [model.contract.name, model] as const)));
  for (const definition of definitions) for (const model of definition.models) for (const [field, descriptor] of Object.entries(model.contract.many2manyFields)) {
    const target = registeredModels.get(descriptor.many2many.target);
    if (!target || (target.module !== definition.id && target.module !== nativeModule && !(definition.application.depends ?? []).includes(target.module))) throw new Error(`${model.id}.${field}: Many2many requiere un destino declarativo registrado y depends de su módulo.`);
  }
  for (const definition of definitions) for (const model of definition.models) for (const action of model.contract.actions) for (const [name, field] of Object.entries(action.params ?? {})) {
    if (field.kind !== "many2one") continue;
    const target = registeredModels.get(field.target);
    if (!target || (target.module !== definition.id && target.module !== nativeModule && !(definition.application.depends ?? []).includes(target.module))) throw new Error(`${model.id}.${action.name}.${name}: params Many2one requiere un destino declarativo registrado y depends de su módulo.`);
  }
  const byTarget = new Map<string, ModuleExtension[]>();
  for (const definition of definitions) {
    for (const extension of definition.extensions) {
      const [moduleId, key] = extension.target.split(".");
      const base = byId.get(moduleId);
      if (!base) throw new Error(`${definition.id}: extiende ${extension.target}, pero el módulo ${moduleId} no está registrado.`);
      const entry = base.models.find(model => model.key === key);
      if (!entry) throw new Error(`${definition.id}: el modelo ${extension.target} no existe.`);
      if (entry.declaration.model !== extension.extension.base) throw new Error(`${definition.id}: extendModel(...) de ${extension.target} debe recibir la clase registrada por ${moduleId}.`);
      if (base.models.some(parent => Object.values(parent.contract.one2manyFields).some(field => field.one2many.target === entry.contract.name))) throw new Error(`${definition.id}: ${extension.target} es línea One2many; extender líneas aún no está soportado.`);
      if (extension.many2many.length) {
        // Links live through the companion row, written by the declarative repository.
        if (entry.declaration.repository) throw new Error(`${definition.id}: ${extension.target} usa un repositorio propio; sus extensiones todavía no admiten Many2many.`);
        for (const [field, descriptor] of Object.entries(extensionMany2many(extension.extension))) {
          const target = registeredModels.get(descriptor.many2many.target);
          if (!target || (target.module !== definition.id && target.module !== nativeModule && !(definition.application.depends ?? []).includes(target.module))) throw new Error(`${definition.id} → ${extension.target}.${field}: Many2many requiere un destino declarativo registrado y depends de su módulo.`);
        }
      }
      byTarget.set(extension.target, [...(byTarget.get(extension.target) ?? []), extension]);
    }
  }
  if (!byTarget.size) return validateModuleTransfers(validateQuickCreate(validateModuleDomains(definitions)));
  const compose = (entry: ModuleModel): ModuleModel => {
    const extensions = byTarget.get(entry.id);
    if (!extensions) return entry;
    const ordered = [...extensions].sort((a, b) => depth(a.module) - depth(b.module) || a.module.localeCompare(b.module));
    const names = new Map<string, string>();
    for (const extension of ordered) {
      const fields = extensionFields(extension.extension);
      for (const name of [...[...extension.fields, ...extension.computed].flatMap(name => fields[name].metadata.kind === "many2one" ? [name, relationFieldName(name)] : [name]), ...extension.many2many]) {
        const owner = names.get(name);
        if (owner) throw new Error(`${entry.id}.${name}: lo declaran las extensiones de ${owner} y ${extension.module}.`);
        names.set(name, extension.module);
      }
    }
    const methodOwners = new Map<string, string>();
    const model = ordered.reduce((current, extension) => {
      const next = extension.extension.apply(current);
      for (const name of Object.getOwnPropertyNames(next.prototype)) methodOwners.set(name, extension.module);
      return next;
    }, entry.declaration.model);
    const compiled = compileModuleModel(entry.module, entry.key, { ...entry.declaration, model }, entry.label, ordered.map(extension => Object.freeze({
      module: extension.module, label: extension.label, fields: extension.fields, computed: extension.computed,
      ...(extension.views ? { views: extension.views } : {}),
      ...(extension.insertions ? { insertions: extension.insertions } : {}),
      ...(extension.many2many.length && extension.companion ? { many2many: Object.freeze(Object.entries(extensionMany2many(extension.extension)).map(([field, descriptor]) => Object.freeze({ field, source: many2manyStorage(extension.companion!, field).source, maximum: descriptor.many2many.maxSelected }))) } : {}),
      depends: Object.freeze([...closure(extension.module)].sort()),
      ...(extension.companion ? { relation: extension.companion.relation, delegate: extension.companion.name[0].toLowerCase() + extension.companion.name.slice(1) } : {}),
    })), byId.get(entry.module)?.native === true);
    if (Object.keys(compiled.contract.many2manyFields).length > 4) throw new Error(`${entry.id}: máximo cuatro relaciones Many2many, sumando el modelo base y sus extensiones.`);
    resolveFormView(compiled, "modal");
    for (const action of compiled.contract.actions) for (const [name, field] of Object.entries(action.params ?? {})) {
      if (field.kind !== "many2one") continue;
      const owner = methodOwners.get(action.name) ?? entry.module;
      const target = registeredModels.get(field.target);
      if (!target || (target.module !== owner && target.module !== nativeModule && !(byId.get(owner)?.application.depends ?? []).includes(target.module))) throw new Error(`${entry.id}.${action.name}.${name}: falta el destino o la dependencia de params Many2one.`);
    }
    // Local group names of extension actions belong to the declaring module, not the base.
    return Object.freeze({ ...compiled, contract: Object.freeze({ ...compiled.contract, actions: Object.freeze(compiled.contract.actions.map(action => Object.freeze({
      ...action, ...(action.groups ? { groups: Object.freeze(action.groups.map(group => group.includes(".") ? group : `${methodOwners.get(action.name) ?? entry.module}.${group}`)) } : {}),
    }))) }) });
  };
  return validateModuleTransfers(validateQuickCreate(validateModuleDomains(Object.freeze(definitions.map(definition => {
    const models = definition.models.map(compose);
    return models.every((model, index) => model === definition.models[index]) ? definition : Object.freeze({ ...definition, models: Object.freeze(models) });
  })))));
}

/**
 * Many2many with `create: true` creates target records from the selector text: the target must
 * be a declarative model with a public Text `name` and no other required value without a
 * default. Native targets (core.user) keep their own creation flows.
 */
function validateQuickCreate(definitions: readonly ModuleDefinition[]): readonly ModuleDefinition[] {
  const byName = new Map(definitions.flatMap(definition => definition.models.map(model => [model.contract.name, model] as const)));
  for (const definition of definitions) for (const model of definition.models) for (const [field, descriptor] of Object.entries(model.contract.many2manyFields)) {
    if (!descriptor.many2many.create) continue;
    const target = byName.get(descriptor.many2many.target);
    const where = `${model.id}.${field}`;
    if (!target || target.module === nativeModule) throw new Error(`${where}: create requiere un destino declarativo (no User).`);
    const metadata = target.metadata;
    const name = Object.hasOwn(metadata, "name") ? metadata.name : undefined;
    if (!name || name.kind !== "text" || name.sensitive || name.readOnly || name.compute || name.related || name.sequence) throw new Error(`${where}: create requiere que ${target.id} tenga un campo Text «name» editable.`);
    const missing = Object.entries(metadata).filter(([key, field]) => key !== "name" && field.required && field.defaultKind !== "literal" && !field.sequence && !field.compute && !field.related).map(([key]) => key);
    if (missing.length) throw new Error(`${where}: create sólo escribe el nombre; ${target.id} tiene obligatorios sin default: ${missing.join(", ")}.`);
  }
  return definitions;
}
