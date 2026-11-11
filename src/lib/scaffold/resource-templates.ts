import "server-only";
import type { GenerationModel } from "../orm/generator/generate";
import type { modelIdentity } from "./models";
import { recordTemplates } from "./record-templates";

export type ViewKind = "list" | "card" | "kanban" | "form";
export type ViewOptions = { views?: readonly ViewKind[]; label?: string; form?: "page" | "modal"; group?: string; lookups?: Readonly<Record<string, string>> };
type Identity = ReturnType<typeof modelIdentity>;
const quote = JSON.stringify;

export function resourceTemplates(identity: Identity, entry: GenerationModel, modelImport: { source: string; exported: string }, options: ViewOptions) {
  const { app, slug, stem } = identity, model = entry.model, n = model.name;
  const base = `/erp/${app}/${slug}`, label = options.label ?? stem;
  const views = options.views ?? ["list", "form"];
  if (!views.length || new Set(views).size !== views.length || views.some(view => !["list", "card", "kanban", "form"].includes(view)) || !label.trim() || label.length > 100 || /[\u0000-\u001f]/.test(label)) throw new Error("Revisa las vistas y el título del recurso.");
  if (options.form !== undefined && !["page", "modal"].includes(options.form)) throw new Error("El formulario debe ser page o modal.");
  const fields = Object.entries(model.metadata);
  if (!fields.length || entry.clientFields.length !== fields.length || fields.some(([name, field]) => !entry.clientFields.includes(name) || field.sensitive)) throw new Error("Las vistas iniciales requieren campos publicados completos y no sensibles. Revisa clientFields; para privacidad o contratos parciales usa vistas/servicio propios, no publiques campos para evitar este rechazo.");
  const collections = views.filter(view => view !== "form");
  const hasForm = views.includes("form"), modal = options.form === "modal";
  if (modal && (!hasForm || !collections.length)) throw new Error("El formulario modal necesita form y una vista de colección.");
  const group = options.group ?? fields.filter(([, field]) => field.kind === "selection" && field.required && field.choices.length <= 12).map(([name]) => name).filter((_name, _index, values) => values.length === 1)[0];
  const groupMetadata = group ? model.metadata[group] : undefined;
  if (views.includes("kanban") && (groupMetadata?.kind !== "selection" || !groupMetadata.required || groupMetadata.choices.length > 12)) throw new Error("Kanban necesita --group campo con Selection obligatorio de hasta 12 opciones; decláralo primero en el modelo.");
  if (options.group && !views.includes("kanban")) throw new Error("--group sólo se usa con kanban.");
  const title = model.metadata.name?.kind === "text" ? "name" : fields.find(([, field]) => field.kind === "text")?.[0] ?? "id";
  const files: Record<string, string> = {};
  const columns = fields.slice(0, 12).map(([name, field]) => ({ field: name, label: field.label ?? name, type: field.kind === "integer" ? "integer" : field.kind === "boolean" ? "boolean" : field.kind === "datetime" ? "datetime" : "text", sortable: true, ...(field.kind === "boolean" || field.kind === "selection" ? { groupable: true } : {}) }));
  const searchFields = fields.filter(([, field]) => field.kind === "text").slice(0, 6).map(([name]) => name);
  const selections = fields.filter(([, field]) => field.kind === "selection");
  const choices = selections.map(([name]) => `${name}: recordFields.${name}.metadata.kind === "selection" ? recordFields.${name}.metadata.choices : []`).join(",\n  ");
  const columnCode = columns.map(column => model.metadata[column.field].kind === "selection" ? quote(column).slice(0, -1) + `, options: recordChoices.${column.field}}` : quote(column));
  files[`views/${slug}.list.ts`] = `import type { CollectionField } from "@/components/ui/collection/types";\n${selections.length ? `import { recordFields } from "../schemas/${slug}.schema";\nexport const recordChoices = {\n  ${choices}\n} as const;\n` : ""}\nexport const recordColumns = [${columnCode.join(",\n")} ] as const satisfies readonly CollectionField[];\nexport const recordSearchFields = ${quote(searchFields)} as const;\n`;
  files[`schemas/${slug}.schema.ts`] = `export { ${n}Fields as recordFields, ${n}RecordSchema as recordSchema, create${n}Defaults as createRecordDefaults, type ${n}RecordInput as RecordInput, type ${n}RecordValues as RecordValues } from "@/generated/orm/apps/${app}/${n}.schema";\n`;
  files[`models/${slug}.service.ts`] = `import "server-only";\nimport { createModelService } from "@/lib/orm/service";\nimport { ${n}Repository } from "@/generated/orm/bindings/${app}/${n}.store";\nimport { ${modelImport.exported} as recordModel } from ${quote("./" + modelImport.source.slice("./models/".length))};\nimport { recordColumns, recordSearchFields } from "../views/${slug}.list";\n\nexport const recordService = createModelService(recordModel, ${n}Repository, { columns: recordColumns, searchFields: recordSearchFields, audit: true${views.includes("kanban") ? `, kanban: { field: ${quote(group)} }` : ""} });\n`;
  const actions = recordTemplates({ id: app, name: label, modelName: n, table: model.table })["actions/record.actions.ts"];
  files[`actions/${slug}.actions.ts`] = actions
    .replaceAll(`"../models/record.service"`, `"../models/${slug}.service"`)
    .replaceAll(`"../schemas/record.schema"`, `"../schemas/${slug}.schema"`)
    .replace('import { recordLists } from "../models/record.lists";', '')
    .replaceAll("recordLists.all", "recordService.list")
    .replaceAll("recordLists.mine", "recordService.list")
    .replaceAll("recordLists.active", "recordService.list")
    .replaceAll(`/erp/${app}`, base);
  // No extra implicit list actions: developers can add explicit server domains when needed.
  files[`actions/${slug}.actions.ts`] = files[`actions/${slug}.actions.ts`]
    .replace(/  listMyRecords:.*\n/, "").replace(/  listActiveRecords:.*\n/, "")
    .replace(/export async function listMyRecords\([\s\S]*?\n}\n/, "")
    .replace(/export async function listActiveRecords\([\s\S]*?\n}\n/, "");

  const kinds = { list: "Lista", card: "Tarjetas", kanban: "Tablero" };
  const routes = collections.map((kind, index) => ({ kind, route: index ? `${base}/${kind === "card" ? "tarjetas" : kind === "kanban" ? "tablero" : "lista"}` : base }));
  const navigation = routes.length > 1 ? `<nav aria-label="Vistas de ${stem}" className="flex gap-2">${routes.map(route => `<Link className="btn btn-ghost btn-sm" href=${quote(route.route)}>${kinds[route.kind]}</Link>`).join("")}</nav>` : undefined;
  const breadcrumbs = `[{ label: "Aplicaciones", href: "/erp" }, { label: ${quote(app)}, href: "/erp/${app}" }, { label: ${quote(label)} }]`;
  for (const { kind, route } of routes) {
    const component = kind === "list" ? "ListView" : kind === "card" ? "CardView" : "KanbanView";
    const titleKind = kind === "list" ? "List" : kind === "card" ? "Card" : "Kanban";
    const actions = kind === "kanban" ? "loadKanban, moveRecord" : kind === "list" ? "listRecords, deleteRecords" : "listRecords";
    const collectionProps = kind === "list" ? `breadcrumbs={${breadcrumbs}} onDelete={deleteRecords}` : `titleField=${quote(title)}`;
    const formProps = hasForm ? `createHref=${quote(base + "/nuevo")} createLabel="Nuevo" recordHref=${quote(base + "/{id}")}` : kind === "list" ? "create={false}" : "";
    const groupProps = kind === "kanban" ? `groupField=${quote(group)} groups={recordChoices.${group}} onMove={moveRecord}` : "";
    files[`views/${stem}${titleKind}.tsx`] = `${navigation ? 'import Link from "next/link";\n' : ""}import ${component} from "@/components/ui/${kind === "card" ? "card" : kind === "kanban" ? "kanban" : "list"}/${component}";\nimport { ${actions} } from "../actions/${slug}.actions";\nimport { recordColumns, recordSearchFields${kind === "kanban" ? ", recordChoices" : ""} } from "./${slug}.list";\n\nexport default function ${stem}${titleKind}() {\n  return <${component} model=${quote(n)} title={${quote(label)}} load={${kind === "kanban" ? "loadKanban" : "listRecords"}} columns={recordColumns} searchFields={recordSearchFields} ${collectionProps} ${formProps} ${groupProps}${navigation ? ` headerActions={${navigation}}` : ""} />;\n}\n`;
    const suffix = route.slice(base.length);
    files[`${slug}${suffix}/page.tsx`] = `import View from "${suffix ? "../../" : "../"}views/${stem}${titleKind}";\nexport default function Page() { return <View />; }\n`;
  }
  if (hasForm) {
    const imports = new Set<string>();
    const relationImports: string[] = [];
    const controls = fields.map(([name, field]) => {
      let component = "FieldText", extra = "";
      if (field.kind === "boolean") component = "FieldBoolean";
      if (field.kind === "integer") { component = "FieldNumber"; extra = ` type="integer" allowNegative={${(field.min ?? -2147483648) < 0}}`; }
      if (field.kind === "datetime") { component = "FieldDate"; extra = ' type="datetime"'; }
      if (field.kind === "selection") { component = "FieldSelect"; extra = ` options={recordChoices.${name}}`; }
      if (field.kind === "text" && field.maxLength) extra = ` maxLength={${field.maxLength}}`;
      if (field.kind === "many2one") {
        component = "FieldMany2One";
        const lookup = options.lookups?.[name];
        if (lookup) {
          const [path, exported] = lookup.split("#");
          const alias = `lookup${name[0].toUpperCase() + name.slice(1)}`;
          relationImports.push(`import { ${exported} as ${alias} } from ${quote(path)};`);
          extra = ` load={${alias}}`;
        } else if (field.target === "Partner" || field.target === "User") extra = ` model=${quote(field.target === "Partner" ? "partner" : "user")}`;
        else throw new Error(`${name}: declara --lookup campo=modulo#exportAsync para resolver el Many2one con un proveedor autorizado.`);
      }
      imports.add(component);
      return `<${component}<RecordInput> name=${quote(name)} label={${quote(field.label ?? name)}} direction="inline"${field.required && field.kind !== "boolean" ? " required" : ""}${extra} />`;
    });
    let form = recordTemplates({ id: app, name: label, modelName: n, table: model.table })["views/RecordForm.tsx"];
    form = form.replaceAll(`/erp/${app}`, base).replaceAll("../actions/record.actions", `../actions/${slug}.actions`).replaceAll("../schemas/record.schema", `../schemas/${slug}.schema`)
      .replace('import FieldText from "@/components/ui/form/FieldText";\n', "").replace('import FieldBoolean from "@/components/ui/form/FieldBoolean";\n', "")
      .replace('import FormGroup from "@/components/ui/form/FormGroup";', `import FormGroup from "@/components/ui/form/FormGroup";\n${[...imports].map(component => `import ${component} from "@/components/ui/form/${component}";`).join("\n")}\n${relationImports.join("\n")}${selections.length ? `\nimport { recordChoices } from "./${slug}.list";` : ""}`)
      .replace(/<FormGroup[^>]*>[\s\S]*?<\/FormGroup>/, `<FormGroup legend="Datos generales">\n      ${controls.join("\n      ")}\n    </FormGroup>`)
      .replace('record.name || "Registro"', `String(record.${title} ?? "Registro")`)
      .replace("export default function RecordForm", `export default function ${stem}Form`)
      .replace('key={router.bfcacheId + ":" + attempt}', 'key={router.bfcacheId + ":" + id + ":" + attempt}');
    if (modal) form = form.replace('layout="page"', 'layout="content"');
    files[`views/${stem}Form.tsx`] = form;
    const renderer = modal ? `${stem}Modal` : `${stem}Form`;
    if (modal) {
      const primary = collections[0];
      const primaryView = `${stem}${primary === "list" ? "List" : primary === "card" ? "Card" : "Kanban"}`;
      files[`views/${stem}Modal.tsx`] = `"use client";\nimport { useEffect, useId, useRef } from "react";\nimport { useRouter } from "next/navigation";\nimport { useFormNavigation } from "@/components/ui/form/FormNavigationProvider";\nimport ${stem}Form from "./${stem}Form";\n\nexport default function ${stem}Modal({ id }: { id?: string }) {\n  const dialog = useRef<HTMLDialogElement>(null);\n  const title = useId();\n  const router = useRouter();\n  const navigation = useFormNavigation();\n  useEffect(() => { const node = dialog.current; node?.showModal(); return () => node?.close(); }, []);\n  const close = () => { void navigation.run(() => router.push(${quote(base)})); };\n  return <dialog ref={dialog} className="modal p-2" aria-labelledby={title} onCancel={event => { event.preventDefault(); close(); }} onClick={event => { if (event.target === event.currentTarget) close(); }}>\n    <div className="modal-box max-h-[calc(100dvh-2rem)] w-full max-w-5xl overflow-y-auto p-2">\n      <div className="mb-2 flex items-center justify-between"><h2 id={title}>{id ? "Editar" : "Nuevo"} · ${stem}</h2><button type="button" className="btn btn-ghost btn-sm" onClick={close}>Cerrar</button></div>\n      <${stem}Form id={id} />\n    </div>\n  </dialog>;\n}\n`;
      // The actual collection remains behind the modal on both new and edit routes.
      files[`${slug}/nuevo/page.tsx`] = `import View from "../../views/${primaryView}";\nimport Editor from "../../views/${renderer}";\nexport default function Page() { return <><View /><Editor /></>; }\n`;
    } else files[`${slug}/nuevo/page.tsx`] = `import Editor from "../../views/${renderer}";\nexport default function Page() { return <Editor />; }\n`;
    const behind = modal ? `import View from "../../views/${stem}${collections[0] === "list" ? "List" : collections[0] === "card" ? "Card" : "Kanban"}";\n` : "";
    files[`${slug}/[id]/page.tsx`] = `import { Suspense } from "react";\nimport Editor from "../../views/${renderer}";\n${behind}type Props = { params: Promise<{id: string}> };\nasync function OpenRecord({ params }: Props) { const { id } = await params; return <Editor id={id} />; }\nexport default function Page(props: Props) { return <>${modal ? "<View />" : ""}<Suspense fallback={<p role="status" className="p-6">Cargando…</p>}><OpenRecord {...props} /></Suspense></>; }\n`;
    if (!collections.length) files[`${slug}/page.tsx`] = `import Editor from "../views/${renderer}";\nexport default function Page() { return <Editor />; }\n`;
  }
  const menus = routes.length ? routes.map(({ kind, route }, index) => ({ id: `${slug}-${kind}`, label: index ? `${label} · ${kinds[kind]}` : label, href: route })) : [{ id: `${slug}-form`, label, href: base }];
  files[`views/${slug}.README.md`] = `# ${label}\n\nModelo ${n}. Vistas: ${views.join(", ")}. Formulario: ${options.form ?? "page"}.\n\nLos archivos TS/TSX son editables y no se regeneran automáticamente.\nEjecuta npm run orm:sync -- ${app} antes de abrir las rutas nuevas.\nEl servicio sigue siendo admin y revalida la sesión dentro de la transacción.\nAñade dominios y nuevas vistas como código de aplicación; no repitas este comando sobre archivos personalizados.\n`;
  return { files, menus };
}
