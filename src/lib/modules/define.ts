import "server-only";
import type { ComponentType } from "react";
import { availableCollectionViews, collectionFieldMetadata, collectionViews, modelIdPattern, type CollectionView, type ModelClientConfig } from "./config";
import { defineApplication, type ApplicationManifest, type ApplicationMenu, type ApplicationMenuLink } from "../applications/manifest";
import { defineModel, Model } from "../orm/model";
import { Fields, type Field, type FieldMetadata } from "../orm/fields";
import { validateCollectionComputed } from "../orm/collection-computed";
import type { ModelListPolicy } from "../orm/service";
import type { GenerationModel } from "../orm/generator/generate";
import type { GenerationProfile } from "../orm/generator/profile";
import type { ListViewConfig } from "../list/types";
import { declareAccess, readGroups, type AccessSpec, type ModuleAccess } from "../access/declare";
import { compileKanbanConfig } from "../kanban/config";
import type { KanbanConfig, KanbanTransition } from "../kanban/types";
import { auditCollectionFields, defaultAuditFields } from "../orm/audit";
import type { NativeRepositoryOptions } from "./repository";
import { MAX_LINE_DEPTH } from "../orm/one2many";
import { declaredNames, extensionFields, extensionMany2many, isModelExtension, type ModelExtension } from "./extend";
import { relationFieldName } from "../orm/display";
import type { CollectionDomain } from "../orm/domain";
import { validateTransferSpec, type TransferSpec } from "../list/transfer-contract";
import { decoratedMethods } from "../orm/decorators";

type ModelClass = new () => Model;
export type ModuleModelSpec = ModelClass | {
  readonly model: ModelClass;
  /** Explicit transfer contract; only exposed by the standard ListView. */
  readonly transfer?: TransferSpec;
  /** Server source shared by list/card/kanban; never changes record access. */
  readonly domain?: CollectionDomain;
  /** Snake-case table override; defaults to `<module>_<key>`. */
  readonly table?: string;
  /**
   * Native modules only: existing Prisma model name (`Partner`) instead of `<Module><Key>`.
   * Its schema stays hand-written infrastructure; the framework adapts to it.
   */
  readonly name?: string;
  /** Native modules only: route of the application that presents the model (e.g. Ajustes). */
  readonly route?: `/erp/${string}`;
  /**
   * Native modules only (Odoo _inherits): fields stored in a 1:1 related record of another
   * native model, read and written in the same statement (User → its Partner).
   */
  readonly inherits?: { readonly relation: string; readonly label: string; readonly fields: readonly string[] };
  /** Native modules only: secrets, system columns and update side effects of the adapter. */
  readonly repository?: NativeRepositoryOptions;
  /** Override of the list policy derived from Field metadata. */
  readonly list?: Partial<ModelListPolicy>;
  readonly kanban?: string | KanbanConfig;
  readonly view?: CollectionView;
  readonly defaultSort?: ListViewConfig["defaultSort"];
  /**
   * Publish audit columns in collections: «Creado por» (createBy: name label, filter and
   * grouping by creator), «Creado el» and «Actualizado el» (sortable, filterable). They take 3 of
   * the 12 published columns; `createByUser.partner.name` may be added to sort by name.
   */
  readonly audit?: boolean;
  /** Custom views (eject). Without them the default list/form are used. */
  readonly views?: ModelViews;
};
export type ModuleModelOptions = Exclude<ModuleModelSpec, ModelClass>;
export type ModelFormView = ComponentType<{ config: ModelClientConfig; id?: string }>;
export type ModelListView = ComponentType<{ config: ModelClientConfig }>;
/** Insertion files of an extension, one per view of the base model (`<Inserter>`). */
export const insertionViewKinds = ["form", "modal", "list", "card", "kanban"] as const;
export type InsertionViewKind = (typeof insertionViewKinds)[number];
export type ModelInsertions = { readonly [K in InsertionViewKind]?: () => Promise<{ default: ModelListView }> };
export type ExtensionViews = {
  /** Content block inside the page form. */
  readonly form?: () => Promise<{ default: ModelListView }>;
  /** Complete independent form layout, used only in dialogs. */
  readonly modal?: () => Promise<{ default: ModelFormView }>;
};
export type ModuleExtensionSpec = ModelExtension | {
  readonly model: ModelExtension;
  readonly views?: ExtensionViews;
  /**
   * Insertions into the base form (`<Inserter target position>`), instead of a whole block.
   * Exclusive with `views.form`. Design: docs/ideas/inserciones-vistas.md.
   */
  readonly insertions?: ModelInsertions;
};
/**
 * Lazy loaders (`() => import("./views/TareaForm")`): views are client components, and a
 * static import would load React into scripts such as orm:sync that read the manifest.
 */
