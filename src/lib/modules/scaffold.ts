import "server-only";
import ts from "typescript";
import { lstat } from "node:fs/promises";
import { join, resolve } from "node:path";
import { defineModule } from "./define";
import { defineModuleObject } from "./eject";
import { assertNoSymlinks } from "../orm/generator/write";
import { readSource, writeResource, type SourceChange } from "../scaffold/resource-write";
import { append, array, literal, object, property, sourceFile, variable } from "../scaffold/source-edit";
import { assertApplicationIdAvailable } from "../module-manager/retirements";

export function moduleId(id: string) {
  if (!/^[a-z][a-z0-9]*$/.test(id)) throw new Error("Usa un ID de módulo en minúsculas, sin guiones.");
  // Reuse application validation, including reserved routes, without importing React.
  defineModule({ id, name: id, icon: "boxes", models: {} });
  return id;
}

async function exists(path: string) {
  await assertNoSymlinks(path);
  try { await lstat(path); return true; }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return false; throw error; }
}

/** Check bindings, not labels/comments that happen to contain the class name. */
function declares(file: ts.SourceFile, name: string) {
  const binding = (node: ts.BindingName): boolean => ts.isIdentifier(node) ? node.text === name
    : node.elements.some(element => !ts.isOmittedExpression(element) && binding(element.name));
  return file.statements.some(statement => {
    if (ts.isImportDeclaration(statement)) {
      const clause = statement.importClause, named = clause?.namedBindings;
      return clause?.name?.text === name || Boolean(named && (ts.isNamespaceImport(named) ? named.name.text === name : named.elements.some(element => element.name.text === name)));
    }
    if (ts.isVariableStatement(statement)) return statement.declarationList.declarations.some(declaration => binding(declaration.name));
    if (ts.isClassDeclaration(statement) || ts.isFunctionDeclaration(statement) || ts.isInterfaceDeclaration(statement) || ts.isTypeAliasDeclaration(statement) || ts.isEnumDeclaration(statement) || ts.isModuleDeclaration(statement)) return statement.name?.text === name;
    return false;
  });
}

/** Only a literal index of explicit default manifest imports is editable. Never evaluates code. */
export function registerModule(text: string, id: string): string {
  moduleId(id);
  const file = sourceFile(text, "index.ts");
  const entries = array(variable(file, "modules"));
  const exported = file.statements.some(statement => ts.isVariableStatement(statement)
    && statement.modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.ExportKeyword)
    && statement.declarationList.declarations.some(declaration => ts.isIdentifier(declaration.name) && declaration.name.text === "modules"));
  if (!exported) throw new Error("El índice debe exportar modules explícitamente.");
  const imports = file.statements.filter(ts.isImportDeclaration);
  const bindings = new Map<string, string>();
  for (const declaration of imports) {
    const name = declaration.importClause?.name?.text;
    if (name && !declaration.importClause?.isTypeOnly && ts.isStringLiteral(declaration.moduleSpecifier)) bindings.set(name, declaration.moduleSpecifier.text);
  }
  const ids = new Set<string>();
  for (const entry of entries.elements) {
    if (!ts.isIdentifier(entry)) throw new Error("modules debe contener identificadores importados explícitamente.");
    const path = bindings.get(entry.text);
    const found = path && /^\.\/([a-z][a-z0-9]*)\/manifest$/.exec(path);
    if (!found || ids.has(found[1])) throw new Error("El índice de módulos es ambiguo o contiene duplicados.");
    ids.add(found[1]);
  }
  if (ids.has(id)) return text;
  const path = `./${id}/manifest`;
  const existing = imports.filter(declaration => ts.isStringLiteral(declaration.moduleSpecifier) && declaration.moduleSpecifier.text === path);
  if (existing.length > 1 || (existing.length && (!existing[0].importClause?.name || existing[0].importClause.isTypeOnly))) throw new Error("Import de módulo ambiguo; registra el módulo manualmente.");
  const name = existing[0]?.importClause?.name?.text ?? `${id}Module`;
  if (!existing.length && declares(file, name)) throw new Error(`El identificador ${name} ya está ocupado.`);
  const updated = append(text, entries, name);
  return existing.length ? updated : `import ${name} from ${JSON.stringify(path)};\n${updated}`;
}

