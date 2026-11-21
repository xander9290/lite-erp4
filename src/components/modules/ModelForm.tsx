"use client";

import { Fragment, createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { formDeleteReturnHref } from "@/components/ui/form/formDeletion";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { RefreshCw } from "lucide-react";
import FormView from "@/components/ui/form/FormView";
import FormViewLoader from "@/components/ui/form/FormViewLoader";
import FormGroup from "@/components/ui/form/FormGroup";
import FieldOne2many from "@/components/ui/form/FieldOne2many";
import FieldText from "@/components/ui/form/FieldText";
import FieldBoolean from "@/components/ui/form/FieldBoolean";
import FieldNumber from "@/components/ui/form/FieldNumber";
import FieldDate from "@/components/ui/form/FieldDate";
import FieldSelect from "@/components/ui/form/FieldSelect";
import FieldImage from "@/components/ui/form/FieldImage";
import FieldRelationTag from "@/components/ui/form/FieldRelationTag";
import FieldMany2One from "@/components/ui/form/FieldMany2One";
import { useFormNavigation } from "@/components/ui/form/FormNavigationProvider";
import { useAlerts } from "@/components/ui/alerts/AlertProvider";
import { buildModelUI, type ModelUI } from "@/lib/modules/client";
import type { ModelClientConfig } from "@/lib/modules/config";
import type { FieldMetadata } from "@/lib/orm/fields";
import ModelCollection from "./ModelCollection";
import FieldVisibility from "@/components/ui/form/FieldVisibility";
import type { ListState } from "@/lib/list/types";
import { modelChildren, modelRelationLookup, modelAction, modelActivity, modelDelete, modelNote, modelRead, modelSave } from "@/lib/modules/actions";
import { modelUiCapabilities } from "@/lib/access/capabilities";
import { useModelExtensionInsertions, useModelExtensionViews } from "./ModelExtensionViews";
import { InsertionProvider, useInsertionFallback } from "@/components/ui/form/insertions/Insertions";

type Values = Record<string, unknown>;

function control(ui: ModelUI, name: string, field: FieldMetadata) {
  switch (field.kind) {
    case "image": return <FieldImage<Values> key={name} name={name} widget="avatar" />;
    case "boolean": return <FieldBoolean<Values> key={name} name={name} direction="inline" />;
    case "integer": return <FieldNumber<Values> key={name} name={name} type="integer" direction="inline" />;
    case "datetime": return <FieldDate<Values> key={name} name={name} type="datetime" direction="inline" />;
    case "selection": return <FieldSelect<Values> key={name} name={name} direction="inline" />;
    case "many2one": return Object.hasOwn(ui.config.lookups, name) ? <FieldMany2One<Values> key={name} name={name} direction="inline" /> : null;
    default: return <FieldText<Values> key={name} name={name} widget={field.sequence ? "header" : field.writeOnly ? "password" : "text"} direction="inline" />;
  }
}

function display(name: string, field: FieldMetadata) {
  return field.kind === "image" ? <FieldImage key={name} mode="display" name={name} direction="inline" />
    : field.kind === "integer" ? <FieldNumber key={name} mode="display" name={name} type="integer" direction="inline" />
    : field.kind === "text" ? <FieldText key={name} mode="display" name={name} direction="inline" /> : null;
}

const ModelUIContext = createContext<ModelUI | null>(null);

/**
 * Read-only relations of the record (children created in their own form): one paginated,
 * authorized collection per relation, filtered by the server to this record. Ejected forms
 * place `<ModelChildCollections />` (or `name` for one relation) where they should appear.
 */
export function ModelChildCollections({ name }: { name?: string }) {
  const ui = useContext(ModelUIContext);
  const recordId = useWatch({ name: "id" }) as string | undefined;
  const collections = Object.entries(ui?.config.collections ?? {}).filter(([field]) => !name || field === name);
  if (!ui || !collections.length) return null;
  return <>{collections.map(([field, collection]) => <FieldVisibility key={field} name={field} invisible={collection.invisible}><FormGroup fullWidth legend={collection.label}>
    {recordId ? <ModelCollection embedded config={collection.config} view="list" title={collection.label} paramPrefix={field}
      createDefaults={{ [collection.inverse]: recordId }}
      source={{ load: (state: ListState) => modelChildren(ui.config.id, field, recordId, state), filterLookups: Object.fromEntries(Object.keys(collection.config.lookups).map(lookup => [lookup, (request: import("@/lib/many2one/model-lookup").ModelLookupRequest) => modelRelationLookup(collection.config.id, lookup, { request, draft: {}, filter: true })])) }} />
      : <p className="text-sm text-base-content/60">Guarda el registro para ver {collection.label.toLowerCase()}.</p>}
  </FormGroup></FieldVisibility>)}</>;
}

/** Content of an insertion file whose target is missing or rejected (never lost). */
function InsertionFallback({ module, label }: { module: string; label: string }) {
  const content = useInsertionFallback(module);
  return content ? <FormGroup legend={label}>{content}</FormGroup> : null;
}

/**
 * Fields added by other modules: custom views own their layout; automatic fields use a group
 * per extending module; modules with `insertions` place their own fields (here only what
 * could not be placed). Ejected forms place `<ModelExtensions />` at the insertion point.
 * Without it, extension values are still kept and saved by the form.
 */
export function ModelExtensions({ excludeFields = [] }: { excludeFields?: readonly string[] } = {}) {
  const ui = useContext(ModelUIContext);
  const views = useModelExtensionViews();
  if (!ui?.config.extensions?.length) return null;
  return <>{ui.config.extensions.map(extension => {
    if (extension.insertions?.includes("form")) return <InsertionFallback key={extension.module} module={extension.module} label={extension.label} />;
    // Custom forms may lay out inherited fields themselves; keep other extensions automatic.
    const fields = extension.fields.filter(name => !excludeFields.includes(name));
    if (!fields.length) return null;
    const customView = views[extension.module];
    if (customView != null) return <Fragment key={extension.module}>{customView}</Fragment>;
    return <FormGroup key={extension.module} legend={extension.label}>
      {fields.map(name => Object.hasOwn(ui.config.fields, name) ? control(ui, name, ui.config.fields[name]) : Object.hasOwn(ui.config.preview, name) ? display(name, ui.config.preview[name]) : Object.hasOwn(ui.recordUI.many2many, name) ? <FieldRelationTag key={name} name={name} direction="inline" /> : null)}
    </FormGroup>;
  })}</>;
}

/** Controls derived from metadata, used when a view does not provide its own layout. */
export function ModelFields({ ui }: { ui: ModelUI }) {
  const extended = new Set(ui.config.extensions?.flatMap(extension => extension.fields) ?? []);
  const controls = Object.entries(ui.config.fields).filter(([name]) => !extended.has(name)).map(([name, field]) => control(ui, name, field));
  const previews = Object.entries(ui.config.preview).filter(([name]) => !extended.has(name)).map(([name, field]) => display(name, field));
  return <><FormGroup id="general" legend="Datos generales">{controls}{previews}{Object.keys(ui.recordUI.many2many).filter(name => !extended.has(name)).map(name => <FieldRelationTag key={name} name={name} direction="inline" />)}</FormGroup><ModelExtensions />{Object.keys(ui.recordUI.lines).map(name => <FormGroup fullWidth key={name}><FieldOne2many name={name} /></FormGroup>)}<ModelChildCollections /></>;
}

function Editor({ ui, record, displayName, onReload, children }: { ui: ModelUI; record: Values; displayName?: string; onReload?: () => void; children?: ReactNode }) {
  const router = useRouter();
  const params = useSearchParams();
  const { config } = ui;
  const capabilities = modelUiCapabilities(config.capabilities);
  const returnHref = formDeleteReturnHref(params.get("returnTo"), config.route);
  const returnQuery = `?returnTo=${encodeURIComponent(returnHref)}`;
  const [savedId, setSavedId] = useState(record.id as string | undefined);
  const [savedName, setSavedName] = useState(displayName);
  const methods = useForm<Values>({ resolver: zodResolver(ui.schema as never), defaultValues: record });
  const insertions = useModelExtensionInsertions("form", config.id);
  const insertionModules = useMemo(() => (config.extensions ?? []).map(extension => ({ module: extension.module, depends: extension.depends ?? [] })), [config.extensions]);
  return <ModelUIContext.Provider value={ui}><FormView
    layout="page"
    breadcrumbs={[{ label: "Aplicaciones", href: "/erp" }, { label: config.label, href: returnHref }, { label: savedId ? savedName || "Registro" : "Nuevo registro" }]}
    title={savedId ? "Editar registro" : "Nuevo registro"}
    methods={methods}
    model={ui.recordUI as never}
    activity={{ recordId: savedId, load: request => modelActivity(config.id, request), addNote: request => modelNote(config.id, request) }}
    mode={savedId ? "edit" : "create"}
    readOnly={savedId ? !capabilities.write : !capabilities.create}
    onSubmit={values => modelSave(config.id, values)}
    deletion={capabilities.unlink ? { action: selection => modelDelete(config.id, selection), returnHref: config.route, allowReadOnly: true } : undefined}
    // FormButton: published @action names only; the server validates them and re-authorizes.
    runAction={(action, target, params) => modelAction(config.id, { action, ...target, ...(params !== undefined ? { params } : {}) })}
    actions={config.actions}
    onNew={savedId && capabilities.create ? () => router.push(`${config.route}/nuevo${returnQuery}`) : undefined}
    onSaved={(values, _audit, name) => {
      setSavedId(values.id as string);
      setSavedName(name);
      if (!record.id && values.id) router.replace(`${config.route}/${encodeURIComponent(values.id as string)}${returnQuery}`);
      router.refresh();
    }}
    menuActions={onReload ? [{ id: "reload", label: "Recargar registro", icon: <RefreshCw size={16} />, onSelect: onReload }] : undefined}
    footer={<p className="text-xs text-base-content/55">Los cambios se guardan al presionar Guardar.</p>}
  >
    <InsertionProvider modules={insertionModules} collectors={insertions}>{children ?? <ModelFields ui={ui} />}</InsertionProvider>
  </FormView></ModelUIContext.Provider>;
}

/**
 * Form wiring shared by every module model: loader, reload guard, routing, breadcrumbs,
 * activity and deletion. Custom views pass only their field layout as children.
 */
export default function ModelForm({ config, id, children }: { config: ModelClientConfig; id?: string; children?: ReactNode }) {
  const ui = useMemo(() => buildModelUI(config), [config]);
  const router = useRouter();
  const navigation = useFormNavigation();
  const alerts = useAlerts();
  const [attempt, setAttempt] = useState(0);
  const load = useCallback(() => modelRead(config.id, id!), [config.id, id]);
  // `default_<field>` proposes a Many2one value for a new record; the server validates it on save.
  const query = useSearchParams();
  const proposed = Object.fromEntries(Object.entries(config.fields).flatMap(([name, field]) => {
    const value = field.kind === "many2one" ? query.get(`default_${name}`) : null;
    return value && value.length <= 100 ? [[name, value]] : [];
  }));
  const reload = () => {
    void navigation.run(() => setAttempt(value => value + 1)).catch(() => {
      void alerts.error({ title: "No se pudo recargar el registro", message: "Intenta nuevamente. Tus cambios siguen en el formulario." });
    });
  };
  const capabilities = modelUiCapabilities(config.capabilities);
  if (!capabilities.read || (!id && !capabilities.create)) return <p role="alert" className="p-6">No tienes permiso para abrir este formulario.</p>;
  if (!id) return <Editor key={router.bfcacheId} ui={ui} record={{ ...ui.createDefaults(), ...proposed }}>{children}</Editor>;
  return <FormViewLoader key={`${router.bfcacheId}:${id}:${attempt}`} recordKey={id} load={load}>
    {(record, _audit, displayName) => <Editor ui={ui} record={record} displayName={displayName} onReload={reload}>{children}</Editor>}
  </FormViewLoader>;
}
