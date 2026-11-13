import "server-only";
import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { dirname, join, relative, resolve, sep } from "node:path";
import ts from "typescript";
import { assertNoSymlinks, artifactPlan } from "../orm/generator/write";
import { sourceHash } from "../orm/generator/installation-state";
import { array, sourceFile, variable } from "../scaffold/source-edit";
import { readSource, type ResourceChange } from "../scaffold/resource-write";
import { scaffoldRegistryFiles } from "../scaffold/templates";

export async function treeFiles(root: string, directory: string): Promise<string[]> {
  const path = resolve(root, directory);
  const inside = relative(resolve(root), path);
  if (!inside || inside.startsWith("..") || inside.includes(`..${sep}`)) throw new Error("Ruta de operación inválida.");
  await assertNoSymlinks(path);
  let entries;
  try { entries = await readdir(path, { withFileTypes: true }); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return []; throw error; }
  const files: string[] = [];
  for (const entry of entries) {
    const next = join(path, entry.name);
    await assertNoSymlinks(next);
    if (entry.isDirectory()) files.push(...await treeFiles(root, relative(root, next)));
    else if (entry.isFile()) files.push(next);
    else throw new Error("Archivo no soportado en la operación.");
  }
  return files.sort();
}

export async function sourceFingerprint(root: string) {
  const hash = createHash("sha256");
  const files = [...await treeFiles(root, "src"), ...await treeFiles(root, "prisma"), ...await treeFiles(root, "scripts")].filter(path => !path.endsWith(".lock"));
  for (const path of files) hash.update(relative(root, path)).update(await readFile(path));
  for (const name of ["package.json", "package-lock.json", "tsconfig.json", "prisma7.config.ts", "next.config.ts"]) hash.update(name).update(await readSource(join(root, name)) ?? "");
  return hash.digest("hex");
}

/** Remove only the literal module entry and its exact default manifest import. */
export function unregisterModule(text: string, id: string) {
  const file = sourceFile(text, "index.ts");
  const entries = array(variable(file, "modules"));
  const imports = file.statements.filter(ts.isImportDeclaration).filter(node => ts.isStringLiteral(node.moduleSpecifier) && node.moduleSpecifier.text === `./${id}/manifest`);
  if (imports.length > 1) throw new Error("Import de módulo ambiguo.");
  if (!imports.length) return text;
  const name = imports[0].importClause?.name?.text;
  if (!name || entries.elements.some(node => !ts.isIdentifier(node))) throw new Error("El índice requiere imports y entradas literales.");
  const kept = entries.elements.filter(node => !ts.isIdentifier(node) || node.text !== name);
  const replacement = `[${kept.map(node => text.slice(node.getFullStart(), node.end)).join(",")}${kept.length && entries.elements.hasTrailingComma ? "," : ""}]`;
  const edits = [{ start: entries.getStart(file), end: entries.end, text: replacement }, { start: imports[0].getStart(file), end: imports[0].end, text: "" }];
  for (const edit of edits.sort((a, b) => b.start - a.start)) text = text.slice(0, edit.start) + edit.text + text.slice(edit.end);
  sourceFile(text, "index.ts");
  return text;
}

export async function registryRemoval(root: string, id: string, kind: string): Promise<ResourceChange[]> {
  if (kind === "declarative") {
    const path = join(root, "src/modules/index.ts"), before = await readSource(path);
    if (before === null) throw new Error("Falta el registro de módulos.");
    const after = unregisterModule(before, id);
    return after === before ? [] : [{ path, before, after }];
  }
  const directory = join(root, "src/lib/applications/scaffolded");
  const catalog = JSON.parse(await readSource(join(directory, "catalog.json")) ?? "null") as { applications?: string[] } | null;
  if (!catalog?.applications || !catalog.applications.includes(id)) throw new Error("La aplicación no está en el catálogo gestionado.");
  const files = scaffoldRegistryFiles(catalog.applications.filter(value => value !== id));
  const plan = await artifactPlan(directory, "application-registry", files);
  const changes: ResourceChange[] = [];
  for (const [name, after] of Object.entries({ ...files, "generation-manifest.json": plan.manifestText })) {
    const path = join(directory, name), before = await readSource(path);
    if (before !== after) changes.push({ path, before, after });
  }
  return changes;
}

export async function restoreScaffoldRegistration(root: string, id: string): Promise<ResourceChange[]> {
  const directory = join(root, "src/lib/applications/scaffolded");
  const catalog = JSON.parse(await readSource(join(directory, "catalog.json")) ?? "null") as { applications?: string[] } | null;
  if (!catalog?.applications) throw new Error("Catálogo de aplicaciones no disponible.");
  const files = scaffoldRegistryFiles([...new Set([...catalog.applications, id])]);
  const plan = await artifactPlan(directory, "application-registry", files);
  const changes: ResourceChange[] = [];
  for (const [name, after] of Object.entries({ ...files, "generation-manifest.json": plan.manifestText })) {
    const path = join(directory, name), before = await readSource(path);
    if (before !== after) changes.push({ path, before, after });
  }
  return changes;
}