export type ModelViews = {
  readonly form?: () => Promise<{ default: ModelFormView }>;
  readonly modal?: () => Promise<{ default: ModelFormView }>;
  readonly list?: true | (() => Promise<{ default: ModelListView }>);
  readonly card?: true | (() => Promise<{ default: ModelListView }>);
  readonly kanban?: true | (() => Promise<{ default: ModelListView }>);
};
/** Menu entries reference model keys; nested objects create one group level. */
export type ModuleMenu = Readonly<Record<string, string | Readonly<Record<string, string>>>>;

export type ModuleSpec = {
  readonly id: string;
  readonly name: string;
  readonly description?: string;
  readonly version?: string;
  /** Lucide icon name, e.g. "flask-conical". Resolved by the server registry, not by scripts. */
  readonly icon: string;
  readonly depends?: readonly string[];
  readonly models: Readonly<Record<string, ModuleModelSpec>>;
  /** Models of other modules extended by this one: `{ "flota.vehicle": extendModel(Vehicle, ...) }`. */
  readonly extends?: Readonly<Record<string, ModuleExtensionSpec>>;
  readonly menu?: ModuleMenu;
  /**
   * Framework infrastructure (`core`): always registered, never listed in the app drawer,
   * never installed/uninstalled by the module manager, over hand-written schema files.
   */
  readonly native?: boolean;
  /**
   * Card in the application drawer (default true). `false` keeps routes, navigation, links from
   * other applications and permissions; e.g. a catalog administered from another application.
   */
  readonly drawer?: boolean;
} & AccessSpec;

/** Server-side compiled extension; modelClientConfig publishes only its names and label. */
export type ModelExtensionInfo = {
  readonly module: string;
  readonly label: string;
  /** Persistent fields stored in the companion table. */
  readonly fields: readonly string[];
  /** Virtual compute/related fields declared by the extension. */
  readonly computed: readonly string[];
  readonly views?: ExtensionViews;
  readonly insertions?: ModelInsertions;
  /** Transitive dependencies of the extending module (insertion order and published targets). */
  readonly depends?: readonly string[];
  /** Many2many of the extension: field and relation (on the companion model) of its links. */
  readonly many2many?: readonly { readonly field: string; readonly source: string; readonly maximum: number }[];
  /** Prisma relation (on the base model) to the companion row; absent without persistent fields. */
  readonly relation?: string;
  /** Delegated storage of a native model (no creator column; the foreign key is on the base). */
  readonly inherits?: true;
  readonly delegate?: string;
};

/** Compiled declaration of a model extension; the registry composes it onto the base model. */
export type ModuleExtension = {
  /** Extended model id (`<module>.<key>`). */
  readonly target: string;
  readonly module: string;
  readonly label: string;
  readonly extension: ModelExtension;
  readonly fields: readonly string[];
  readonly computed: readonly string[];
  /** Many2many declared by the extension (links stored through the companion row). */
  readonly many2many: readonly string[];
  readonly views?: ExtensionViews;
  readonly insertions?: ModelInsertions;
  readonly companion?: { readonly name: string; readonly table: string; readonly relation: string };
};

