import "server-only";
import { lstat, mkdir, mkdtemp, open, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { artifactPlan, assertNoSymlinks, writeArtifacts } from "../orm/generator/write";
import { appIdentity, scaffoldRegistryFiles, type createAppTemplate } from "./templates";
import { unboundFiles } from "../orm/generator/bind";
import { imageUploadFiles } from "../orm/generator/image-uploads";
import { assertApplicationIdAvailable } from "../module-manager/retirements";
import { assertNoOtherModuleOperation } from "../module-manager/operation-lock";

type Template = ReturnType<typeof createAppTemplate>;
async function absent(path: string) {
  try { await lstat(path); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return; throw error; }
  throw new Error(`Ya existe ${path}; create:app nunca sobrescribe una aplicación ni sus artefactos.`);
}

export async function planApplication(root: string, template: Template, artifacts: Record<string, string>) {
  root = resolve(root);
  await assertNoOtherModuleOperation(root);
  const expected = appIdentity(template.app.name);
  await assertApplicationIdAvailable(root, expected.id);
  if (Object.keys(expected).some(key => expected[key as keyof typeof expected] !== template.app[key as keyof typeof expected])) throw new Error("La identidad de la aplicación no coincide con su nombre.");
  const appPath = join(root, "src/app/(auth)/erp", template.app.id);
  const artifactsPath = join(root, "src/generated/orm/apps", template.app.id);
  const bindingsPath = join(root, "src/generated/orm/bindings", template.app.id);
  const uploadsPath = join(root, "src/generated/orm/uploads", template.app.id);
  const registryPath = join(root, "src/lib/applications/scaffolded");
  for (const path of [appPath, artifactsPath, bindingsPath, uploadsPath, registryPath]) await assertNoSymlinks(path);
  await assertNoSymlinks(join(registryPath, "catalog.json"));
  await absent(appPath); await absent(artifactsPath); await absent(bindingsPath); await absent(uploadsPath);
  let ids: string[] = [];
  try {
    const catalog = JSON.parse(await readFile(join(registryPath, "catalog.json"), "utf8"));
    if (catalog?.version !== 1 || !Array.isArray(catalog.applications) || catalog.applications.some((id: unknown) => typeof id !== "string")) throw new Error("Catálogo de cascarones inválido.");
    ids = catalog.applications;
  } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
  if (ids.includes(template.app.id)) throw new Error("La aplicación ya está registrada.");
  const registry = scaffoldRegistryFiles([...ids, template.app.id]);
  // Protect catalog/registry content before creating either the application or its artifacts.
  await artifactPlan(registryPath, "application-registry", registry);
  for (const name of Object.keys(template.files)) if (!/^[A-Za-z0-9[\]_.-]+(?:\/[A-Za-z0-9[\]_.-]+)*$/.test(name) || name.split("/").some(part => part === "." || part === "..")) throw new Error(`Ruta de plantilla inválida: ${name}.`);
  const paths = [...Object.keys(template.files).map(name => relative(root, join(appPath, name))), ...Object.keys(artifacts).map(name => relative(root, join(artifactsPath, name))), ...Object.keys(registry).map(name => relative(root, join(registryPath, name)))];
  const bindings = unboundFiles(template.profile);
  paths.push(...Object.keys(bindings).map(name => relative(root, join(bindingsPath, name))));
  const uploads = imageUploadFiles(template.profile);
  paths.push(...Object.keys(uploads).map(name => relative(root, join(uploadsPath, name))));
  return { root, appPath, artifactsPath, bindingsPath, bindings, uploadsPath, uploads, registryPath, registry, paths };
}

export async function createApplication(root: string, template: Template, artifacts: Record<string, string>, dryRun = false) {
  const initial = await planApplication(root, template, artifacts);
  if (dryRun) return initial;
  await mkdir(initial.registryPath, { recursive: true });
  const lockPath = join(initial.registryPath, ".create-app.lock");
  const lock = await open(lockPath, "wx");
  let stage: string | undefined;
  const moved: { from: string; to: string }[] = [];
  let preserveStage = false;
  try {
    const plan = await planApplication(root, template, artifacts);
    stage = await mkdtemp(join(plan.root, ".create-app-"));
    const stagedApp = join(stage, "application"), stagedArtifacts = join(stage, "artifacts"), stagedBindings = join(stage, "bindings"), stagedUploads = join(stage, "uploads");
    for (const [name, content] of Object.entries(template.files)) {
      const path = join(stagedApp, name);
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, content, { flag: "wx" });
    }
    await writeArtifacts(stagedArtifacts, template.app.id, artifacts);
    await writeArtifacts(stagedBindings, `binding-${template.app.id}`, plan.bindings);
    await writeArtifacts(stagedUploads, `uploads-${template.app.id}`, plan.uploads);
    for (const [from, to] of [[stagedApp, plan.appPath], [stagedArtifacts, plan.artifactsPath], [stagedBindings, plan.bindingsPath], [stagedUploads, plan.uploadsPath]]) {
      await mkdir(dirname(to), { recursive: true });
      await absent(to);
      await rename(from, to);
      moved.push({ from, to });
    }
    await writeArtifacts(plan.registryPath, "application-registry", plan.registry);
    return plan;
  } catch (error) {
    const failures: unknown[] = [];
    for (const { from, to } of moved.reverse()) { try { await rename(to, from); } catch (rollbackError) { failures.push(rollbackError); } }
    if (failures.length) { preserveStage = true; throw new AggregateError([error, ...failures], `La creación requiere revisión; se conservaron los respaldos en ${stage}.`); }
    throw error;
  } finally {
    await lock.close();
    if (stage && !preserveStage) await rm(stage, { recursive: true, force: true });
    await rm(lockPath, { force: true });
  }
}
