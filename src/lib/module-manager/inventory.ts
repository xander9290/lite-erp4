import "server-only";
import { readdir } from "node:fs/promises";
import { join } from "node:path";
import ts from "typescript";
import { readSource } from "../scaffold/resource-write";
import { array, literal, manifestObject, object, property, sourceFile } from "../scaffold/source-edit";
import { defineModuleObject } from "../modules/eject";
import { readInstallationState } from "../orm/generator/installation-state";
import { prismaBlocks } from "../orm/generator/prisma-source";
import type { ManagedModule, ModuleKind } from "./types";
import { readRetirements } from "./retirements";

const idPattern = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
type Declaration = Pick<ManagedModule, "id" | "name" | "description" | "version" | "kind" | "models" | "depends" | "issues">;
export type ModuleInventory = { declarations: Declaration[]; tables: { model: string; name: string; columns: string[] }[]; managed: Set<string>; owners: Readonly<Record<string, string>>; retained?: ReadonlySet<string> };

function optional(node: ts.ObjectLiteralExpression, name: string): ts.Expression | undefined {
  const found = node.properties.filter(item => item.name && (ts.isIdentifier(item.name) || ts.isStringLiteral(item.name)) && item.name.text === name);
  if (!found.length) return undefined;
  return property(node, name);
}

/** Read literals only; available manifests are never imported or evaluated. */
export function inspectManifest(text: string, id: string, kind: Exclude<ModuleKind, "unknown">): Declaration {
  const file = sourceFile(text, "manifest.ts");
  const declaration = kind === "declarative" ? defineModuleObject(file) : manifestObject(file);
  if (literal(property(declaration, "id")) !== id) throw new Error("El ID del manifest no coincide con su directorio.");
  const value = (name: string, fallback: string) => { const node = optional(declaration, name); return node ? literal(node) : fallback; };
  const dependencyNode = optional(declaration, "depends");
  const depends = dependencyNode ? array(dependencyNode).elements.map(literal) : [];
  if (depends.some(dependency => !idPattern.test(dependency)) || new Set(depends).size !== depends.length) throw new Error("Dependencias no compatibles.");
  let models: string[];
  if (kind === "declarative") {
    models = object(property(declaration, "models")).properties.map(item => {
      if (!item.name || (!ts.isIdentifier(item.name) && !ts.isStringLiteral(item.name)) || !/^[a-z][a-z0-9]*$/.test(item.name.text)) throw new Error("Se necesitan claves de modelo literales.");
      const key = item.name.text;
      return id[0].toUpperCase() + id.slice(1) + key[0].toUpperCase() + key.slice(1);
    });
  } else models = array(property(declaration, "models")).elements.map(literal);
  if (new Set(models).size !== models.length || models.some(model => !/^[A-Z][A-Za-z0-9]*$/.test(model))) throw new Error("Modelos no compatibles.");
  return { id, kind, name: value("name", id), description: value("description", ""), version: value("version", "0.1.0"), models, depends, issues: [] };
}

async function directories(path: string) {
  try { return await readdir(path, { withFileTypes: true }); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return []; throw error; }
}