export type ModuleModel = {
  /** Public identifier used by actions and routes: `<module>.<key>`. */
  readonly id: string;
  readonly key: string;
  readonly module: string;
  readonly route: `/erp/${string}`;
  readonly label: string;
  readonly delegate: string;
  readonly contract: ReturnType<typeof defineModel<ModelClass>>;
  /** Same as contract.metadata, typed for generic code. */
  readonly metadata: Readonly<Record<string, FieldMetadata>>;
  readonly clientFields: readonly string[];
  readonly list: ModelListPolicy;
  readonly kanban?: string;
  readonly kanbanTransitions?: readonly KanbanTransition[];
  readonly view: CollectionView;
  readonly collectionViews: readonly CollectionView[];
  readonly defaultSort?: ListViewConfig["defaultSort"];
  readonly views: ModelViews;
  /** Original manifest declaration, recompiled by the registry when other modules extend it. */
  readonly declaration: ModuleModelOptions;
  /** Extensions composed onto this model by the registry (empty in the declaring module). */
  readonly extensions: readonly ModelExtensionInfo[];
};

export type ModuleDefinition = {
  readonly id: string;
  /** Application metadata without the icon component (see registry). */
  readonly application: Omit<ApplicationManifest, "icon">;
  readonly icon: string;
  readonly models: readonly ModuleModel[];
  readonly profile: GenerationProfile;
  readonly access: ModuleAccess;
  readonly extensions: readonly ModuleExtension[];
  /** Infrastructure module over hand-written schema (no app tile, no install, no creator column). */
  readonly native: boolean;
};

const key = /^[a-z][a-z0-9]*$/;
/** Native framework module (Partner/User): always present, an implicit dependency of every module. */
export const nativeModule = "core";
/** Prisma names of the native models (hand-written schema), for links from other modules. */
export const nativeModelNames: Readonly<Record<string, string>> = { "core.partner": "Partner", "core.user": "User" };
const pascal = (value: string) => value.split("-").map(part => part[0].toUpperCase() + part.slice(1)).join("");
const lowerFirst = (value: string) => value[0].toLowerCase() + value.slice(1);
const scalar = (field: FieldMetadata) => field.kind !== "image";
/** Link from a companion row to its base record; its relation alias is `record`. */
export const companionLink = "recordId";
const reservedExtensionNames = new Set([companionLink, "record", "id", "revision", "createdAt", "updatedAt", "createBy", "createByUser"]);

/**
 * List policy from Field options (`list`, `searchable`, `sortable`, `filterable`, `groupable`),
 * with conventions for undeclared options. A manifest `list` override still wins. The server
 * service validates and fixes the result; nothing here comes from the browser.
 */
export function derivedListPolicy(metadata: Readonly<Record<string, FieldMetadata>>, override: Partial<ModelListPolicy> = {}, limit = 12): ModelListPolicy {
  const visible = Object.entries(metadata).filter(([, field]) => !field.sensitive);
  const fields = override.fields ?? visible.filter(([, field]) => field.list ?? true).slice(0, limit).map(([name]) => name);
  const published = (name: string) => fields.includes(name);
  for (const [name, field] of visible) {
    if (!published(name) && (field.searchable || field.sortable || field.filterable || field.groupable)) throw new Error(`${name}: un campo fuera de la lista no puede buscarse, ordenarse, filtrarse ni agruparse. Quita list: false o esas opciones.`);
  }
  for (const capability of ["searchFields", "sortable", "filterable", "groupable"] as const) {
    if (override[capability]?.some(name => metadata[name]?.readOnly)) throw new Error(`Los campos related son de lectura: no se permiten en ${capability}.`);
  }
  const texts = visible.filter(([name, field]) => field.kind === "text" && !field.readOnly && published(name)).map(([name]) => name);
  const declaredSearch = visible.some(([, field]) => field.searchable !== undefined);
  const pick = (test: (field: FieldMetadata) => boolean) => visible.filter(([name, field]) => published(name) && !field.readOnly && test(field)).map(([name]) => name);
  return {
    fields,
    searchFields: override.searchFields ?? (declaredSearch ? pick(field => field.searchable === true) : texts.includes("name") ? ["name"] : texts.slice(0, 1)),
    sortable: override.sortable ?? pick(field => field.sortable ?? scalar(field)),
    filterable: override.filterable ?? pick(field => field.filterable ?? scalar(field)),
    groupable: override.groupable ?? pick(field => field.groupable ?? ["boolean", "selection", "many2one"].includes(field.kind)),
  };
}

