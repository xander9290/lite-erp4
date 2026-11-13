import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";
import { modules } from "@/modules";
import { AccessError } from "../auth/policy";
import type { ModelActor } from "../orm/context";
import { prisma } from "../prisma";
import { createModelService } from "../orm/service";
import { createModelImageSigner } from "../uploads/model-image.server";
import type { Many2OneLoader } from "../many2one/model-lookup";
import type { FieldMetadata } from "../orm/fields";
import { createRepository } from "./repository";
import { modelIdPattern, type ModelClientConfig } from "./config";
import type { ModuleDefinition, ModuleModel } from "./define";

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
const services = new Map<string, Service>();
const operationActor = new AsyncLocalStorage<ModelActor>();

/** Run a service operation with its authenticated actor available to nested label lookups. */
export function withActor<T>(actor: ModelActor, operation: () => Promise<T>) {
  return operationActor.run(actor, operation);
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
    if (entry.list.fields.includes(field)) relations[field] = async request => {
      const actor = operationActor.getStore();
      if (!actor) throw new AccessError("UNAUTHENTICATED");
      return modelService(target).lookup(prisma, actor, request);
    };
  }
  const service = createModelService(entry.contract, createRepository(entry, module.profile.module), {
    list: entry.list, audit: true, defaultSort: entry.defaultSort,
    ...(entry.kanban ? { kanban: { field: entry.kanban } } : {}),
    ...(Object.keys(relations).length ? { relations } : {}),
  });
  services.set(id, service);
  return service;
}

/** Many2one fields whose target is a registered module model. Manual models (Partner, User) need their own provider. */
function lookupTargets(entry: ModuleModel): Record<string, string> {
  const targets: Record<string, string> = {};
  for (const [field, metadata] of Object.entries(entry.metadata)) {
    if (metadata.kind !== "many2one" || metadata.sensitive) continue;
    const target = byPrismaName.get(metadata.target);
    if (target) targets[field] = target.id;
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
    // Session lookup is loaded on demand so the registry stays usable outside Next (scripts, tests).
    signer = createModelImageSigner({ authorize: async () => (await import("../auth/access")).requireAdmin() }, { metadata: found.entry.metadata }, images);
    signers.set(id, signer);
  }
  return signer;
}

export function modelClientConfig(id: string): ModelClientConfig {
  const found = getModuleModel(id);
  if (!found) throw new Error("MODEL_NOT_FOUND");
  const { module, entry } = found;
  const { contract } = entry;
  return {
    id: entry.id, module: module.id, moduleName: module.application.name, key: entry.key, name: contract.name, label: entry.label, route: entry.route,
    fields: Object.fromEntries(entry.clientFields.map(name => [name, entry.metadata[name]])),
    preview: Object.fromEntries(Object.entries((contract.previewFields ?? {}) as Readonly<Record<string, { metadata: FieldMetadata }>>).map(([name, field]) => [name, field.metadata])),
    related: Object.keys(contract.relatedFields ?? {}),
    reactionRules: contract.reactionRules ?? [],
    lookups: lookupTargets(entry),
    list: { fields: entry.list.fields, searchFields: entry.list.searchFields, sortable: entry.list.sortable ?? [], groupable: entry.list.groupable ?? [], filterable: entry.list.filterable ?? [] },
    view: entry.view,
    // Plain JSON: omit absent options instead of sending undefined.
    ...(entry.kanban ? { kanban: entry.kanban } : {}),
    ...(entry.defaultSort ? { defaultSort: entry.defaultSort } : {}),
  };
}
