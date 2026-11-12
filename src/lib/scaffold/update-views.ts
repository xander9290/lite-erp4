import "server-only";
import ts from "typescript";
import { join, resolve } from "node:path";
import { loadAppGenerationProfile } from "../orm/generator/profile";
import type { FieldMetadata } from "../orm/fields";
import { modelIdentity } from "./models";
import { sourceFile, object, property, array, literal, append } from "./source-edit";
import { readSource, writeResource, type SourceChange } from "./resource-write";

function walk(node: ts.Node, visit: (node: ts.Node) => void) { visit(node); node.forEachChild(child => walk(child, visit)); }
const tag = (node: ts.JsxElement | ts.JsxSelfClosingElement) => (ts.isJsxElement(node) ? node.openingElement : node).tagName.getText();
function fieldName(node: ts.JsxElement | ts.JsxSelfClosingElement) {
  const attributes = (ts.isJsxElement(node) ? node.openingElement : node).attributes.properties;
  const attribute = attributes.find(item => ts.isJsxAttribute(item) && item.name.getText() === "name");
  return attribute && ts.isJsxAttribute(attribute) && attribute.initializer && ts.isStringLiteral(attribute.initializer) ? attribute.initializer.text : null;
}
const component = (field: FieldMetadata) => ({ text: "FieldText", boolean: "FieldBoolean", integer: "FieldNumber", datetime: "FieldDate", selection: "FieldSelect", image: "FieldImage", many2one: "FieldMany2One" })[field.kind];

/** Narrow source edits only. Custom structures are rejected instead of regenerated. */
export function planViewUpdates(sources: { form: string | null; list: string | null; service: string; ui: string }, fields: Readonly<Record<string, FieldMetadata>>) {
  if (Object.values(fields).some(field => field.sensitive)) throw new Error("Las actualizaciones iniciales requieren un contrato público completo no sensible.");
  let { form, list, service } = sources;
  const names = Object.keys(fields), ui = sourceFile(sources.ui);
  const uiDeclaration = ui.statements.find(statement => ts.isVariableStatement(statement) && statement.declarationList.declarations.some(declaration => declaration.name.getText() === "recordUI"));
  if (!uiDeclaration || !ts.isVariableStatement(uiDeclaration)) throw new Error("Se requiere recordUI explícito; migra primero el contrato de presentación.");
  const uiObject = object(uiDeclaration.declarationList.declarations.find(item => item.name.getText() === "recordUI")!.initializer!);
  for (const name of names) {
    if (fields[name].kind === "many2one") {
      const lookups = object(property(uiObject, "lookups"));
      property(lookups, name); // Missing providers must be configured/authorized before proposing a usable control.
    }
    if (fields[name].kind === "image" && !sources.ui.includes("uploads: imageUploads")) throw new Error("Conecta imageUploads en recordUI.uploads antes de añadir controles Image.");
  }
  if (form) {
    if (!/model=\{recordUI\}/.test(form)) throw new Error("El formulario debe estar enlazado mediante model={recordUI}; no se modifica un formulario manual.");
    const file = sourceFile(form, "form.tsx"), existing = new Set<string>(), containers: ts.JsxElement[] = [];
    let groups = 0;
    let dynamic = false;
    walk(file, node => {
      if ((ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) && tag(node) === "FormGroup") groups++;
      if (ts.isJsxElement(node) && tag(node) === "FormGroup") containers.push(node);
      if ((ts.isJsxSelfClosingElement(node) || ts.isJsxElement(node)) && /^Field[A-Z]/.test(tag(node))) {
        const attributes = (ts.isJsxElement(node) ? node.openingElement : node).attributes.properties;
        if (attributes.some(ts.isJsxSpreadAttribute)) dynamic = true;
        const name = fieldName(node); if (name) existing.add(name); else dynamic = true;
      }
    });
    const missing = names.filter(name => !existing.has(name));
    if (missing.length) {
      if (dynamic || containers.length !== 1 || groups !== 1) throw new Error("Formulario ambiguo: se necesita un único FormGroup y nombres literales para proponer campos.");
      const controls = missing.map(name => {
        const field = fields[name], control = component(field);
        return `      <${control}<RecordInput> name=${JSON.stringify(name)} direction="inline"${field.kind === "integer" ? ' type="integer"' : field.kind === "datetime" ? ' type="datetime"' : ""} />`;
      });
      const at = containers[0].closingElement.getStart(file);
      form = form.slice(0, at) + controls.join("\n") + "\n    " + form.slice(at);
      for (const control of new Set(missing.map(name => component(fields[name])))) {
        const importPath = `@/components/ui/form/${control}`;
        const present = file.statements.filter(ts.isImportDeclaration).find(node => node.importClause?.name?.text === control);
        if (present && (!ts.isStringLiteral(present.moduleSpecifier) || present.moduleSpecifier.text !== importPath)) throw new Error(`Import personalizado ambiguo: ${control}.`);
        if (!present) {
          if (file.statements.some(node => ts.isImportDeclaration(node) && new RegExp(`\\b${control}\\b`).test(node.getText(file))) || new RegExp(`\\b(?:const|let|function|class)\\s+${control}\\b`).test(form)) throw new Error(`Identificador personalizado ambiguo: ${control}.`);
          const last = file.statements.filter(ts.isImportDeclaration).at(-1);
          if (!last) throw new Error("El formulario necesita imports explícitos.");
          const position: number = form.indexOf(last.getText(file)) + last.getText(file).length;
          form = form.slice(0, position) + `\nimport ${control} from "${importPath}";` + form.slice(position);
        }
      }
    }
  }
  if (list) {
    const file = sourceFile(list, "list.tsx"), lists: ts.JsxElement[] = [], present = new Set<string>();
    walk(file, node => {
      if (ts.isJsxElement(node) && tag(node) === "ListView") lists.push(node);
      if (ts.isJsxSelfClosingElement(node) && tag(node) === "ListView.Field") { const name = fieldName(node); if (!name) throw new Error("Columna dinámica: revisa manualmente esta lista."); present.add(name); }
    });
    if (lists.some(list => list.children.some(child => ts.isJsxExpression(child) || ts.isJsxElement(child) || ts.isJsxFragment(child)))) throw new Error("Lista dinámica o anidada: revisa sus columnas manualmente.");
    const missing = names.filter(name => !present.has(name));
    if (missing.length) {
      if (lists.length !== 1 || !/fields=\{recordFields\}/.test(list) || present.size + missing.length > 12) throw new Error("La lista requiere columnas JSX explícitas (máximo 12); no se sobrescribe una configuración personalizada.");
      const at = lists[0].closingElement.getStart(file);
      list = list.slice(0, at) + missing.map(name => `    <ListView.Field name=${JSON.stringify(name)}${fields[name].kind !== "image" ? " sortable" : ""}${["selection", "boolean"].includes(fields[name].kind) ? " groupable" : ""} />`).join("\n") + "\n  " + list.slice(at);
    }
  }
  // Updating query capabilities is part of the visible diff, never inferred at request time.
  const serviceFile = sourceFile(service);
  let policy: ts.ObjectLiteralExpression | undefined;
  walk(serviceFile, node => { if (ts.isCallExpression(node) && node.expression.getText() === "createModelService") { if (node.arguments.length !== 3) throw new Error("El servicio necesita tres argumentos explícitos."); if (policy) throw new Error("Servicio ambiguo."); policy = object(property(object(node.arguments[2]), "list")); } });
  if (!policy) throw new Error("El servicio necesita una política list literal independiente de la vista.");
  const originalFields = array(property(policy, "fields")).elements.map(literal);
  const edits: { start: number; end: number; text: string }[] = [];
  for (const [key, include] of Object.entries({ fields: (): boolean => true, sortable: (field: FieldMetadata) => field.kind !== "image", filterable: (field: FieldMetadata) => field.kind !== "image", groupable: (field: FieldMetadata) => ["selection", "boolean"].includes(field.kind) })) {
    const current = array(property(policy, key)), existing = current.elements.map(literal);
    const additions = names.filter(name => !originalFields.includes(name) && include(fields[name]) && !existing.includes(name));
    if (key === "fields" && existing.length + additions.length > 12) throw new Error("Selecciona hasta 12 campos para la política de lista antes de continuar.");
    if (additions.length) { const after = append(service, current, additions.map(name => JSON.stringify(name)).join(", ")); edits.push({ start: current.getStart(), end: current.end, text: after.slice(current.getStart(), after.length - (service.length - current.end)) }); }
  }
  for (const edit of edits.sort((a,b) => b.start-a.start)) service = service.slice(0, edit.start)+edit.text+service.slice(edit.end);
  return { form, list, service };
}