function menuLabel(menu: ModuleMenu | undefined, modelKey: string) {
  for (const [label, value] of Object.entries(menu ?? {})) {
    if (value === modelKey) return label;
    if (typeof value === "object") for (const [child, target] of Object.entries(value)) if (target === modelKey) return child;
  }
  return modelKey[0].toUpperCase() + modelKey.slice(1);
}

/**
 * List policy with the opt-in audit columns. Without `list.fields`, the derived fields leave
 * room for them (9 + 3); an explicit `list.fields` may place them, only with `audit: true`.
 */
function auditListPolicy(model: string, metadata: Readonly<Record<string, FieldMetadata>>, options: ModuleModelOptions): ModelListPolicy {
  const override = options.list ?? {};
  const named = [override.fields, override.searchFields, override.sortable, override.filterable, override.groupable].flatMap(names => names ?? []);
  if (!options.audit) {
    if (named.some(name => auditCollectionFields.includes(name))) throw new Error(`${model}: las columnas de auditoría requieren audit: true en el manifest.`);
    return derivedListPolicy(metadata, override);
  }
  if (override.searchFields?.some(name => auditCollectionFields.includes(name)) || override.groupable?.some(name => auditCollectionFields.includes(name) && name !== "createBy")) throw new Error(`${model}: la auditoría no se busca; sólo «Creado por» (createBy) se agrupa.`);
  if (override.sortable?.includes("createBy")) throw new Error(`${model}: createBy se ordena con la columna createByUser.partner.name.`);
  const base = derivedListPolicy(metadata, Object.fromEntries(Object.entries(override).map(([key, names]) => [key, (names as readonly string[]).filter(name => !auditCollectionFields.includes(name))])), 12 - defaultAuditFields.length);
  const fields = override.fields ?? [...base.fields, ...defaultAuditFields];
  const audit = auditCollectionFields.filter(name => fields.includes(name));
  return {
    ...base, fields,
    sortable: override.sortable ?? [...(base.sortable ?? []), ...audit.filter(name => name !== "createBy")],
    filterable: override.filterable ?? [...(base.filterable ?? []), ...audit],
    groupable: override.groupable ?? [...(base.groupable ?? []), ...audit.filter(name => name === "createBy")],
  };
}

/**
 * Compile one manifest model. The registry calls it again with the composed class when other
 * modules extend the model; collection capabilities still come only from server metadata.
 */
