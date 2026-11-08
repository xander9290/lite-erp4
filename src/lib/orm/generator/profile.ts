import "server-only";
import { lstat } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import type { ModuleGeneration } from "./generate";
import { assertNoSymlinks } from "./write";

export type GenerationProfile = { module: ModuleGeneration; externalOwners: Readonly<Record<string, string>> };

/** Trusted development modules only. This function must never be exposed as a Server Action. */
export async function loadAppGenerationProfile(root: string, id: string): Promise<GenerationProfile | null> {
  if (!/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(id)) throw new Error("Identificador de aplicación inválido.");
  const path = join(root, "src/app/(auth)/erp", id, "orm.config.ts");
  await assertNoSymlinks(path);
  try { if (!(await lstat(path)).isFile()) throw new Error("orm.config.ts debe ser un archivo."); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return null; throw error; }
  const imported = await import(pathToFileURL(path).href);
  const profile: GenerationProfile = imported.generationProfile;
  if (!profile || profile.module?.id !== id || !Array.isArray(profile.module.models) || !Array.isArray(profile.module.depends) || !profile.externalOwners || typeof profile.externalOwners !== "object" || Array.isArray(profile.externalOwners)) throw new Error("orm.config.ts debe exportar un generationProfile válido para esta aplicación.");
  return profile;
}
