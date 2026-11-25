import ts from "typescript";
import type { FieldMetadata } from "../orm/fields";
import { object, sourceFile, unwrap } from "../scaffold/source-edit";

export type EjectKind = "form" | "modal" | "list" | "card" | "kanban";
export type EjectModel = {
  readonly key: string;
  /** Declaration class name as imported in the manifest. */
  readonly className?: string;
  /** Module-relative import of the class, e.g. "./models/tarea". */
  readonly classImport?: string;
  readonly fields: Readonly<Record<string, FieldMetadata>>;
  readonly preview: Readonly<Record<string, FieldMetadata>>;
  readonly many2many?: readonly string[];
  readonly listFields: readonly string[];
  /** Many2one fields with an authorized lookup (targets inside registered modules). */
  readonly lookups: readonly string[];
  readonly lines?: readonly string[];
  readonly collections?: readonly string[];
  readonly excludeExtensionFields?: readonly string[];
  /** Screen that registers the view (names it `<Model><Screen><Kind>`). */
  readonly screen?: string;
};

const pascal = (value: string) => value[0].toUpperCase() + value.slice(1);
/** `PartnerForm`, or `PartnerAddressesForm` for the `addresses` screen of `partner`. */
export const viewName = (key: string, kind: EjectKind, screen?: string) => `${key.split(".").map(pascal).join("")}${screen ? pascal(screen) : ""}${pascal(kind)}`;

function control(name: string, field: FieldMetadata, lookups: readonly string[]): [string, string] | null {
  const attr = `<Values> name=${JSON.stringify(name)}`;
  switch (field.kind) {
    case "image": return ["FieldImage", `<FieldImage${attr} widget="avatar" />`];
    case "boolean": return ["FieldBoolean", `<FieldBoolean${attr} direction="inline" />`];
    case "integer": return ["FieldNumber", `<FieldNumber${attr} type="integer" direction="inline" />`];
    case "datetime": return ["FieldDate", `<FieldDate${attr} type="datetime" direction="inline" />`];
    case "selection": return ["FieldSelect", `<FieldSelect${attr} direction="inline" />`];
    case "many2one": return lookups.includes(name) ? ["FieldMany2One", `<FieldMany2One${attr} direction="inline" />`] : null;
    default: return ["FieldText", `<FieldText${attr}${field.sequence ? ' widget="header"' : field.writeOnly ? ' widget="password"' : ""} direction="inline" />`];
  }
}

/** Editable form layout with the same controls as the default view; ModelForm keeps the wiring. */
export function formViewSource(model: EjectModel, kind: "form" | "modal" = "form"): string {
  const imports = new Set<string>();
  const lines: string[] = [];
  for (const [name, field] of Object.entries(model.fields)) {
    const result = control(name, field, model.lookups);
    if (!result) { lines.push(`{/* ${name}: Many2one sin proveedor de búsqueda autorizado (modelo fuera de los módulos). */}`); continue; }
    imports.add(result[0]); lines.push(result[1]);
  }
  for (const name of model.many2many ?? []) {
    imports.add("FieldRelationTag");
    lines.push(`<FieldRelationTag<Values> name=${JSON.stringify(name)} direction="inline" />`);
  }
  for (const [name, field] of Object.entries(model.preview)) {
    const component = field.kind === "image" ? "FieldImage" : field.kind === "integer" ? "FieldNumber" : field.kind === "text" ? "FieldText" : null;
    if (!component) continue;
    imports.add(component);
    lines.push(`<${component} mode="display" name=${JSON.stringify(name)}${field.kind === "integer" ? ' type="integer"' : ""} direction="inline" />`);
  }
  if (model.lines?.length) imports.add("FieldOne2many");
  const name = viewName(model.key, kind, model.screen);
  const hasClass = Boolean(model.className && model.classImport);
  const helpers = ["ModelExtensions", ...(model.collections?.length ? ["ModelChildCollections"] : [])];
  const exclude = model.excludeExtensionFields?.length ? ` excludeFields={${JSON.stringify(model.excludeExtensionFields)}}` : "";
  return `"use client";

import ModelForm, { ${helpers.join(", ")} } from "@/components/modules/ModelForm";
import FormGroup from "@/components/ui/form/FormGroup";
${[...imports].sort().map(component => `import ${component} from "@/components/ui/form/${component}";`).join("\n")}
import type { ModelClientConfig } from "@/lib/modules/config";
${hasClass ? `import type { FormValues } from "@/lib/orm/model";\nimport type { ${model.className} } from "../${model.classImport!.replace(/^\.\//, "")}";` : ""}

type Values = ${hasClass ? `FormValues<typeof ${model.className}>` : "Record<string, unknown>"};

/**
 * Vista expulsada con eject:view: edita libremente la maquetación.
 * ${kind === "modal" ? "Vista modal independiente: ModelForm conserva carga, guardado, permisos y cierre protegido." : "ModelForm aporta carga, guardado, recarga, breadcrumbs, historial y eliminación."}
 */
export default function ${name}({ config, id }: { config: ModelClientConfig; id?: string }) {
  return (
    <ModelForm config={config} id={id}>
      <FormGroup${kind === "modal" ? ' id="general"' : ""} legend="Datos generales">
        ${lines.join("\n        ")}
      </FormGroup>
      {/* Campos que otros módulos añaden a este modelo (extensiones). */}
      <ModelExtensions${exclude} />
${(model.lines ?? []).map(field => `      <FormGroup fullWidth><FieldOne2many name=${JSON.stringify(field)} /></FormGroup>\n`).join("")}${(model.collections ?? []).map(field => `      <ModelChildCollections name=${JSON.stringify(field)}${kind === "modal" ? ' openIn="modal"' : ""} />\n`).join("")}
    </ModelForm>
  );
}
`;
}

