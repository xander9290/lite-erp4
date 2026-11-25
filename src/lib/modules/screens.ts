import { availableCollectionViews, collectionViews, type CollectionView } from "./config";
import type { FieldMetadata } from "../orm/fields";
import type { CollectionDomain } from "../orm/domain";

/** Literal values proposed to a new record of a screen; the server schema validates them on save. */
export type ScreenDefaultValue = string | number | boolean | null;
export type ScreenDefaults = Readonly<Record<string, ScreenDefaultValue>>;

/**
 * Lazy view loaders of one screen (same contract as `ModelViews` in define.ts, repeated here to
 * keep this file free of React types).
 */
export type ScreenViews = {
  readonly form?: () => Promise<{ default: unknown }>;
  readonly modal?: () => Promise<{ default: unknown }>;
  readonly list?: true | (() => Promise<{ default: unknown }>);
  readonly card?: true | (() => Promise<{ default: unknown }>);
  readonly kanban?: true | (() => Promise<{ default: unknown }>);
};

/**
 * Named screen of a model: navigation configuration over the same model (Odoo-style action
 * window). It groups label, initial presentation, server domain, creation defaults and views.
 * It never changes the model, its validations, field publication or permissions.
 */
export type ModelScreen<V extends ScreenViews = ScreenViews> = {
  readonly label: string;
  /** Initial collection presentation (default "list"). */
  readonly view?: CollectionView;
  /** Server domain of this screen's collections (list/card/kanban). Narrows, never widens access. */
  readonly domain?: CollectionDomain;
  /** Proposed values for new records opened from this screen (not enforced on save). */
  readonly defaults?: ScreenDefaults;
  readonly views?: V;
};

export type CompiledScreen<V extends ScreenViews = ScreenViews> = {
  readonly id: string;
  readonly label: string;
  readonly view: CollectionView;
  readonly collectionViews: readonly CollectionView[];
  readonly views: V;
  readonly domain?: CollectionDomain;
  readonly defaults: ScreenDefaults;
};

/** Implicit screen id of models declared without `screens`. */
export const defaultScreenId = "default";
export const screenIdPattern = /^[a-z][a-z0-9]*$/;
const viewKinds = [...collectionViews, "form", "modal"] as const;

function validateViews(where: string, views: ScreenViews | undefined) {
  for (const [kind, loader] of Object.entries(views ?? {})) {
    if (loader === undefined) continue;
    if (!(viewKinds as readonly string[]).includes(kind) || (typeof loader !== "function" && !((collectionViews as readonly string[]).includes(kind) && loader === true)))
      throw new Error(`${where}: registro de vista inválido: ${kind}.`);
  }
}

/** Only plain editable fields accept a static default: no relations to many, images, dates or derived values. */
function validateDefaults(where: string, defaults: unknown, metadata: Readonly<Record<string, FieldMetadata>>, clientFields: readonly string[]): ScreenDefaults {
  if (defaults === undefined) return Object.freeze({});
  if (!defaults || typeof defaults !== "object" || Array.isArray(defaults)) throw new Error(`${where}: defaults debe ser un objeto { campo: valor }.`);
  for (const [name, value] of Object.entries(defaults)) {
    const field = metadata[name];
    const fail = (reason: string) => new Error(`${where}: defaults.${name} ${reason}`);
    if (!field || !clientFields.includes(name)) throw fail("no es un campo del modelo.");
    if (field.sensitive || field.readOnly || field.compute || field.related || field.sequence) throw fail("no admite valores propuestos (sensible, de lectura, calculado o folio).");
    if (value === null) { if (field.required) throw fail("no puede ser null en un campo obligatorio."); continue; }
    switch (field.kind) {
      case "text": if (typeof value !== "string" || (field.maxLength !== undefined && value.length > field.maxLength)) throw fail("debe ser texto dentro de su longitud máxima."); break;
      case "boolean": if (typeof value !== "boolean") throw fail("debe ser true o false."); break;
      case "integer": if (!Number.isInteger(value) || (field.min !== undefined && (value as number) < field.min) || (field.max !== undefined && (value as number) > field.max)) throw fail("debe ser un entero dentro de su rango."); break;
      case "selection": if (!field.choices.some(choice => choice.value === value)) throw fail(`debe ser una opción declarada (${field.choices.map(choice => choice.value).join(", ")}).`); break;
      case "many2one": if (typeof value !== "string" || !value.trim() || value.length > 100) throw fail("debe ser el ID de un registro."); break;
      default: throw fail(`no admite valores propuestos para campos ${field.kind}.`);
    }
  }
  return Object.freeze({ ...defaults as ScreenDefaults });
}

