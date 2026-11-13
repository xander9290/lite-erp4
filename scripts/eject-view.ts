import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { pathToFileURL } from "node:url";
import type { ModuleDefinition } from "../src/lib/modules/define";
import { formViewSource, listViewSource, manifestModel, registerView, viewName, type EjectKind } from "../src/lib/modules/eject";
import { assertNoSymlinks } from "../src/lib/orm/generator/write";

const usage = "Uso: npm run eject:view -- modulo modelo form|list [--dry-run]";

/** Copy a default view into src/modules/<id>/views and register it lazily in the manifest. Never overwrites. */
async function main() {
  const [id, key, kind, flag, ...extra] = process.argv.slice(2);
  if (!id || !key || !["form", "list"].includes(kind) || extra.length || (flag && flag !== "--dry-run") || !/^[a-z][a-z0-9]*$/.test(id) || !/^[a-z][a-z0-9]*$/.test(key)) throw new Error(usage);
  const root = process.cwd();
  const manifestPath = join(root, "src/modules", id, "manifest.ts");
  const viewPath = join(root, "src/modules", id, "views", `${viewName(key, kind as EjectKind)}.tsx`);
  await assertNoSymlinks(manifestPath);
  await assertNoSymlinks(viewPath);
  const definition: ModuleDefinition | undefined = (await import(pathToFileURL(manifestPath).href)).default;
  const entry = definition?.models.find(model => model.key === key);
  if (!definition || definition.id !== id || !entry) throw new Error(`No existe el modelo ${id}.${key} en src/modules/${id}/manifest.ts.`);
  const text = await readFile(manifestPath, "utf8");
  const { className, classImport } = manifestModel(text, key);
  const lookups = Object.entries(entry.metadata).filter(([, field]) => field.kind === "many2one" && !field.sensitive && definition.models.some(model => model.contract.name === field.target)).map(([name]) => name);
  const model = {
    key, className, classImport, lookups, listFields: entry.list.fields,
    fields: Object.fromEntries(entry.clientFields.map(name => [name, entry.metadata[name]])),
    preview: Object.fromEntries(Object.entries((entry.contract.previewFields ?? {}) as Record<string, { metadata: (typeof entry.metadata)[string] }>).map(([name, field]) => [name, field.metadata])),
  };
  const source = kind === "form" ? formViewSource(model) : listViewSource(model);
  const updated = registerView(text, key, kind as EjectKind);
  console.log(`${flag ? "Plan" : "Vista expulsada"}: ${id}.${key} ${kind}`);
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
