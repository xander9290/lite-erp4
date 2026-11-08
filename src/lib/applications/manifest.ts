import type { LucideIcon } from "lucide-react";

export type ApplicationManifest = {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly version: string;
  readonly icon: LucideIcon;
  readonly depends: readonly string[];
  readonly access: "authenticated" | "admin";
  /** Prisma model names owned by this module; references to other modules are dependencies. */
  readonly models: readonly string[];
};

const identifier = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const reserved = new Set(["perfil", "nuevo", "api", "auth", "sample"]);

/** Trusted, static TypeScript metadata. This does not create routes or database tables. */
export function defineApplication<const T extends ApplicationManifest>(manifest: T): T {
  if (!identifier.test(manifest.id) || reserved.has(manifest.id)) throw new Error(`Identificador de aplicación inválido o reservado: ${manifest.id}`);
  if (!manifest.name.trim() || !manifest.description.trim()) throw new Error(`La aplicación ${manifest.id} necesita nombre y descripción.`);
  if (!/^\d+\.\d+\.\d+$/.test(manifest.version)) throw new Error(`Usa una versión como 0.1.0 en ${manifest.id}.`);
  if (!["authenticated", "admin"].includes(manifest.access)) throw new Error(`Acceso inválido en ${manifest.id}.`);
  if (new Set(manifest.depends).size !== manifest.depends.length || manifest.depends.some(id => !identifier.test(id) || id === manifest.id)) throw new Error(`Dependencias inválidas en ${manifest.id}.`);
  if (new Set(manifest.models).size !== manifest.models.length || manifest.models.some(model => !/^[A-Z][A-Za-z0-9]*$/.test(model))) throw new Error(`Modelos inválidos en ${manifest.id}.`);
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