/** Editable column list. Columns only present; the server list policy still decides what is allowed. */
export function listViewSource(model: EjectModel, kind: Exclude<EjectKind, "form" | "modal"> = "list"): string {
  const name = viewName(model.key, kind, model.screen);
  return `import ModelCollection from "@/components/modules/ModelCollection";
import type { ModelClientConfig } from "@/lib/modules/config";

/**
 * Vista expulsada con eject:view: ordena, renombra o quita columnas.
 * Sólo se aceptan campos publicados por la política de lista del servidor.
 */
export default function ${name}({ config }: { config: ModelClientConfig }) {
  return (
    <ModelCollection
      config={config}
      view="${kind}"
      columns={[
        ${model.listFields.map(field => `{ field: ${JSON.stringify(field)} },`).join("\n        ")}
      ]}
    />
  );
}
`;
}

export function defineModuleObject(file: ts.SourceFile) {
  const exported = file.statements.filter(ts.isExportAssignment).map(statement => unwrap(statement.expression));
  const call = exported.find(node => ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === "defineModule");
  if (exported.length !== 1 || !call || !ts.isCallExpression(call) || call.arguments.length !== 1) throw new Error("El manifest debe exportar por defecto una única llamada a defineModule con un objeto literal.");
  return object(call.arguments[0]);
}
function propertyNamed(node: ts.ObjectLiteralExpression, name: string) {
  const matches = node.properties.filter(item => item.name && (ts.isIdentifier(item.name) || ts.isStringLiteral(item.name)) && item.name.text === name);
  if (matches.length > 1) throw new Error(`La propiedad ${name} está duplicada.`);
  const match = matches[0];
  if (match && !ts.isPropertyAssignment(match) && !ts.isShorthandPropertyAssignment(match)) throw new Error(`Se requiere la propiedad literal ${name}.`);
  return match as ts.PropertyAssignment | ts.ShorthandPropertyAssignment | undefined;
}

/** Locate the model entry and the class it declares, with its import path. */
export function manifestModel(text: string, key: string) {
  const file = sourceFile(text, "manifest.ts");
  const models = propertyNamed(defineModuleObject(file), "models");
  if (!models || !ts.isPropertyAssignment(models)) throw new Error("El manifest necesita models como objeto literal.");
  const entry = propertyNamed(object(models.initializer), key);
  if (!entry) throw new Error(`El modelo ${key} no está declarado en el manifest.`);
  const value = ts.isShorthandPropertyAssignment(entry) ? entry.name : unwrap(entry.initializer);
  let classNode: ts.Expression | undefined = value;
  if (ts.isObjectLiteralExpression(value)) {
    const model = propertyNamed(object(value), "model");
    classNode = model ? (ts.isShorthandPropertyAssignment(model) ? model.name : unwrap(model.initializer)) : undefined;
  }
  if (!classNode || !ts.isIdentifier(classNode)) throw new Error(`${key}: la clase del modelo debe ser un identificador importado.`);
  const className = classNode.text;
  const imports = file.statements.filter(ts.isImportDeclaration).filter(declaration => declaration.importClause?.namedBindings && ts.isNamedImports(declaration.importClause.namedBindings)
    && declaration.importClause.namedBindings.elements.some(element => element.name.text === className && !element.propertyName));
  if (imports.length !== 1 || !ts.isStringLiteral(imports[0].moduleSpecifier) || !imports[0].moduleSpecifier.text.startsWith("./models/")) throw new Error(`${key}: importa ${className} desde ./models/ con un import nombrado.`);
  return { file, entry, value, className, classImport: imports[0].moduleSpecifier.text };
}