export function compileModuleModel(id: string, modelKey: string, options: ModuleModelOptions, label: string, extensions: readonly ModelExtensionInfo[] = [], native = false): ModuleModel {
  if (options.domain !== undefined && typeof options.domain !== "function") throw new Error("domain requiere un constructor de dominio.");
  if (!native && (options.name !== undefined || options.route !== undefined || options.inherits !== undefined || options.repository !== undefined)) throw new Error(`${id}.${modelKey}: name, route, inherits y repository sólo se declaran en módulos nativos.`);
  if (options.name !== undefined && !/^[A-Z][A-Za-z0-9]*$/.test(options.name)) throw new Error(`${id}.${modelKey}: name debe ser un modelo Prisma PascalCase.`);
  if (options.route !== undefined && !/^\/erp(?:\/[a-z][a-z0-9-]*)+$/.test(options.route)) throw new Error(`${id}.${modelKey}: route debe ser /erp/<ruta>.`);
  const name = options.name ?? `${pascal(id)}${pascal(modelKey)}`;
  const contract = defineModel(options.model, { name, table: options.table ?? `${id}_${modelKey}` });
  const clientFields = Object.keys(contract.metadata);
  if (options.inherits) {
    const { relation, label, fields } = options.inherits;
    if (!/^[a-z][A-Za-z0-9]*$/.test(relation) || !fields.length || fields.some(field => !Object.hasOwn(contract.metadata, field))) throw new Error(`${id}.${modelKey}: inherits necesita una relación y campos declarados en el modelo.`);
    if (fields.some(field => (contract.metadata as Readonly<Record<string, FieldMetadata>>)[field].groupable)) throw new Error(`${id}.${modelKey}: los campos delegados no se agrupan.`);
    // The delegated record comes first: later module extensions are composed after it.
    extensions = [Object.freeze({ module: id, label, fields: Object.freeze([...fields]), computed: Object.freeze([]), relation, inherits: true as const }), ...extensions];
  }
  const collectionMetadata = collectionFieldMetadata({
    fields: contract.metadata as Readonly<Record<string, FieldMetadata>>,
    preview: Object.fromEntries(Object.entries({ ...contract.relatedFields, ...contract.computedFields }).map(([field, value]) => [field, value.metadata])),
    related: Object.keys(contract.relatedFields),
  });
  const list = auditListPolicy(`${id}.${modelKey}`, collectionMetadata, options);
  if (options.transfer) validateTransferSpec(options.transfer, { ...contract, clientFields, listFields: list.fields, customRepository: Boolean(options.repository) });
  validateCollectionComputed(contract, list.fields.filter(field => Object.hasOwn(contract.computedFields, field)), list.fields);
  const kanban = compileKanbanConfig(options.kanban, contract.metadata, contract.actions, list.fields);
  const view = options.view ?? "list";
  if (!collectionViews.includes(view)) throw new Error(`${id}.${modelKey}: vista de lista inválida.`);
  for (const [kind, loader] of Object.entries(options.views ?? {})) {
    if (loader === undefined) continue;
    if (![...collectionViews, "form", "modal"].includes(kind) || (typeof loader !== "function" && !(collectionViews.includes(kind as CollectionView) && loader === true))) throw new Error(`${id}.${modelKey}: registro de vista inválido: ${kind}.`);
  }
  const presentations = availableCollectionViews(view, options.views ?? {}, Boolean(kanban));
  return Object.freeze({
    id: `${id}.${modelKey}`, key: modelKey, module: id, route: options.route ?? `/erp/${id}/${modelKey}` as const,
    label, delegate: lowerFirst(name),
    contract, metadata: contract.metadata as Readonly<Record<string, FieldMetadata>>, clientFields, list, kanban: kanban?.field,
    ...(kanban?.transitions !== undefined ? {kanbanTransitions:kanban.transitions} : {}),
    view, collectionViews: presentations, defaultSort: options.defaultSort, views: options.views ?? {},
    declaration: options, extensions: Object.freeze([...extensions]),
  });
}

/**
 * Validate the `extends` declarations of a module and build one companion model per extension
 * with persistent fields: `<Module><Base><Key>` with a unique, required link to the base record
 * (deleted with it). The companion has no routes, menus, access or service of its own.
 */