/**
 * Compile the screens of one model. Without `screens`, the top-level view/views/domain become the
 * implicit "default" screen, so existing manifests keep their behavior. With `screens`, those
 * top-level options are rejected to avoid ambiguous precedence.
 */
export function compileScreens<V extends ScreenViews>(where: string, options: {
  readonly screens?: Readonly<Record<string, ModelScreen<V>>>;
  readonly defaultScreen?: string;
  readonly view?: CollectionView;
  readonly views?: V;
  readonly domain?: CollectionDomain;
}, context: { label: string; hasKanban: boolean; metadata: Readonly<Record<string, FieldMetadata>>; clientFields: readonly string[] }): { screens: Readonly<Record<string, CompiledScreen<V>>>; defaultScreen: string } {
  const compile = (id: string, screen: ModelScreen<V>): CompiledScreen<V> => {
    const at = id === defaultScreenId && !options.screens ? where : `${where} → pantalla ${id}`;
    if (screen.domain !== undefined && typeof screen.domain !== "function") throw new Error(`${at}: domain requiere un constructor de dominio.`);
    const view = screen.view ?? "list";
    if (!collectionViews.includes(view)) throw new Error(`${at}: vista de lista inválida.`);
    validateViews(at, screen.views);
    let presentations: readonly CollectionView[];
    try { presentations = availableCollectionViews(view, screen.views ?? {}, context.hasKanban); }
    catch (error) { throw new Error(`${at}: ${(error as Error).message}`); }
    return Object.freeze({
      id, label: screen.label, view, collectionViews: presentations,
      views: Object.freeze({ ...(screen.views ?? {}) }) as V,
      ...(screen.domain ? { domain: screen.domain } : {}),
      defaults: validateDefaults(at, screen.defaults, context.metadata, context.clientFields),
    });
  };
  if (options.screens === undefined) {
    if (options.defaultScreen !== undefined) throw new Error(`${where}: defaultScreen requiere screens.`);
    const screen = compile(defaultScreenId, { label: context.label, view: options.view, views: options.views, domain: options.domain });
    return { screens: Object.freeze({ [defaultScreenId]: screen }), defaultScreen: defaultScreenId };
  }
  if (options.view !== undefined || options.views !== undefined || options.domain !== undefined)
    throw new Error(`${where}: con screens, declara view, views y domain dentro de cada pantalla (no en el modelo).`);
  if (!options.screens || typeof options.screens !== "object" || Array.isArray(options.screens)) throw new Error(`${where}: screens debe ser un objeto indexado por ID.`);
  const entries = Object.entries(options.screens);
  if (!entries.length) throw new Error(`${where}: screens necesita al menos una pantalla.`);
  const compiled: Record<string, CompiledScreen<V>> = {};
  for (const [id, screen] of entries) {
    if (!screenIdPattern.test(id) || id === defaultScreenId) throw new Error(`${where}: ID de pantalla inválido o reservado: ${id}. Usa minúsculas y dígitos.`);
    if (!screen || typeof screen !== "object" || typeof screen.label !== "string" || !screen.label.trim()) throw new Error(`${where} → pantalla ${id}: necesita label.`);
    compiled[id] = compile(id, screen);
  }
  const defaultScreen = options.defaultScreen ?? entries[0][0];
  if (!Object.hasOwn(compiled, defaultScreen)) throw new Error(`${where}: defaultScreen apunta a una pantalla inexistente: ${defaultScreen}.`);
  return { screens: Object.freeze(compiled), defaultScreen };
}

/**
 * Screen selected by a URL value. Absent selects the default; an unknown id returns undefined so
 * the route answers 404 instead of silently showing another screen's records.
 */
export function selectedScreen<V extends ScreenViews>(entry: { readonly screens: Readonly<Record<string, CompiledScreen<V>>>; readonly defaultScreen: string }, value: unknown): CompiledScreen<V> | undefined {
  if (value === undefined || value === null || value === "") return entry.screens[entry.defaultScreen];
  return typeof value === "string" && Object.hasOwn(entry.screens, value) ? entry.screens[value] : undefined;
}
