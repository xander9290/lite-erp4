import type { AccessPerms } from "../access/declare";
import type { Many2manyMetadata, One2manyMetadata } from "../orm/fields";
import type { FieldMetadata } from "../orm/fields";
import type { ReactionRule } from "../orm/reactions.types";
import type { ListViewConfig } from "../list/types";
import type { KanbanRoute } from "../kanban/types";
import type { ModelCapabilities } from "../access/capabilities";

export const collectionViews = ["list", "card", "kanban"] as const;
export type CollectionView = typeof collectionViews[number];

export function availableCollectionViews(view: CollectionView, registered: object, hasKanban: boolean): readonly CollectionView[] {
  const available = collectionViews.filter(kind => kind === view || (Object.hasOwn(registered, kind) && (registered as Record<string, unknown>)[kind] !== undefined));
  if (available.includes("kanban") && !hasKanban) throw new Error("La presentación kanban necesita configuración kanban en el modelo.");
  return Object.freeze(available);
}

export function selectedCollectionView(value: unknown, available: readonly CollectionView[], fallback: CollectionView): CollectionView {
  return typeof value === "string" && available.includes(value as CollectionView) ? value as CollectionView : fallback;
}

/** Keep compatible query state, reset pagination/grouping/selection by remounting the presentation. */
export function collectionViewHref(pathname: string, current: string, view: CollectionView, prefix = "") {
  const params = new URLSearchParams(current);
  params.set(prefix ? `${prefix}_view` : "view", view);
  params.delete(prefix ? `${prefix}_page` : "page");
  params.delete(prefix ? `${prefix}_group` : "group");
  return `${pathname}?${params}`;
}

/** Serializable, browser-safe description of a module model. Never contains functions or server classes. */
export type ModelLineConfig = {
  readonly fieldAccess?: import("../access/element-policy").FieldRestrictions;
  readonly metadata: One2manyMetadata;
  readonly model: string;
  readonly fields: Readonly<Record<string, FieldMetadata>>;
  readonly lookups: Readonly<Record<string, string>>;
  readonly capabilities: AccessPerms;
  /** Sub-lines of this line (nested documents, up to three levels). */
  readonly lines?: Readonly<Record<string, ModelLineConfig>>;
};
/** Read-only relation of a form: children presented as a collection of their own model. */
export type ModelChildCollectionConfig = {
  readonly label: string;
  readonly inverse: string;
  readonly invisible?: boolean;
  /** Child model contract (without its own collections), with the actor's capabilities. */
  readonly config: ModelClientConfig;
};
export type ModelClientConfig = {
  readonly fieldAccess?: import("../access/element-policy").FieldRestrictions;
  /**
   * Notebook pages (`<notebook>/<page>`) hidden for the actor in this screen, per layout.
   * Presentation only; absent when the model declares no `pages` catalog.
   */
  readonly hiddenPages?: import("./pages").HiddenPagesConfig;
  readonly transfer?: { readonly fields: readonly string[]; readonly key: string | readonly string[]; readonly canImport: boolean; readonly canExport: boolean; readonly collections: readonly import("../list/transfer-types").TransferCollection[] };
  /** Read-only relations shown in the form (children created and edited in their own form). */
  readonly collections?: Readonly<Record<string, ModelChildCollectionConfig>>;
  /** Application presenting a native model; ownership and service id remain unchanged. */
  readonly application?: { readonly name: string; readonly href: `/erp/${string}` };
  readonly many2many?: Readonly<Record<string, Many2manyMetadata>>;
  readonly lines?: Readonly<Record<string, ModelLineConfig>>;
  /** Actor-specific snapshot supplied by the server route, never cached in the model registry. */
  readonly capabilities?: ModelCapabilities;
  readonly id: string;
  readonly module: string;
  readonly moduleName: string;
  readonly key: string;
  readonly name: string;
  readonly label: string;
  readonly route: string;
  readonly fields: Readonly<Record<string, FieldMetadata>>;
  readonly preview: Readonly<Record<string, FieldMetadata>>;
  readonly related: readonly string[];
  readonly reactionRules: readonly ReactionRule[];
  /** Many2one field → target module model id with an authorized lookup. */
  readonly lookups: Readonly<Record<string, string>>;
  /** Business actions published with `@action` (name and label only). */
  readonly actions: readonly import("../orm/action-parameters").ClientModelAction[];
  readonly list: {
    readonly fields: readonly string[];
    readonly searchFields: readonly string[];
    readonly sortable: readonly string[];
    readonly groupable: readonly string[];
    readonly filterable: readonly string[];
  };
  readonly view: CollectionView;
  readonly collectionViews?: readonly CollectionView[];
  /**
   * Screen selected by the route (set only by ModelRoute, never by relation configs). Collections
   * send its id to the server, which resolves the domain; defaults only propose values on create.
   */
  readonly screen?: ModelScreenConfig;
  readonly kanban?: string;
  /** UI routes only; action dispatch remains fixed in the server registry. */
  readonly kanbanTransitions?: readonly KanbanRoute[];
  readonly defaultSort?: ListViewConfig["defaultSort"];
  /** Audit columns published by the server list policy (`audit: true` in the manifest). */
  readonly audit?: true;
  /** Fields added by modules that extend this model, grouped by extending module. */
  readonly extensions?: readonly {
    readonly module: string;
    readonly label: string;
    readonly fields: readonly string[];
    /** Transitive dependencies of the extending module (insertion order and published targets). */
    readonly depends?: readonly string[];
    /** Views where the module places its fields with `<Inserter>` (with "form": no automatic group). */
    readonly insertions?: readonly ("form" | "modal" | "list" | "card" | "kanban")[];
  }[];
};

export type ModelScreenConfig = {
  readonly id: string;
  readonly label: string;
  /** True for the default screen: its links carry no `screen` query value. */
  readonly isDefault: boolean;
  readonly defaults: Readonly<Record<string, string | number | boolean | null>>;
};

/** `screen=<id>` query entries that keep a non-default screen across collection/form navigation. */
export function screenQuery(config: Pick<ModelClientConfig, "screen">): Record<string, string> {
  return config.screen && !config.screen.isDefault ? { screen: config.screen.id } : {};
}
/** Route of the model with its screen selector, e.g. `/erp/directory/partner/nuevo?screen=addresses`. */
export function screenHref(config: Pick<ModelClientConfig, "screen">, path: string, extra: Record<string, string> = {}) {
  const params = new URLSearchParams({ ...screenQuery(config), ...extra }).toString();
  return params ? `${path}${path.includes("?") ? "&" : "?"}${params}` : path;
}

export const modelIdPattern = /^[a-z][a-z0-9]*\.[a-z][a-z0-9]*$/;

/** Only declared related/compute Fields are collection outputs; arbitrary previews stay private. */
export function collectionFieldMetadata(config: Pick<ModelClientConfig, "fields" | "preview" | "related">): Readonly<Record<string, FieldMetadata>> {
  return {
    ...config.fields,
    ...Object.fromEntries(Object.entries(config.preview).filter(([name, field]) => config.related.includes(name) || Boolean(field.compute)).map(([name, field]) => [name, { ...field, readOnly: true }])),
  };
}