function compileExtensions(spec: ModuleSpec): { extensions: ModuleExtension[]; companions: GenerationModel[] } {
  const { id } = spec;
  const extensions: ModuleExtension[] = [];
  const companions: GenerationModel[] = [];
  for (const [target, declaration] of Object.entries(spec.extends ?? {})) {
    const extension = isModelExtension(declaration) ? declaration : declaration?.model;
    const views = isModelExtension(declaration) ? undefined : declaration?.views;
    const insertions = isModelExtension(declaration) ? undefined : declaration?.insertions;
    if (views && Object.entries(views).some(([kind, loader]) => !["form", "modal"].includes(kind) || typeof loader !== "function")) throw new Error(`${id}: la extensión sólo registra views.form o views.modal con un loader diferido.`);
    if (insertions && (!Object.keys(insertions).length || Object.entries(insertions).some(([kind, loader]) => !(insertionViewKinds as readonly string[]).includes(kind) || typeof loader !== "function"))) throw new Error(`${id}: insertions sólo registra form, modal, list, card o kanban con un loader diferido (() => import("./views/...")).`);
    if (insertions?.form && views?.form) throw new Error(`${id}: ${target} declara views.form e insertions.form; usa sólo uno.`);
    if (!modelIdPattern.test(target)) throw new Error(`${id}: extends usa identificadores <módulo>.<modelo>: ${target}.`);
    const [baseModule, baseKey] = target.split(".");
    if (baseModule === id) throw new Error(`${id}: un módulo no extiende sus propios modelos; decláralos directamente.`);
    if (baseModule !== nativeModule && !(spec.depends ?? []).includes(baseModule)) throw new Error(`${id}: declara depends: ["${baseModule}"] para extender ${target}.`);
    if (!isModelExtension(extension)) throw new Error(`${id}: ${target} debe declararse con extendModel(...).`);
    const fields = extensionFields(extension);
    const many = extensionMany2many(extension);
    const baseNames = declaredNames(extension.base);
    for (const name of Object.keys(many)) {
      const where = `${id} → ${target}.${name}`;
      if (!/^[a-z][A-Za-z0-9]*$/.test(name) || reservedExtensionNames.has(name)) throw new Error(`${where}: nombre de campo inválido o reservado.`);
      if (baseNames.has(name)) throw new Error(`${where}: el modelo base ya declara ese nombre.`);
    }
    for (const [name, field] of Object.entries(fields)) {
      const where = `${id} → ${target}.${name}`;
      if (!/^[a-z][A-Za-z0-9]*$/.test(name) || reservedExtensionNames.has(name)) throw new Error(`${where}: nombre de campo inválido o reservado.`);
      if (baseNames.has(name)) throw new Error(`${where}: el modelo base ya declara ese nombre.`);
      const metadata = field.metadata;
      if (metadata.kind === "many2one" && (baseNames.has(relationFieldName(name)) || Object.hasOwn(fields, relationFieldName(name)) || reservedExtensionNames.has(relationFieldName(name)))) throw new Error(`${where}: el alias relacional ya está declarado o reservado.`);
      if (metadata.sensitive) throw new Error(`${where}: una extensión no declara campos sensitive.`);
      if (metadata.unique && (metadata.required || metadata.defaultKind !== "empty")) throw new Error(`${where}: unique en extensiones requiere un campo opcional sin default.`);
      if (!metadata.compute && !metadata.related && metadata.required && metadata.defaultKind !== "literal") throw new Error(`${where}: un campo obligatorio de una extensión necesita default (los registros existentes no tienen valor).`);
    }
    const persistent = Object.keys(fields).filter(name => !fields[name].metadata.compute && !fields[name].metadata.related);
    const computed = Object.keys(fields).filter(name => fields[name].metadata.compute || fields[name].metadata.related);
    if (!persistent.length && !Object.keys(many).length) throw new Error(`${id}: la extensión de ${target} necesita al menos un campo persistente o Many2many.`);
    let companion: ModuleExtension["companion"];
    {
      const name = `${pascal(id)}${pascal(baseModule)}${pascal(baseKey)}`;
      const table = `${id}_${baseModule}_${baseKey}`;
      const actionModel = nativeModelNames[target] ?? `${pascal(baseModule)}${pascal(baseKey)}`;
      const link = Fields.Many2one(actionModel, { label: "Registro", required: true, unique: true });
      // Internal policy: the companion row belongs to its base record and goes with it.
      const cascade = Object.freeze({ ...link, metadata: Object.freeze({ ...link.metadata, onDelete: "Cascade" as const }) }) as Field;
      // Many2many links reference the companion row: the generator creates their table here.
      const own = Object.fromEntries([[companionLink, cascade], ...persistent.map(field => [field, fields[field]]), ...Object.entries(many)]);
      class Companion extends Model { constructor() { super(); Object.assign(this, own); } }
      const contract = defineModel(Companion, { name, table });
      const Extended = extension.apply(extension.base);
      const actions = decoratedMethods(new Extended()).actions.map(action => action.method);
      companions.push({ model: contract, clientFields: Object.keys(contract.metadata), ...(actions.length ? { actionReferences: { model: actionModel, names: actions } } : {}) });
      companion = Object.freeze({ name, table, relation: `${lowerFirst(name)}${pascal(companionLink)}Records` });
    }
    extensions.push(Object.freeze({ target, module: id, label: spec.name, extension, fields: Object.freeze(persistent), computed: Object.freeze(computed), many2many: Object.freeze(Object.keys(many)), ...(views ? { views } : {}), ...(insertions ? { insertions } : {}), ...(companion ? { companion } : {}) }));
  }
  return { extensions, companions };
}