export async function updateViews(root: string, app: string, name: string, write = false) {
  root = resolve(root);
  const identity = modelIdentity(app, name), profile = await loadAppGenerationProfile(root, app);
  const entry = profile?.module.models.find(item => item.model.name === identity.name);
  if (!entry || (entry.clientFields.length !== Object.keys(entry.model.metadata).length || Object.keys(entry.model.metadata).some(name => !entry.clientFields.includes(name)))) throw new Error("Registra el modelo y publica su contrato completo antes de proponer vistas.");
  const base = join(root, "src/app/(auth)/erp", app);
  const paths = { form: join(base, `views/${identity.stem}Form.tsx`), list: join(base, `views/${identity.stem}List.tsx`), service: join(base, `models/${identity.slug}.service.ts`), ui: join(base, `schemas/${identity.slug}.ui.ts`) };
  const sources = { form: await readSource(paths.form), list: await readSource(paths.list), service: await readSource(paths.service), ui: await readSource(paths.ui) };
  if (!sources.form && !sources.list) throw new Error("No hay vistas existentes para actualizar. Usa create:views primero.");
  if (!sources.service || !sources.ui) throw new Error("Se requieren servicio y contrato UI enlazados.");
  const proposed = planViewUpdates({ ...sources, service: sources.service, ui: sources.ui }, entry.model.metadata);
  const changes: SourceChange[] = [];
  for (const key of ["form", "list", "service"] as const) if (proposed[key] !== sources[key] && proposed[key] !== null) changes.push({ path: paths[key], before: sources[key], after: proposed[key]! });
  await writeResource(root, changes, !write);
  return changes;
}
