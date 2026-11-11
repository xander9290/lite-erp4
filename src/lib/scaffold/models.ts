import "server-only";
import ts from "typescript";
import { readdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { loadAppGenerationProfile } from "../orm/generator/profile";
import { readSource, writeResource, type SourceChange } from "./resource-write";
import { sourceFile, variable, object, property, array, literal, append, manifestObject } from "./source-edit";
import { resourceTemplates, type ViewOptions } from "./resource-templates";

const pascal = (value: string) => value.split("-").map(part => part[0].toUpperCase() + part.slice(1)).join("");
export function modelIdentity(app: string, name: string) {
  if (!/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(app) || !/^[A-Z][A-Za-z0-9]{0,59}$/.test(name)) throw new Error("Usa el ID de la aplicación y un nombre de modelo PascalCase, por ejemplo flota Fabricante.");
  const prefix = pascal(app);
  const stem = name.startsWith(prefix) ? name.slice(prefix.length) : name;
  if (!stem || !/^[A-Z]/.test(stem)) throw new Error("El modelo necesita un nombre propio después del prefijo de aplicación.");
  const slug = stem.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
  if (["nuevo", "api", "auth", "perfil", "sample", "activos", "mis-registros", "lista", "tarjetas", "tablero"].includes(slug)) throw new Error("El nombre coincide con una ruta reservada.");
  const table = `${app.replaceAll("-", "_")}_${slug.replaceAll("-", "_")}`;
  if (table.length > 63) throw new Error("Acorta el nombre para respetar el límite de identificadores de PostgreSQL.");
  return { app, stem, slug, name: prefix + stem, table, exported: `${(prefix + stem)[0].toLowerCase()}${(prefix + stem).slice(1)}Model` };
}

async function appSources(root: string, app: string) {
  const directory = join(root, "src/app/(auth)/erp", app);
  const configPath = join(directory, "orm.config.ts"), manifestPath = join(directory, "manifest.ts");
  const config = await readSource(configPath), manifest = await readSource(manifestPath);
  if (!config || !manifest) throw new Error("La aplicación necesita orm.config.ts y manifest.ts antes de añadir modelos.");
  const configFile = sourceFile(config), manifestFile = sourceFile(manifest);
  const moduleDeclaration = object(property(object(variable(configFile, "generationProfile")), "module"));
  const declaration = manifestObject(manifestFile);
  if (literal(property(moduleDeclaration, "id")) !== app || literal(property(declaration, "id")) !== app) throw new Error("El ID no coincide con los archivos de la aplicación.");
  return { directory, configPath, manifestPath, config, manifest, configFile, manifestFile, module: moduleDeclaration, declaration };
}

export async function createModel(root: string, app: string, name: string, dryRun = false) {
  root = resolve(root);
  const identity = modelIdentity(app, name);
  const sources = await appSources(root, app);
  const profile = await loadAppGenerationProfile(root, app);
  if (!profile || profile.module.models.some(entry => entry.model.name === identity.name)) throw new Error("El modelo ya existe; para generar vistas usa create:views.");
  for (const directory of await readdir(join(root, "src/app/(auth)/erp"), { withFileTypes: true })) {
    if (!directory.isDirectory() || directory.name === app) continue;
    const source = await readSource(join(root, "src/app/(auth)/erp", directory.name, "manifest.ts"));
    if (!source) continue;
    const other = manifestObject(sourceFile(source));
    if (array(property(other, "models")).elements.map(literal).includes(identity.name)) throw new Error(`El modelo ${identity.name} ya pertenece a ${directory.name}.`);
  }
  const models = array(property(sources.declaration, "models"));
  if (models.elements.some(node => literal(node) === identity.name)) throw new Error("El modelo ya está en el manifest.");
  if (new RegExp(`\\b${identity.exported}\\b`).test(sources.config)) throw new Error("El identificador de importación ya está ocupado.");
  const config = `import { ${identity.exported} } from "./models/${identity.stem}";\n` + append(sources.config, array(property(sources.module, "models")), `{ model: ${identity.exported}, clientFields: ["name", "active"] }`);
  const source = `import "server-only";\nimport { Fields, Model, defineModel } from "@/lib/orm";\n\nexport class ${identity.name} extends Model {\n  name = Fields.Text({ label: "Nombre", required: true, maxLength: 120, tracking: true });\n  active = Fields.Boolean({ label: "Activo", default: true, tracking: true });\n  // Define aquí normalize, beforeSave y afterSave cuando tu negocio lo necesite.\n}\n\nexport const ${identity.exported} = defineModel(${identity.name}, { name: ${JSON.stringify(identity.name)}, table: ${JSON.stringify(identity.table)} });\n`;
  const changes: SourceChange[] = [
    { path: join(sources.directory, "models", `${identity.stem}.ts`), before: null, after: source },
    { path: sources.configPath, before: sources.config, after: config },
    { path: sources.manifestPath, before: sources.manifest, after: append(sources.manifest, models, JSON.stringify(identity.name)) },
  ];
  await writeResource(root, changes, dryRun);
  return { identity, changes };
}

/** Locate the server model import already declared in the generation profile. */
function modelImport(file: ts.SourceFile, entry: ts.ObjectLiteralExpression) {
  const reference = property(entry, "model");
  if (!ts.isIdentifier(reference)) throw new Error("El perfil debe referenciar el modelo mediante un import nombrado.");
  for (const statement of file.statements.filter(ts.isImportDeclaration)) {
    const bindings = statement.importClause?.namedBindings;
    if (!bindings || !ts.isNamedImports(bindings)) continue;
    const specifier = bindings.elements.find(element => element.name.text === reference.text);
    if (specifier && ts.isStringLiteral(statement.moduleSpecifier)) return { source: statement.moduleSpecifier.text, exported: specifier.propertyName?.text ?? specifier.name.text };
  }
  throw new Error("No se pudo resolver el import del modelo; no se adivinan rutas personalizadas.");
}

export async function createViews(root: string, app: string, name: string, options: ViewOptions, dryRun = false) {
  root = resolve(root);
  const identity = modelIdentity(app, name);
  const sources = await appSources(root, app);
  const profile = await loadAppGenerationProfile(root, app);
  const entry = profile?.module.models.find(entry => entry.model.name === identity.name);
  if (!entry || !profile) throw new Error("Primero declara y registra el modelo con create:model o en orm.config.ts.");
  const manifestModels = array(property(sources.declaration, "models")).elements.map(literal);
  if (!manifestModels.includes(entry.model.name)) throw new Error("Registra el modelo en manifest.models antes de generar vistas.");
  const entries = array(property(sources.module, "models")).elements.map(element => object(element as ts.Expression));
  // Preserve custom export names, including models that predate this generator.
  const imported = entries.map(node => ({ node, import: modelImport(sources.configFile, node) }));
  const index = profile.module.models.indexOf(entry);
  const reference = imported[index]?.import;
  if (!reference?.source.startsWith("./models/") || !/^\.\/models\/[A-Za-z0-9_-]+$/.test(reference.source)) throw new Error("El modelo debe importarse desde un archivo TS propio de models.");
  const modelSource = await readSource(join(sources.directory, reference.source + ".ts"));
  if (!modelSource) throw new Error("No existe el archivo del modelo.");
  const menuExpressions = sources.declaration.properties.filter(p => p.name && (ts.isIdentifier(p.name) || ts.isStringLiteral(p.name)) && p.name.text === "menus");
  let menus: ts.ArrayLiteralExpression | undefined;
  const ids = new Set<string>(), hrefs = new Set<string>();
  if (menuExpressions.length) {
    menus = array(property(sources.declaration, "menus"));
    const visit = (node: ts.Expression) => {
      const item = object(node);
      ids.add(literal(property(item, "id")));
      const group = item.properties.some(p => p.name && (ts.isIdentifier(p.name) || ts.isStringLiteral(p.name)) && p.name.text === "items");
      if (group) array(property(item, "items")).elements.forEach(element => visit(element as ts.Expression));
      else hrefs.add(literal(property(item, "href")));
    };
    menus.elements.forEach(element => visit(element as ts.Expression));
  }
  const template = resourceTemplates(identity, entry, reference, options);
  for (const menu of template.menus) if (ids.has(menu.id) || hrefs.has(menu.href)) throw new Error(`Ya existe un menú o ruta para ${menu.href}. No se duplicará.`);
  for (const [field, lookup] of Object.entries(options.lookups ?? {})) {
    if (entry.model.metadata[field]?.kind !== "many2one") throw new Error(`El lookup ${field} no corresponde a un Many2one.`);
    if (!/^@\/app\/\(auth\)\/erp\/[a-zA-Z0-9_./()-]+#[a-zA-Z][a-zA-Z0-9]*$/.test(lookup) || lookup.includes("..")) throw new Error("Usa --lookup campo=@/app/(auth)/erp/app/actions/archivo#exportAsync.");
    const [path, exported] = lookup.split("#");
    const content = await readSource(join(root, "src", path.slice(2) + ".ts"));
    if (!content || !/^\s*["']use server["'];?/.test(content)) throw new Error("El lookup debe proceder de un módulo use-server existente.");
    const declaration = sourceFile(content).statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === exported);
    if (!declaration || !ts.isFunctionDeclaration(declaration) || !declaration.modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.ExportKeyword) || declaration.modifiers.some(modifier => modifier.kind === ts.SyntaxKind.DefaultKeyword) || !declaration.modifiers.some(modifier => modifier.kind === ts.SyntaxKind.AsyncKeyword)) throw new Error("El lookup necesita un export async nombrado explícito.");
  }
  const menuSource = template.menus.map(menu => JSON.stringify({ ...menu, access: "admin", match: "exact" })).join(",\n    ");
  const manifest = menus ? append(sources.manifest, menus, menuSource) : append(sources.manifest, sources.declaration, `menus: [${menuSource}]`);
  const changes: SourceChange[] = [...Object.entries(template.files).map(([name, after]) => ({ path: join(sources.directory, name), before: null, after })), { path: sources.manifestPath, before: sources.manifest, after: manifest }];
  // Model fields are read once from trusted local code; ensure its source was not edited mid-plan.
  if (await readSource(join(sources.directory, reference.source + ".ts")) !== modelSource || await readSource(sources.configPath) !== sources.config) throw new Error("El modelo o perfil cambió durante la planificación.");
  await writeResource(root, changes, dryRun);
  return { identity, changes };
}

