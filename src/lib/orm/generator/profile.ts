import "server-only";
import { lstat } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import type { ModuleGeneration } from "./generate";
import { assertNoSymlinks } from "./write";
import { assertApplicationIdAvailable } from "../../module-manager/retirements";
import { assertNoOtherModuleOperation } from "../../module-manager/operation-lock";

export type GenerationProfile = {
  module: ModuleGeneration; externalOwners: Readonly<Record<string, string>>;
  /** Declarative module (src/modules): runtime repository, actions and client contracts; only the schema is generated. */
  runtime?: true;
};

/** Trusted development modules only. This function must never be exposed as a Server Action. */
export async function loadAppGenerationProfile(root: string, id: string): Promise<GenerationProfile | null> {
  await assertNoOtherModuleOperation(root);
  if (!/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(id)) throw new Error("Identificador de aplicación inválido.");
  await assertApplicationIdAvailable(root, id);
  const path = join(root, "src/app/(auth)/erp", id, "orm.config.ts");
  await assertNoSymlinks(path);
  const manifest = join(root, "src/modules", id, "manifest.ts");
  await assertNoSymlinks(manifest);
  const present = (file: string) => lstat(file).then(() => true, error => { if (error.code === "ENOENT") return false; throw error; });
  if (await present(path) && await present(manifest)) throw new Error(`El ID ${id} tiene orm.config.ts y manifest de módulo; resuelve la configuración ambigua antes de sincronizar.`);
  try { if (!(await lstat(path)).isFile()) throw new Error("orm.config.ts debe ser un archivo."); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return loadModuleGenerationProfile(root, id); throw error; }
  const imported = await import(pathToFileURL(path).href);
  const profile: GenerationProfile = imported.generationProfile;
  if (!profile || profile.module?.id !== id || !Array.isArray(profile.module.models) || !Array.isArray(profile.module.depends) || !profile.externalOwners || typeof profile.externalOwners !== "object" || Array.isArray(profile.externalOwners)) throw new Error("orm.config.ts debe exportar un generationProfile válido para esta aplicación.");
  if (profile.module.models.some(entry => Object.keys((entry.model as { one2manyFields?: object }).one2manyFields ?? {}).length)) throw new Error("One2many declarativo requiere defineModule en src/modules; el scaffold con orm.config.ts no enlaza líneas.");
  if (profile.module.models.some(entry => Object.keys(entry.model.many2manyFields ?? {}).length)) throw new Error("Many2many requiere defineModule en src/modules; no usa bindings legacy.");
  if (profile.module.models.some(entry => Object.values(entry.model.metadata as Readonly<Record<string, import("../fields").FieldMetadata>>).some(field => field.kind === "many2one" && field.domain))) throw new Error("Los dominios de relaciones requieren defineModule; no usan bindings legacy.");
  if (profile.module.models.some(entry => Object.values(entry.model.metadata).some(field => (field as import("../fields").FieldMetadata).sequence))) throw new Error("sequence requiere defineModule en src/modules; no usa bindings legacy.");
  return profile;
}

/** Declarative module: src/modules/<id>/manifest.ts default-exports defineModule(...). Trusted local code only. */
async function loadModuleGenerationProfile(root: string, id: string): Promise<GenerationProfile | null> {
  const path = join(root, "src/modules", id, "manifest.ts");
  await assertNoSymlinks(path);
  try { if (!(await lstat(path)).isFile()) throw new Error("manifest.ts debe ser un archivo."); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return null; throw error; }
  const imported = await import(pathToFileURL(path).href);
  const profile: GenerationProfile | undefined = imported.default?.profile;
  if (!profile || profile.module?.id !== id || profile.runtime !== true) throw new Error("manifest.ts debe exportar por defecto defineModule(...) con el mismo id.");
  return profile;
}
