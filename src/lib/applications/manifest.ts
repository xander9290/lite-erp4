import type { LucideIcon } from "lucide-react";
import type { AccessPerms } from "../access/declare";

export type ApplicationAccess = "authenticated" | "admin";
export type ApplicationMenuLink = {
  /** Declarative model id: effective read controls visibility. A direct dependency may supply it. */
  readonly model?: string;
  readonly id: string;
  readonly label: string;
  readonly href: string;
  readonly match?: "exact" | "prefix";
  readonly access?: ApplicationAccess;
  /** Navigation only: visible to administrators or members of any of these groups. */
  readonly groups?: readonly string[];
};
export type ApplicationMenu = ApplicationMenuLink | {
  readonly id: string;
  readonly label: string;
  readonly access?: ApplicationAccess;
  readonly groups?: readonly string[];
  readonly items: readonly ApplicationMenuLink[];
};

export type ApplicationManifest = {
  /** Declarative models only; native/manual applications preserve their access contract. */
  readonly accessModels?: readonly string[];
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly version: string;
  readonly icon: LucideIcon;
  readonly depends: readonly string[];
  readonly access: ApplicationAccess;
  /** Declarative modules: members of any of these groups (or administrators) may open the application. */
  readonly groups?: readonly string[];
  /** Navigation only: routes and server actions still authorize their operations. */
  readonly menus?: readonly ApplicationMenu[];
  /** Prisma model names owned by this module; references to other modules are dependencies. */
  readonly models: readonly string[];
  /**
   * Card in the application drawer (default true). `false` hides only the card: routes,
   * navigation, menu links from other applications and permissions stay the same.
   */
  readonly drawer?: boolean;
};

const identifier = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const reserved = new Set(["perfil", "nuevo", "api", "auth", "sample"]);

function validateMenus(application: ApplicationManifest) {
  if (application.menus === undefined) return;
  if (!Array.isArray(application.menus)) throw new Error(`Menús inválidos en ${application.id}.`);
  const ids = new Set<string>();
  const base = `/erp/${application.id}`;
  function validateItem(item: ApplicationMenu | ApplicationMenuLink, nested = false) {
    if (!item || !identifier.test(item.id) || ids.has(item.id) || typeof item.label !== "string" || !item.label.trim()) throw new Error(`Menú inválido o duplicado en ${application.id}.`);
    ids.add(item.id);
    if (item.access !== undefined && !["authenticated", "admin"].includes(item.access)) throw new Error(`Acceso de menú inválido en ${application.id}.`);
    if (item.groups !== undefined && (!Array.isArray(item.groups) || item.groups.some(group => typeof group !== "string"))) throw new Error(`Grupos de menú inválidos en ${application.id}.`);
    if ("items" in item) {
      if (nested || "href" in item || !Array.isArray(item.items) || !item.items.length) throw new Error(`Grupo de menú inválido en ${application.id}.`);
      item.items.forEach(child => validateItem(child, true));
    } else {
      const dependency = item.model?.split(".")[0];
      const dependencyModel = Boolean(dependency && application.depends.includes(dependency) && /^[a-z][a-z0-9-]*\.[a-z][a-z0-9]*$/.test(item.model!));
      if (item.model !== undefined && !application.accessModels?.includes(item.model) && !dependencyModel) throw new Error(`Modelo de menú no declarado en ${application.id}.`);
      // Dependency links only open a declared model's conventional collection route.
      // Never accept arbitrary foreign paths, external URLs, queries or fragments.
      const expected = dependencyModel ? `/erp/${dependency}/${item.model!.split(".")[1]}` : undefined;
      if (typeof item.href !== "string" || !/^\/erp\/[a-z0-9-]+(?:\/[a-zA-Z0-9_-]+)*$/.test(item.href) || (expected ? item.href !== expected : !(item.href === base || item.href.startsWith(`${base}/`)))) throw new Error(`Ruta de menú inválida en ${application.id}.`);
      if (item.match !== undefined && !["exact", "prefix"].includes(item.match)) throw new Error(`Coincidencia de menú inválida en ${application.id}.`);
    }
  }
  application.menus.forEach(item => validateItem(item));
}

