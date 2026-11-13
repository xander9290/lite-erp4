import "server-only";
import type { ComponentType } from "react";
import type { ModelClientConfig } from "./config";
import { defineApplication, type ApplicationManifest, type ApplicationMenu, type ApplicationMenuLink } from "../applications/manifest";
import { defineModel, type Model } from "../orm/model";
import type { FieldMetadata } from "../orm/fields";
import type { ModelListPolicy } from "../orm/service";
import type { GenerationProfile } from "../orm/generator/profile";
import type { ListViewConfig } from "../list/types";

type ModelClass = new () => Model;
export type ModuleModelSpec = ModelClass | {
  readonly model: ModelClass;
  /** Snake-case table override; defaults to `<module>_<key>`. */
  readonly table?: string;
  /** Override of the list policy derived from Field metadata. */
  readonly list?: Partial<ModelListPolicy>;
  readonly kanban?: string;
  readonly view?: "list" | "card";
  readonly defaultSort?: ListViewConfig["defaultSort"];
  /** Custom views (eject). Without them the default list/form are used. */
  readonly views?: ModelViews;
};
export type ModelViews = {
  readonly form?: ComponentType<{ config: ModelClientConfig; id?: string }>;
  readonly list?: ComponentType<{ config: ModelClientConfig }>;
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
  readonly menu?: ModuleMenu;
};

export type ModuleModel = {
  /** Public identifier used by actions and routes: `<module>.<key>`. */
  readonly id: string;
  readonly key: string;
  readonly module: string;
  readonly route: `/erp/${string}`;
  readonly label: string;
  readonly delegate: string;
  readonly contract: ReturnType<typeof defineModel>;
  /** Same as contract.metadata, typed for generic code. */
  readonly metadata: Readonly<Record<string, FieldMetadata>>;
  readonly clientFields: readonly string[];
  readonly list: ModelListPolicy;
  readonly kanban?: string;
  readonly view: "list" | "card";
  readonly defaultSort?: ListViewConfig["defaultSort"];
  readonly views: ModelViews;
};

export type ModuleDefinition = {
  readonly id: string;
  /** Application metadata without the icon component (see registry). */
  readonly application: Omit<ApplicationManifest, "icon">;
  readonly icon: string;
  readonly models: readonly ModuleModel[];
  readonly profile: GenerationProfile;
};

const key = /^[a-z][a-z0-9]*$/;
const pascal = (value: string) => value.split("-").map(part => part[0].toUpperCase() + part.slice(1)).join("");
const scalar = (field: FieldMetadata) => field.kind !== "image";

/** Default list policy from Field metadata. The service still validates and fixes it on the server. */
export function derivedListPolicy(metadata: Readonly<Record<string, FieldMetadata>>, override: Partial<ModelListPolicy> = {}): ModelListPolicy {
  const visible = Object.entries(metadata).filter(([, field]) => !field.sensitive);
  const fields = override.fields ?? visible.slice(0, 12).map(([name]) => name);
  const published = (name: string) => fields.includes(name);
  const texts = visible.filter(([name, field]) => field.kind === "text" && published(name)).map(([name]) => name);
  return {
    fields,
    searchFields: override.searchFields ?? (texts.includes("name") ? ["name"] : texts.slice(0, 1)),
    sortable: override.sortable ?? visible.filter(([name, field]) => published(name) && scalar(field)).map(([name]) => name),
    filterable: override.filterable ?? visible.filter(([name, field]) => published(name) && scalar(field)).map(([name]) => name),
    groupable: override.groupable ?? visible.filter(([name, field]) => published(name) && ["boolean", "selection", "many2one"].includes(field.kind)).map(([name]) => name),
  };
}

function menuLabel(menu: ModuleMenu | undefined, modelKey: string) {
  for (const [label, value] of Object.entries(menu ?? {})) {
    if (value === modelKey) return label;
    if (typeof value === "object") for (const [child, target] of Object.entries(value)) if (target === modelKey) return child;
  }
  return modelKey[0].toUpperCase() + modelKey.slice(1);
}

/** Trusted static declaration of a module: models, menu and conventions. Never exposed to the browser. */
export function defineModule(spec: ModuleSpec): ModuleDefinition {
  const id = spec.id;
  if (!/^[a-z][a-z0-9]*$/.test(id)) throw new Error(`Identificador de módulo inválido: ${id}. Usa minúsculas sin guiones.`);
  const entries = Object.entries(spec.models);
  if (!entries.length) throw new Error(`El módulo ${id} necesita al menos un modelo.`);
  const models: ModuleModel[] = entries.map(([modelKey, declaration]) => {
    if (!key.test(modelKey) || modelKey === "nuevo") throw new Error(`${id}: clave de modelo inválida o reservada: ${modelKey}.`);
    const options = typeof declaration === "function" ? { model: declaration } : declaration;
    const name = `${pascal(id)}${pascal(modelKey)}`;
    const contract = defineModel(options.model, { name, table: options.table ?? `${id}_${modelKey}` });
    const clientFields = Object.keys(contract.metadata);
    const list = derivedListPolicy(contract.metadata, options.list);
    const view = options.view ?? "list";
    if (!["list", "card"].includes(view)) throw new Error(`${id}.${modelKey}: vista de lista inválida.`);
    return Object.freeze({
      id: `${id}.${modelKey}`, key: modelKey, module: id, route: `/erp/${id}/${modelKey}` as const,
      label: menuLabel(spec.menu, modelKey), delegate: name[0].toLowerCase() + name.slice(1),
      contract, metadata: contract.metadata as Readonly<Record<string, FieldMetadata>>, clientFields, list, kanban: options.kanban, view, defaultSort: options.defaultSort, views: options.views ?? {},
    });
  });
  const byKey = new Map(models.map(model => [model.key, model]));
  const link = (label: string, target: string): ApplicationMenuLink => {
    const model = byKey.get(target);
    if (!model) throw new Error(`${id}: el menú «${label}» apunta a un modelo inexistente: ${target}.`);
    return { id: `${target}-list`, label, href: model.route, access: "admin" };
  };
  const menus: ApplicationMenu[] = Object.entries(spec.menu ?? Object.fromEntries(models.map(model => [model.label, model.key])))
    .map(([label, value]) => typeof value === "string" ? link(label, value)
      : { id: `${label.normalize("NFD").replace(/\p{Mn}/gu, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "grupo"}-group`, label, access: "admin" as const, items: Object.entries(value).map(([child, target]) => link(child, target)) });
  if (typeof spec.icon !== "string" || !/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(spec.icon)) throw new Error(`${id}: usa el nombre de un icono Lucide, por ejemplo "flask-conical".`);
  const application = {
    id, name: spec.name, description: spec.description ?? `Aplicación ${spec.name}.`, version: spec.version ?? "0.1.0",
    access: "admin" as const, depends: spec.depends ?? [], models: models.map(model => model.contract.name), menus,
  };
  // Validate ids, menus and dependencies now; the icon component is attached by the registry.
  defineApplication({ ...application, icon: (() => null) as unknown as ApplicationManifest["icon"] });
  const profile: GenerationProfile = {
    module: { id, depends: spec.depends ?? [], models: models.map(model => ({ model: model.contract, clientFields: model.clientFields })) },
    externalOwners: {}, runtime: true,
  };
  return Object.freeze({ id, application, icon: spec.icon, models: Object.freeze(models), profile });
}