/**
 * Register a lazy view in the manifest: `views: { form: () => import("./views/TareaForm") }`.
 * Models with `screens` register it inside the chosen screen (`screens.<id>.views`).
 */
export function registerView(text: string, key: string, kind: EjectKind, screen?: string): string {
  if (key.includes(".") && kind !== "modal") throw new Error("El eject de un modelo extendido admite sólo modal.");
  if (key.includes(".") && screen) throw new Error("Las extensiones no declaran pantallas; omite --screen.");
  const found = key.includes(".") ? manifestExtension(text, key) : manifestModel(text, key);
  const { file, className } = found;
  const indentOf = (node: ts.Node) => /[ \t]*$/.exec(text.slice(0, node.getStart(file)))![0];
  const screens = ts.isObjectLiteralExpression(found.value) && !key.includes(".") ? propertyNamed(found.value, "screens") : undefined;
  if (screens && !screen) throw new Error(`${key} declara screens: indica la pantalla con --screen=<id>.`);
  if (!screens && screen) throw new Error(`${key} no declara screens; omite --screen.`);
  let value = found.value;
  if (screens) {
    if (!ts.isPropertyAssignment(screens)) throw new Error(`${key}: screens debe ser un objeto literal.`);
    const entry = propertyNamed(object(screens.initializer), screen!);
    const initializer = entry && ts.isPropertyAssignment(entry) ? unwrap(entry.initializer) : undefined;
    if (!initializer || !ts.isObjectLiteralExpression(initializer)) throw new Error(`${key}: la pantalla ${screen} no está declarada como objeto literal en screens.`);
    value = initializer;
  }
  const loader = `${kind}: () => import("./views/${viewName(key, kind, screen)}")`;
  if (!ts.isObjectLiteralExpression(value)) {
    // `tarea: Tarea` → `tarea: { model: Tarea, views: { form: ... } }`
    return text.slice(0, value.getStart(file)) + `{ model: ${className}, views: { ${loader} } }` + text.slice(value.end);
  }
  const views = propertyNamed(value, "views");
  if (views) {
    if (!ts.isPropertyAssignment(views)) throw new Error(`${key}: views debe ser un objeto literal.`);
    const container = object(views.initializer);
    const existing = propertyNamed(container, kind);
    if (existing) {
      if (kind !== "form" && kind !== "modal" && ts.isPropertyAssignment(existing) && unwrap(existing.initializer).kind === ts.SyntaxKind.TrueKeyword) {
        return text.slice(0, existing.getStart(file)) + loader + text.slice(existing.end);
      }
      throw new Error(`${key} ya registra una vista ${kind}; no se sobrescribe.`);
    }
    return insert(text, file, container, loader, indentOf);
  }
  return insert(text, file, value, `views: { ${loader} }`, indentOf);
}

/** The extending module owns the view file; the base manifest is never edited. */
export function manifestExtension(text: string, target: string) {
  const file = sourceFile(text, "manifest.ts");
  const extensions = propertyNamed(defineModuleObject(file), "extends");
  if (!extensions || !ts.isPropertyAssignment(extensions)) throw new Error("El manifest necesita extends como objeto literal.");
  const entry = propertyNamed(object(extensions.initializer), target);
  if (!entry || !ts.isPropertyAssignment(entry)) throw new Error(`${target} no está declarado en extends.`);
  const value = unwrap(entry.initializer);
  const model = ts.isObjectLiteralExpression(value) ? propertyNamed(object(value), "model") : undefined;
  const identifier = model ? (ts.isShorthandPropertyAssignment(model) ? model.name : unwrap(model.initializer)) : value;
  if (!ts.isIdentifier(identifier)) throw new Error(`${target}: model debe ser un identificador de extensión.`);
  return { file, entry, value, className: identifier.text };
}

function insert(text: string, file: ts.SourceFile, node: ts.ObjectLiteralExpression, entry: string, indentOf: (node: ts.Node) => string) {
  const close = node.end - 1;
  const items = node.properties;
  const multiline = text.slice(node.getStart(file), node.end).includes("\n");
  if (!multiline) {
    const before = text.slice(0, close).replace(/\s*$/, "");
    const separator = items.length && !before.endsWith(",") && !before.endsWith("{") ? ", " : " ";
    return `${before}${separator}${entry} ${text.slice(close)}`;
  }
  const last = items[items.length - 1];
  const indent = last ? indentOf(last) : `${indentOf(node)}  `;
  const head = text.slice(0, last ? last.end : close).replace(/\s*$/, "");
  const comma = last ? "," : "";
  const tail = text.slice(last ? last.end : close).replace(/^\s*,?/, "");
  return `${head}${comma}\n${indent}${entry},${tail.startsWith("\n") ? "" : "\n" + indentOf(node)}${tail}`;
}