/** Trusted, static TypeScript metadata. This does not create routes or database tables. */
export function defineApplication<const T extends ApplicationManifest>(manifest: T): T {
  if (!identifier.test(manifest.id) || reserved.has(manifest.id)) throw new Error(`Identificador de aplicación inválido o reservado: ${manifest.id}`);
  if (!manifest.name.trim() || !manifest.description.trim()) throw new Error(`La aplicación ${manifest.id} necesita nombre y descripción.`);
  if (!/^\d+\.\d+\.\d+$/.test(manifest.version)) throw new Error(`Usa una versión como 0.1.0 en ${manifest.id}.`);
  if (!["authenticated", "admin"].includes(manifest.access)) throw new Error(`Acceso inválido en ${manifest.id}.`);
  if (new Set(manifest.depends).size !== manifest.depends.length || manifest.depends.some(id => !identifier.test(id) || id === manifest.id)) throw new Error(`Dependencias inválidas en ${manifest.id}.`);
  if (new Set(manifest.models).size !== manifest.models.length || manifest.models.some(model => !/^[A-Z][A-Za-z0-9]*$/.test(model))) throw new Error(`Modelos inválidos en ${manifest.id}.`);
  if (manifest.accessModels !== undefined && (!Array.isArray(manifest.accessModels) || new Set(manifest.accessModels).size !== manifest.accessModels.length || manifest.accessModels.some(model => typeof model !== "string" || (!model.startsWith(`${manifest.id}.`) && !/^core\.(partner|user)$/.test(model)) || !/^[a-z][a-z0-9-]*\.[a-z][a-z0-9]*$/.test(model)))) throw new Error(`Modelos de acceso inválidos en ${manifest.id}.`);
  if (manifest.drawer !== undefined && typeof manifest.drawer !== "boolean") throw new Error(`drawer debe ser true o false en ${manifest.id}.`);
  validateMenus(manifest);
  return manifest;
}

export function applicationHref(manifest: ApplicationManifest): `/erp/${string}` {
  return `/erp/${manifest.id}`;
}

export type ApplicationUser = { isAdmin: boolean; groups?: ReadonlySet<string>; modelAccess?: Readonly<Record<string, AccessPerms>> } | null;
/** Presentation only: groups and admin flags decide visibility; every operation is authorized on the server. */
export function memberOf(user: ApplicationUser, groups: readonly string[] | undefined) {
  return !groups || Boolean(user?.isAdmin) || groups.some(group => user?.groups?.has(group));
}
export function canOpenApplication(manifest: ApplicationManifest, user: ApplicationUser): boolean {
  if (manifest.accessModels) return Boolean(user && manifest.accessModels.some(model => user.modelAccess?.[model]?.read === true));
  return user !== null && (manifest.access === "authenticated" || user.isAdmin) && memberOf(user, manifest.groups);
}

/** Validate the complete set before exposing any application. Dependencies come first. */
export function createApplicationRegistry(manifests: readonly ApplicationManifest[]) {
  const byId = new Map<string, ApplicationManifest>();
  const owners = new Map<string, string>();
  for (const manifest of manifests) {
    defineApplication(manifest);
    if (byId.has(manifest.id)) throw new Error(`Aplicación duplicada: ${manifest.id}`);
    byId.set(manifest.id, manifest);
    for (const model of manifest.models) {
      if (owners.has(model)) throw new Error(`El modelo ${model} ya pertenece a ${owners.get(model)}.`);
      owners.set(model, manifest.id);
    }
  }
  const ordered: ApplicationManifest[] = [];
  const visiting = new Set<string>();
  const visited = new Set<string>();
  function visit(id: string) {
    if (visiting.has(id)) throw new Error(`Dependencia circular de aplicaciones: ${id}`);
    if (visited.has(id)) return;
    const manifest = byId.get(id);
    if (!manifest) throw new Error(`No está registrada la dependencia ${id}.`);
    visiting.add(id);
    for (const dependency of manifest.depends) visit(dependency);
    visiting.delete(id);
    visited.add(id);
    ordered.push(manifest);
  }
  for (const id of byId.keys()) visit(id);
  for (const manifest of ordered) {
    const links = (manifest.menus ?? []).flatMap(item => "items" in item ? item.items : [item]);
    for (const link of links) {
      const dependency = link.model?.split(".")[0];
      if (dependency && manifest.depends.includes(dependency) && !byId.get(dependency)?.accessModels?.includes(link.model!)) {
        throw new Error(`${manifest.id}: el modelo de menú ${link.model} no está publicado por ${dependency}.`);
      }
    }
  }
  return {
    get: (id: string) => byId.get(id),
    all: (): readonly ApplicationManifest[] => [...ordered],
    forUser: (user: ApplicationUser) => ordered.filter(manifest => canOpenApplication(manifest, user)),
    /** Cards of the application drawer: openable applications not hidden with `drawer: false`. */
    drawerFor: (user: ApplicationUser) => ordered.filter(manifest => manifest.drawer !== false && canOpenApplication(manifest, user)),
  };
}