export async function moduleRegistration(root: string, id: string): Promise<SourceChange[]> {
  const path = join(resolve(root), "src/modules/index.ts");
  const before = await readSource(path);
  if (before === null) throw new Error("Falta src/modules/index.ts; no se adivina un registro alternativo.");
  const after = registerModule(before, id);
  return before === after ? [] : [{ path, before, after }];
}

async function rejectLegacy(root: string, id: string) {
  if (await exists(join(root, "src/app/(auth)/erp", id))) throw new Error(`Ya existe una aplicación o ruta estática con ID ${id}. No se mezcla con un módulo declarativo.`);
}

export async function createModule(root: string, id: string, dryRun = false) {
  root = resolve(root); moduleId(id);
  await assertApplicationIdAvailable(root, id);
  await rejectLegacy(root, id);
  const directory = join(root, "src/modules", id);
  if (await exists(directory)) throw new Error(`El módulo ${id} ya existe; no se sobrescribe.`);
  const registration = await moduleRegistration(root, id);
  if (!registration.length) throw new Error(`El ID ${id} ya está registrado.`);
  const name = id[0].toUpperCase() + id.slice(1);
  const source = `import "server-only";\nimport { defineModule } from "@/lib/modules/define";\n\nexport default defineModule({\n  id: ${JSON.stringify(id)},\n  name: ${JSON.stringify(name)},\n  icon: "boxes",\n  models: {},\n});\n`;
  const changes: SourceChange[] = [{ path: join(directory, "manifest.ts"), before: null, after: source }, ...registration];
  await writeResource(root, changes, dryRun);
  return { id, changes };
}

export async function createModuleModel(root: string, id: string, name: string, dryRun = false) {
  root = resolve(root); moduleId(id);
  if (!/^[A-Z][A-Za-z0-9]{0,59}$/.test(name) || ["Fields", "Model", "DisplayRecord"].includes(name)) throw new Error("Usa un nombre PascalCase propio para el modelo, por ejemplo Fabricante.");
  const key = name.toLowerCase();
  if (key === "nuevo" || `${id}_${key}`.length > 63) throw new Error("Nombre de modelo reservado o demasiado largo.");
  await rejectLegacy(root, id);
  const manifestPath = join(root, "src/modules", id, "manifest.ts");
  const before = await readSource(manifestPath);
  if (before === null) throw new Error(`No existe el módulo ${id}; créalo con create:module.`);
  const file = sourceFile(before, "manifest.ts");
  const declaration = defineModuleObject(file);
  if (literal(property(declaration, "id")) !== id) throw new Error("El ID del manifest no coincide con el módulo.");
  const models = object(property(declaration, "models"));
  const keys = new Set<string>();
  for (const item of models.properties) {
    if ((!ts.isPropertyAssignment(item) && !ts.isShorthandPropertyAssignment(item)) || !item.name || (!ts.isIdentifier(item.name) && !ts.isStringLiteral(item.name))) throw new Error("models necesita claves literales para editarse sin ambigüedad.");
    const existing = item.name.text.toLowerCase();
    if (keys.has(existing)) throw new Error("models contiene claves duplicadas.");
    keys.add(existing);
  }
  if (keys.has(key)) throw new Error(`El modelo ${key} ya está declarado.`);
  if (declares(file, name)) throw new Error(`El identificador ${name} ya está ocupado en el manifest.`);
  const after = `import { ${name} } from "./models/${key}";\n` + append(before, models, `${key}: ${name}`);
  const source = `import "server-only";\nimport { Fields, Model, type DisplayRecord } from "@/lib/orm";\n\nexport class ${name} extends Model {\n  name = Fields.Text({ label: "Nombre", required: true, maxLength: 120, tracking: true });\n  active = Fields.Boolean({ label: "Activo", default: true, tracking: true });\n  displayName(record: DisplayRecord<${name}, "name">): string {\n    return record.name;\n  }\n  // Define aquí normalize, beforeSave y afterSave cuando tu negocio lo necesite.\n}\n`;
  const changes: SourceChange[] = [
    { path: join(root, "src/modules", id, "models", `${key}.ts`), before: null, after: source },
    { path: manifestPath, before, after },
  ];
  await writeResource(root, changes, dryRun);
  return { identity: { name, key }, changes };
}

/** Dispatch by files, without importing a manifest whose models may not be installed yet. */
export async function isDeclarativeModule(root: string, id: string) {
  if (!/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(id)) throw new Error("ID de aplicación inválido.");
  const declared = await exists(join(root, "src/modules", id, "manifest.ts"));
  if (declared) await rejectLegacy(root, id);
  return declared;
}
