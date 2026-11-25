import { lstat, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { pathToFileURL } from "node:url";
import type { ModuleDefinition } from "../src/lib/modules/define";
import { formViewSource, listViewSource, manifestModel, registerView, viewName, type EjectKind } from "../src/lib/modules/eject";
import { assertNoSymlinks } from "../src/lib/orm/generator/write";
import { assertNoOtherModuleOperation } from "../src/lib/module-manager/operation-lock";
import { composeModules } from "../src/lib/modules/compose";
import core from "../src/lib/core/manifest";
import { sourceFile } from "../src/lib/scaffold/source-edit";

const usage = "Uso: npm run eject:view -- modulo modelo form|modal|list|card|kanban [--screen=<id>] [--dry-run]. --screen es obligatorio en modelos con screens. Para una extensión: modulo propietario.modelo modal.";

/** Load only the selected module's dependency graph, including the implicit native core. */
async function dependencies(root: string, definition: ModuleDefinition) {
  const found = new Map<string, ModuleDefinition>([[core.id, core]]);
  const visit = async (module: ModuleDefinition) => {
    if (found.has(module.id)) return;
    found.set(module.id, module);
    for (const id of module.application.depends ?? []) {
      if (found.has(id)) continue;
      const path = join(root, "src/modules", id, "manifest.ts");
      await assertNoSymlinks(path);
      const next: ModuleDefinition | undefined = (await import(pathToFileURL(path).href)).default;
      if (!next || next.id !== id) throw new Error(`Dependencia inválida: ${id}.`);
      await visit(next);
    }
  };
  await visit(definition);
  return [...found.values()];
}

/** Copy a default view into src/modules/<id>/views and register it lazily in the manifest. Never overwrites. */
async function main() {
  const [id, key, kind, ...options] = process.argv.slice(2);
  const flag = options.includes("--dry-run") ? "--dry-run" : undefined;
  const screenOptions = options.filter(option => option.startsWith("--screen="));
  const screen = screenOptions[0]?.slice("--screen=".length);
  const unknown = options.filter(option => option !== "--dry-run" && !option.startsWith("--screen="));
  if (unknown.length || new Set(options).size !== options.length || screenOptions.length > 1 || (screen !== undefined && !/^[a-z][a-z0-9]*$/.test(screen))) throw new Error(usage);
  if (!id || id === "core" || !key || !["form", "modal", "list", "card", "kanban"].includes(kind) || !/^[a-z][a-z0-9]*$/.test(id) || !/^[a-z][a-z0-9]*(?:\.[a-z][a-z0-9]*)?$/.test(key) || (key.includes(".") && kind !== "modal")) throw new Error(usage);
  const root = process.cwd();
  await assertNoOtherModuleOperation(root);
  const manifestPath = join(root, "src/modules", id, "manifest.ts");
  const viewPath = join(root, "src/modules", id, "views", `${viewName(key, kind as EjectKind, screen)}.tsx`);
  await assertNoSymlinks(manifestPath);
  await assertNoSymlinks(viewPath);
  await lstat(viewPath).then(() => { throw new Error(`${relative(root, viewPath)} ya existe; no se sobrescribe.`); }, error => {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  });
  const definition: ModuleDefinition | undefined = (await import(pathToFileURL(manifestPath).href)).default;
  if (!definition || definition.id !== id) throw new Error(`Manifest inválido: ${id}.`);
  const extension = key.includes(".") ? definition.extensions.find(extension => extension.target === key) : undefined;
  if (key.includes(".") && !extension) throw new Error(`${key} no está declarado en extends de ${id}.`);
  const declared = await dependencies(root, definition);
  const modelId = extension ? key : `${id}.${key}`;
  const modules = composeModules(declared);
  const entry = modules.flatMap(module => module.models).find(model => model.id === modelId);
  const base = declared.flatMap(module => module.models).find(model => model.id === modelId);
  if (!entry || !base) throw new Error(`No existe el modelo ${modelId}.`);
  if (kind === "kanban" && !entry.kanban) throw new Error("Configura kanban en el modelo antes de expulsar su presentación.");
  const text = await readFile(manifestPath, "utf8");
  const classInfo = extension ? {} : manifestModel(text, key);
  // An existing modal insertion file owns the extender's controls; keep them out
  // of the generated layout so the same field never mounts twice.
  const ownExtensionFields = extension && !extension.insertions?.modal ? [...extension.fields, ...extension.computed, ...extension.many2many] : [];
  const rendered = new Set([...base.clientFields, ...Object.keys(base.contract.previewFields), ...Object.keys(base.contract.many2manyFields), ...ownExtensionFields]);
  const fields = Object.fromEntries(Object.entries(entry.metadata).filter(([name, field]) => rendered.has(name) && (!field.sensitive || ("writeOnly" in field && field.writeOnly))));
  const preview = Object.fromEntries(Object.entries(entry.contract.previewFields).filter(([name]) => rendered.has(name)).map(([name, field]) => [name, field.metadata]));
  const many2many = Object.keys(entry.contract.many2manyFields).filter(name => rendered.has(name));
  const targets = new Set(modules.flatMap(module => module.models.map(model => model.contract.name)));
  const lookups = Object.entries(fields).filter(([, field]) => field.kind === "many2one" && !field.sensitive && targets.has(field.target)).map(([name]) => name);
  const model = {
    ...(screen ? { screen } : {}),
    many2many, key, ...classInfo, lookups, listFields: entry.list.fields, fields, preview,
    lines: Object.keys(entry.contract.one2manyFields), collections: Object.keys(entry.contract.childCollections),
    ...(kind === "modal" ? { excludeExtensionFields: [...Object.keys(fields), ...Object.keys(preview), ...many2many] } : {}),
  };
  const source = kind === "form" || kind === "modal" ? formViewSource(model, kind) : listViewSource(model, kind as Exclude<EjectKind, "form" | "modal">);
  sourceFile(source, "view.tsx");
  const updated = registerView(text, key, kind as EjectKind, screen);
  console.log(`${flag ? "Plan" : "Vista expulsada"}: ${modelId} ${kind}${screen ? ` (pantalla ${screen})` : ""}${extension ? ` en ${id}` : ""}`);
  console.log(`  create ${relative(root, viewPath)}`);
  console.log(`  update ${relative(root, manifestPath)}`);
  if (flag) return;
  await mkdir(dirname(viewPath), { recursive: true });
  await writeFile(viewPath, source, { flag: "wx" }).catch(error => {
    throw new Error((error as NodeJS.ErrnoException).code === "EEXIST" ? `${relative(root, viewPath)} ya existe; no se sobrescribe.` : (error as Error).message);
  });
  try {
    if (await readFile(manifestPath, "utf8") !== text) throw new Error("El manifest cambió durante la expulsión; repite el comando.");
    await writeFile(manifestPath, updated);
  } catch (error) { await rm(viewPath, { force: true }); throw error; }
  console.log("Personaliza la vista; ModelForm/ModelCollection conservan el cableado y la autorización del servidor. No se ejecutó SQL.");
}
main().catch(error => { console.error(error instanceof Error ? error.message : "No se pudo expulsar la vista."); process.exitCode = 1; });