/** Trusted static declaration of a module: models, menu and conventions. Never exposed to the browser. */
export function defineModule(spec: ModuleSpec): ModuleDefinition {
  const id = spec.id;
  if (!spec.native && id === nativeModule) throw new Error(`${nativeModule} es el módulo nativo del framework; elige otro identificador.`);
  if ((spec.depends ?? []).includes(nativeModule)) throw new Error(`${id}: ${nativeModule} es implícito; no lo declares en depends.`);
  if (!/^[a-z][a-z0-9]*$/.test(id)) throw new Error(`Identificador de módulo inválido: ${id}. Usa minúsculas sin guiones.`);
  const entries = Object.entries(spec.models);
  const models: ModuleModel[] = entries.map(([modelKey, declaration]) => {
    if (!key.test(modelKey) || modelKey === "nuevo") throw new Error(`${id}: clave de modelo inválida o reservada: ${modelKey}.`);
    return compileModuleModel(id, modelKey, typeof declaration === "function" ? { model: declaration } : declaration, menuLabel(spec.menu, modelKey), [], spec.native === true);
  });
  if (spec.native && (spec.menu || spec.extends)) throw new Error(`${id}: un módulo nativo no declara menús ni extensiones; lo presentan otras aplicaciones.`);
  const { extensions, companions } = compileExtensions(spec);
  const inverses = new Set<string>();
  const children = new Set<string>();
  for (const parent of models) {
    const declarations = Object.entries(parent.contract.one2manyFields);
    if (declarations.length > 4) throw new Error(`${parent.id}: máximo cuatro relaciones One2many.`);
    for (const [name, field] of declarations) {
      const { target, inverse } = field.one2many;
      const child = models.find(model => model.contract.name === target);
      const foreign = child?.metadata[inverse];
      if (!child || child === parent || Object.keys(child.contract.many2manyFields).length || foreign?.kind !== "many2one" || foreign.target !== parent.contract.name || !foreign.required || foreign.unique || foreign.onDelete !== "Restrict" || Object.values(child.metadata).some(field => field.sensitive)) throw new Error(`${parent.id}.${name}: One2many requiere un hijo del mismo módulo sin Many2many/sensitive y un Many2one inverso obligatorio, no único, con Restrict.`);
      const key = `${target}.${inverse}`;
      if (inverses.has(key)) throw new Error(`${key}: una inversa sólo puede pertenecer a una declaración One2many.`);
      inverses.add(key);
      if (children.has(target)) throw new Error(`${target}: un hijo sólo puede pertenecer a una relación One2many declarativa.`);
      children.add(target);
    }
  }
  // Read-only relations: children of the same module whose Many2one points to this model.
  for (const parent of models) for (const [name, collection] of Object.entries(parent.contract.childCollections)) {
    const child = models.find(model => model.contract.name === collection.target);
    const inverse = child?.metadata[collection.inverse];
    if (!child || child === parent || inverse?.kind !== "many2one" || inverse.target !== parent.contract.name || inverse.sensitive) throw new Error(`${parent.id}.${name}: la relación de consulta requiere un modelo del mismo módulo con un Many2one ${collection.inverse} hacia ${parent.contract.name}.`);
  }
  for (const model of models) if (Object.keys(model.contract.many2manyFields).length > 4) throw new Error(`${model.id}: máximo cuatro relaciones Many2many.`);
  // Nested lines: document → line → sub-line at most, without cycles (each child has one owner).
  const childrenOf = (model: ModuleModel) => Object.values(model.contract.one2manyFields).map(field => models.find(candidate => candidate.contract.name === field.one2many.target)!);
  const depth = (model: ModuleModel, path: readonly string[] = []): number => {
    if (path.includes(model.id)) throw new Error(`${[...path, model.id].join(" → ")}: las líneas forman un ciclo.`);
    const nested = childrenOf(model);
    return 1 + (nested.length ? Math.max(...nested.map(child => depth(child, [...path, model.id]))) : 0);
  };
  // depth() runs for every model so a cycle without a root is also rejected.
  for (const model of models) if (depth(model) > MAX_LINE_DEPTH && !children.has(model.contract.name)) throw new Error(`${model.id}: las líneas admiten hasta ${MAX_LINE_DEPTH} niveles (documento → línea → sublínea).`);
  const byKey = new Map(models.map(model => [model.key, model]));
  const ruleTargets = Object.fromEntries(extensions.map(extension => {
    const metadata = defineModel(extension.extension.apply(extension.extension.base), { name: "ExtensionRules", table: "extension_rules" }).metadata as Readonly<Record<string, FieldMetadata>>;
    return [extension.target, Object.fromEntries(Object.entries(metadata).map(([name, field]) => [name, extension.fields.includes(name) ? { ...field, required: false } : field]))];
  }));
  const access = declareAccess(id, spec, Object.fromEntries(models.map(model => [model.key, model.metadata])), ruleTargets);
  // Without groups the module stays admin-only (superuser), as before access control existed.
  const grouped = access.groups.length > 0;
  const visibility = (groups: readonly string[]) => grouped ? { access: "authenticated" as const, groups } : { access: "admin" as const };
  const link = (label: string, target: string): ApplicationMenuLink => {
    const model = byKey.get(target);
    if (!model) throw new Error(`${id}: el menú «${label}» apunta a un modelo inexistente: ${target}.`);
    return { id: `${target}-list`, label, href: model.route, model: model.id, ...visibility(readGroups(access, model.id)) };
  };
  const menus: ApplicationMenu[] = Object.entries(spec.native ? {} : spec.menu ?? Object.fromEntries(models.map(model => [model.label, model.key])))
    .map(([label, value]) => {
      if (typeof value === "string") return link(label, value);
      const items = Object.entries(value).map(([child, target]) => link(child, target));
      return { id: `${label.normalize("NFD").replace(/\p{Mn}/gu, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "grupo"}-group`, label,
        ...visibility([...new Set(items.flatMap(item => item.groups ?? []))]), items };
    });
  if (typeof spec.icon !== "string" || !/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(spec.icon)) throw new Error(`${id}: usa el nombre de un icono Lucide, por ejemplo "flask-conical".`);
  const application = {
    id, name: spec.name, description: spec.description ?? `Aplicación ${spec.name}.`, version: spec.version ?? "0.1.0",
    ...visibility(access.groups.map(group => group.id)), depends: spec.depends ?? [], models: models.map(model => model.contract.name), accessModels: models.map(model => model.id), menus,
    ...(spec.drawer !== undefined ? { drawer: spec.drawer } : {}),
  };
  // Validate ids, menus and dependencies now; the icon component is attached by the registry.
  defineApplication({ ...application, icon: (() => null) as unknown as ApplicationManifest["icon"] });
  const profile: GenerationProfile = {
    module: { id, depends: spec.depends ?? [], models: [...models.map(model => ({ model: model.contract, clientFields: model.clientFields })), ...companions] },
    externalOwners: {}, runtime: true,
  };
  return Object.freeze({ id, application, icon: spec.icon, models: Object.freeze(models), profile, access, extensions: Object.freeze(extensions), native: spec.native === true });
}