export function archiveFingerprint(root: string, changes: readonly ResourceChange[]) {
  return createHash("sha256").update(JSON.stringify(changes.filter(change => change.after === null).map(change => ({ path: relative(root, change.path).replaceAll("\\", "/"), hash: sourceHash(change.before!) })).sort((a, b) => a.path.localeCompare(b.path)))).digest("hex");
}

export async function removalFiles(root: string, id: string, kind: string): Promise<ResourceChange[]> {
  const sources = kind === "declarative" ? `src/modules/${id}` : `src/app/(auth)/erp/${id}`;
  const paths = await treeFiles(root, sources);
  const changes: ResourceChange[] = [];
  for (const [folder, owner] of [["apps", id], ["bindings", `binding-${id}`], ["uploads", `uploads-${id}`]]) {
    const directory = `src/generated/orm/${folder}/${id}`;
    const generated = await treeFiles(root, directory);
    if (!generated.length) continue;
    const files: Record<string, string> = {};
    for (const path of generated) {
      const name = relative(join(root, directory), path);
      if (name !== "generation-manifest.json") files[name] = (await readSource(path))!;
    }
    await artifactPlan(join(root, directory), owner, files);
    paths.push(...generated);
  }
  for (const path of paths) {
    if (!/\.(?:tsx?|jsx?|json|md|css|svg|txt|sql|prisma)$/.test(path)) throw new Error(`Archivo que requiere una retirada manual revisada: ${relative(root, path)}.`);
    const before = await readSource(path);
    if (before !== null) changes.push({ path, before, after: null });
  }
  return [...changes, ...await registryRemoval(root, id, kind)];
}

/** Explicit imports/delegates outside the removal set block both keep and drop. */
export async function sourceDependents(root: string, changes: readonly ResourceChange[], modelNames: readonly string[], accessIds: readonly string[] = [], tableNames: readonly string[] = []) {
  const removed = new Set(changes.filter(change => change.after === null).map(change => change.path));
  const rewritten = new Set(changes.map(change => change.path));
  const delegates = new Set(modelNames.map(name => name[0].toLowerCase() + name.slice(1)));
  const blockers: string[] = [];
  for (const path of [...await treeFiles(root, "src"), ...await treeFiles(root, "scripts")].filter(path => /\.tsx?$/.test(path) && !rewritten.has(path) && !path.includes(`${sep}generated${sep}prisma${sep}`))) {
    const text = await readSource(path) ?? "";
    const file = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true);
    let referenced = false;
    const removedImport = (value: string) => {
      const target = value.startsWith("@/") ? join(root, "src", value.slice(2)) : value.startsWith(".") ? resolve(dirname(path), value) : "";
      return Boolean(target && [target, `${target}.ts`, `${target}.tsx`, join(target, "index.ts")].some(candidate => removed.has(candidate)));
    };
    const mentionsTable = (value: string) => tableNames.some(name => new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(value));
    const visit = (node: ts.Node) => {
      if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
        if (removedImport(node.moduleSpecifier.text)) referenced = true;
      }
      if (ts.isPropertyAccessExpression(node) && delegates.has(node.name.text)) referenced = true;
      if (ts.isElementAccessExpression(node) && node.argumentExpression && ts.isStringLiteral(node.argumentExpression) && delegates.has(node.argumentExpression.text)) referenced = true;
      if (ts.isCallExpression(node) && node.arguments[0] && ts.isStringLiteral(node.arguments[0])) {
        if ((node.expression.kind === ts.SyntaxKind.ImportKeyword || ts.isIdentifier(node.expression) && node.expression.text === "require") && removedImport(node.arguments[0].text)) referenced = true;
        if (ts.isPropertyAccessExpression(node.expression) && ["query", "$queryRawUnsafe", "$executeRawUnsafe"].includes(node.expression.name.text) && mentionsTable(node.arguments[0].text)) referenced = true;
      }
      if (ts.isTaggedTemplateExpression(node) && ts.isPropertyAccessExpression(node.tag) && ["$queryRaw", "$executeRaw"].includes(node.tag.name.text) && mentionsTable(node.template.getText(file))) referenced = true;
      if (path.endsWith(`${sep}manifest.ts`) && ts.isStringLiteral(node) && accessIds.includes(node.text)) referenced = true;
      if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === "Many2one" && node.arguments[0] && ts.isStringLiteral(node.arguments[0]) && modelNames.includes(node.arguments[0].text)) referenced = true;
      ts.forEachChild(node, visit);
    };
    visit(file);
    if (referenced) blockers.push(`Referencia externa: ${relative(root, path).replaceAll("\\", "/")}.`);
  }
  return blockers;
}