/** SQL names come from Prisma mappings, not application IDs or guessed prefixes. */
export function schemaTables(sources: Record<string, string>): ModuleInventory["tables"] {
  const blocks = Object.values(sources).flatMap(prismaBlocks).filter(block => block.kind === "model");
  const modelNames = new Set(blocks.map(block => block.name));
  return blocks.map(block => {
    const tableMap = /@@map\s*\(/.exec(block.maskedBody);
    const name = tableMap ? /@@map\(\s*"([^"\r\n]+)"\s*\)/.exec(block.body.slice(tableMap.index))?.[1] ?? block.name : block.name;
    const maskedLines = block.maskedBody.split(/\r?\n/);
    const columns = block.body.split(/\r?\n/).flatMap((line, index) => {
      const field = /^\s*(\w+)\s+([A-Za-z_]\w*)(\??)(\[\])?\s*(.*)$/.exec(line);
      if (!field || /@relation\b/.test(maskedLines[index])) return [];
      // Model-typed properties are relations even when they are not annotated.
      if (modelNames.has(field[2])) return [];
      const mapping = /@map\s*\(/.exec(maskedLines[index]);
      return [mapping ? /@map\(\s*"([^"\r\n]+)"\s*\)/.exec(line.slice(mapping.index))?.[1] ?? field[1] : field[1]];
    });
    return { model: block.name, name, columns };
  });
}

export async function readModuleInventory(root: string): Promise<ModuleInventory> {
  const snapshot = await readInstallationState(root);
  const retirements = await readRetirements(root);
  const declarations: Declaration[] = [];
  for (const [directory, baseKind] of [["src/modules", "declarative"], ["src/app/(auth)/erp", "manual"]] as const) {
    for (const entry of await directories(join(root, directory))) {
      if (!idPattern.test(entry.name) || (!entry.isDirectory() && !entry.isSymbolicLink())) continue;
      let kind: Exclude<ModuleKind, "unknown"> = baseKind;
      try {
        const manifest = await readSource(join(root, directory, entry.name, "manifest.ts"));
        if (manifest === null) continue;
        if (baseKind === "manual" && await readSource(join(root, directory, entry.name, "orm.config.ts")) !== null) kind = "scaffold";
        declarations.push(inspectManifest(manifest, entry.name, kind));
      } catch {
        declarations.push({ id: entry.name, name: entry.name, description: "", version: "", kind, models: [], depends: [], issues: ["No se pudo inspeccionar el manifest. Revisa su declaración y que sus archivos no sean enlaces."] });
      }
    }
  }
  for (const id of Object.keys(snapshot.state.modules)) {
    const retained = retirements.value.applications.find(item => item.id === id);
    if (!declarations.some(item => item.id === id)) declarations.push(retained ? { ...retained, description: "Aplicación retirada con sus datos y su identidad conservados.", issues: [] } : { id, name: id, description: "", version: "", kind: "unknown", depends: [], models: Object.entries(snapshot.owners).filter(([, owner]) => owner === id).map(([model]) => model), issues: ["Hay modelos instalados sin un manifest disponible."] });
  }
  if (!declarations.length) throw new Error("El catálogo de fuentes no está disponible en este servidor.");
  return { declarations, managed: new Set(Object.keys(snapshot.state.modules)), owners: snapshot.owners, tables: schemaTables(snapshot.sources), retained: new Set(retirements.value.applications.map(item => item.id)) };
}

export function resolveCatalogue(inventory: ModuleInventory, registered: ReadonlySet<string>, columns: readonly { table_name: string; column_name: string }[]): ManagedModule[] {
  const sqlTables = new Map<string, Set<string>>();
  for (const column of columns) { if (!sqlTables.has(column.table_name)) sqlTables.set(column.table_name, new Set()); sqlTables.get(column.table_name)!.add(column.column_name); }
  const declarations = [...inventory.declarations];
  for (const id of registered) if (!declarations.some(item => item.id === id)) declarations.push({ id, name: id, description: "", version: "", kind: "unknown", models: [], depends: [], issues: ["La aplicación está registrada pero sus fuentes no están disponibles."] });
  const result = new Map<string, ManagedModule>();
  for (const item of declarations) {
    const issues = [...item.issues];
    if (result.has(item.id)) { const previous = result.get(item.id)!; previous.issues.push("El ID aparece en más de una declaración."); previous.status = "review"; continue; }
    const tables = item.models.flatMap(model => {
      const table = inventory.tables.find(table => table.model === model);
      return table ? [{ model, name: table.name, present: sqlTables.has(table.name), missingColumns: table.columns.filter(name => !sqlTables.get(table.name)?.has(name)) }] : [];
    });
    const managed = inventory.managed.has(item.id);
    const owned = Object.entries(inventory.owners).filter(([, owner]) => owner === item.id).map(([model]) => model);
    const sameModels = !managed || (owned.length === item.models.length && owned.every(model => item.models.includes(model)));
    const complete = sameModels && tables.length === item.models.length && tables.every(table => table.present && !table.missingColumns.length);
    const physical = tables.some(table => table.present);
    let status: ManagedModule["status"] = complete && (managed || item.kind === "manual") ? "installed" : managed || physical ? "pending" : "available";
    if (!item.models.length && item.kind !== "manual") status = "empty";
    if (status === "installed" && !registered.has(item.id)) status = "unregistered";
    if (inventory.retained?.has(item.id)) status = complete && !registered.has(item.id) ? "retained" : "review";
    if (item.kind === "unknown" || issues.length || (!item.models.length && managed)) status = "review";
    result.set(item.id, { ...item, issues, status, tables, managed, registered: registered.has(item.id), dependents: [], missingDependencies: [] });
  }
  for (const item of result.values()) {
    item.dependents = [...result.values()].filter(candidate => candidate.depends.includes(item.id)).map(candidate => candidate.id).sort();
    const reaches = (id: string, seen: Set<string>): boolean => id === item.id || (!seen.has(id) && (seen.add(id), result.get(id)?.depends.some(next => reaches(next, seen)) === true));
    if (item.depends.some(id => reaches(id, new Set()))) { item.issues.push("Las dependencias declaradas forman un ciclo."); item.status = "review"; }
  }
  let changed: boolean;
  do {
    changed = false;
    for (const item of result.values()) {
      item.missingDependencies = item.depends.filter(id => result.get(id)?.status !== "installed");
      if (item.missingDependencies.length && item.status === "installed") { item.status = "review"; changed = true; }
    }
  } while (changed);
  return [...result.values()].sort((a, b) => a.name.localeCompare(b.name, "es"));
}
