import type { LucideIcon } from "lucide-react";

export type ApplicationAccess = "authenticated" | "admin";
export type ApplicationMenuLink = {
  readonly id: string;
  readonly label: string;
  readonly href: string;
  readonly match?: "exact" | "prefix";
  readonly access?: ApplicationAccess;
};
export type ApplicationMenu = ApplicationMenuLink | {
  readonly id: string;
  readonly label: string;
  readonly access?: ApplicationAccess;
  readonly items: readonly ApplicationMenuLink[];
};

export type ApplicationManifest = {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly version: string;
  readonly icon: LucideIcon;
  readonly depends: readonly string[];
  readonly access: ApplicationAccess;
  /** Navigation only: routes and server actions still authorize their operations. */
  readonly menus?: readonly ApplicationMenu[];
  /** Prisma model names owned by this module; references to other modules are dependencies. */
  readonly models: readonly string[];
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
    if ("items" in item) {
      if (nested || "href" in item || !Array.isArray(item.items) || !item.items.length) throw new Error(`Grupo de menú inválido en ${application.id}.`);
      item.items.forEach(child => validateItem(child, true));
    } else {
      // Canonical application paths only; no external URLs, queries or fragments.
      if (typeof item.href !== "string" || !/^\/erp\/[a-z0-9-]+(?:\/[a-zA-Z0-9_-]+)*$/.test(item.href) || !(item.href === base || item.href.startsWith(`${base}/`))) throw new Error(`Ruta de menú inválida en ${application.id}.`);
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
  validateMenus(manifest);
  return manifest;
}

export function applicationHref(manifest: ApplicationManifest): `/erp/${string}` {
  return `/erp/${manifest.id}`;
}

export function canOpenApplication(manifest: ApplicationManifest, user: { isAdmin: boolean } | null): boolean {
  return user !== null && (manifest.access === "authenticated" || user.isAdmin);
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
  return {
    get: (id: string) => byId.get(id),
    all: (): readonly ApplicationManifest[] => [...ordered],
    forUser: (user: { isAdmin: boolean } | null) => ordered.filter(manifest => canOpenApplication(manifest, user)),
  };
}
