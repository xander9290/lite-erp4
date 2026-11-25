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
import type { FormDensity } from "@/components/ui/form/formDensity";
import { useFormNavigation } from "@/components/ui/form/FormNavigationProvider";
import { useAlerts } from "@/components/ui/alerts/AlertProvider";
import { buildModelUI, type ModelUI } from "@/lib/modules/client";
import { screenHref, type ModelClientConfig } from "@/lib/modules/config";
import type { FieldMetadata } from "@/lib/orm/fields";
import ModelCollection from "./ModelCollection";
import FieldVisibility from "@/components/ui/form/FieldVisibility";
import type { ListState } from "@/lib/list/types";
import { modelChildren, modelRelationLookup, modelAction, modelActivity, modelDelete, modelNote, modelRead, modelSave } from "@/lib/modules/actions";
import { modelUiCapabilities } from "@/lib/access/capabilities";
import { useModelExtensionInsertions, useModelExtensionViews, useModelFormViewKind } from "./ModelExtensionViews";
import { InsertionProvider, useInsertionFallback } from "@/components/ui/form/insertions/Insertions";
import { FormDialogLock } from "@/components/ui/form/FormDialog";
import ModelFormModal from "./ModelFormModal";
import { useModelFormPresentation } from "./ModelFormPresentation";
import { useRecordPager } from "@/components/ui/collection/recordPager";

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
const ChildCollectionRefreshContext = createContext<{ version: number; refresh: () => void } | null>(null);

/** Refresh the current form's readonly collections after a separate, confirmed child save. */
export function useModelChildCollectionsRefresh() {
  const context = useContext(ChildCollectionRefreshContext);
  if (!context) throw new Error("useModelChildCollectionsRefresh se usa dentro de ModelForm.");
  return context.refresh;
}

/**
 * Read-only relations of the record (children created in their own form): one paginated,
 * authorized collection per relation, filtered by the server to this record. Ejected forms
 * place `<ModelChildCollections />` (or `name` for one relation) where they should appear.
 */
export function ModelChildCollections({ name, openIn = "page" }: { name?: string; openIn?: "page" | "modal" }) {
  const ui = useContext(ModelUIContext);
  const recordId = useWatch({ name: "id" }) as string | undefined;
  const collections = Object.entries(ui?.config.collections ?? {}).filter(([field]) => !name || field === name);
  if (!ui || !collections.length) return null;
  return <>{collections.map(([field, collection]) => <FieldVisibility key={field} name={field} invisible={collection.invisible}><FormGroup fullWidth legend={collection.label}>
    {recordId ? <ChildCollection parent={ui.config.id} field={field} recordId={recordId} collection={collection} openIn={openIn} />
      : <p className="text-sm text-base-content/60">Guarda el registro para ver {collection.label.toLowerCase()}.</p>}
  </FormGroup></FieldVisibility>)}</>;
}

function ChildCollection({ parent, field, recordId, collection, openIn }: {
  parent: string; field: string; recordId: string;
  collection: NonNullable<ModelClientConfig["collections"]>[string]; openIn: "page" | "modal";
}) {
  const [editing, setEditing] = useState<{ id?: string } | null>(null);
  const [version, setVersion] = useState(0);
  const externalVersion = useContext(ChildCollectionRefreshContext)?.version ?? 0;
  const source = useMemo(() => ({
    load: (state: ListState) => modelChildren(parent, field, recordId, state),
    filterLookups: Object.fromEntries(Object.keys(collection.config.lookups).map(lookup => [lookup, (request: import("@/lib/many2one/model-lookup").ModelLookupRequest) => modelRelationLookup(collection.config.id, lookup, { request, draft: {}, filter: true })])),
    // Replacing this provider after a confirmed save reloads the current query/page.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [parent, field, recordId, collection, version, externalVersion]);
  const defaults = { [collection.inverse]: recordId };
  const inverse = collection.config.fields[collection.inverse];
  return <><ModelCollection embedded config={collection.config} view="list" title={collection.label} paramPrefix={field}
    createDefaults={defaults} create={inverse?.kind === "many2one" && !inverse.readOnly} source={source} delete={false}
    onCreate={openIn === "modal" ? () => setEditing({}) : undefined}
    onOpen={openIn === "modal" ? record => setEditing({ id: record.id }) : undefined} />
    {editing && <ModelFormModal config={collection.config} id={editing.id} defaults={defaults}
      onClose={() => setEditing(null)} onSaved={() => setVersion(value => value + 1)} />}
  </>;
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
  const views = useModelExtensionViews(ui?.config.id);
  const kind = useModelFormViewKind(ui?.config.id);
  const insertions = useModelExtensionInsertions(kind, ui?.config.id ?? "");
  if (!ui?.config.extensions?.length) return null;
  return <>{ui.config.extensions.map(extension => {
    if (Object.hasOwn(insertions, extension.module)) return <InsertionFallback key={extension.module} module={extension.module} label={extension.label} />;
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

function Editor({ ui, record, displayName, onReload, children, density }: { ui: ModelUI; record: Values; displayName?: string; onReload?: () => void; children?: ReactNode; density?: FormDensity }) {
  const router = useRouter();
  const params = useSearchParams();
  const { config } = ui;
  const modal = useModelFormPresentation(config.id);
  const capabilities = modelUiCapabilities(config.capabilities);
  // The selected screen survives create → save → back: list fallback and form links keep `screen`.
  const listHref = screenHref(config, config.route);
  const returnHref = formDeleteReturnHref(params.get("returnTo"), listHref);
  const formHref = (path: string) => screenHref(config, path, { returnTo: returnHref });
  const [savedId, setSavedId] = useState(record.id as string | undefined);
  const [savedName, setSavedName] = useState(displayName);
  // Previous/next within the list page the form came from (page forms only; never modals).
  const pager = useRecordPager(modal ? null : returnHref, savedId);
  const openSibling = (id: string) => () => router.push(formHref(`${config.route}/${encodeURIComponent(id)}`));
  const [collectionVersion, setCollectionVersion] = useState(0);
  const refreshCollections = useCallback(() => setCollectionVersion(value => value + 1), []);
  const collectionRefresh = useMemo(() => ({ version: collectionVersion, refresh: refreshCollections }), [collectionVersion, refreshCollections]);
  const methods = useForm<Values>({ resolver: zodResolver(ui.schema as never), defaultValues: record });
  const kind = useModelFormViewKind(config.id);
  const insertions = useModelExtensionInsertions(kind, config.id);
  const insertionModules = useMemo(() => (config.extensions ?? []).map(extension => ({ module: extension.module, depends: extension.depends ?? [] })), [config.extensions]);
  return <ModelUIContext.Provider value={ui}><ChildCollectionRefreshContext.Provider value={collectionRefresh}><FormView
    density={density}
    layout={modal ? "content" : "page"}
    breadcrumbs={modal ? [] : [{ label: "Aplicaciones", href: "/erp" }, { label: config.label, href: returnHref }, { label: savedId ? savedName || "Registro" : "Nuevo registro" }]}
    title={savedId ? "Editar registro" : "Nuevo registro"}
    methods={methods}
    model={ui.recordUI as never}
    activity={{ recordId: savedId, load: request => modelActivity(config.id, request), addNote: request => modelNote(config.id, request) }}
    mode={savedId ? "edit" : "create"}
    readOnly={savedId ? !capabilities.write : !capabilities.create}
    onSubmit={values => modelSave(config.id, values)}
    deletion={!modal && capabilities.unlink ? { action: selection => modelDelete(config.id, selection), returnHref: listHref, allowReadOnly: true } : undefined}
    // FormButton: published @action names only; the server validates them and re-authorizes.
    runAction={(action, target, params) => modelAction(config.id, { action, ...target, ...(params !== undefined ? { params } : {}) })}
    actions={config.actions}
    actionModel={config.name}
    pager={pager ? { position: pager.position, total: pager.total, ...(pager.previous ? { onPrevious: openSibling(pager.previous) } : {}), ...(pager.next ? { onNext: openSibling(pager.next) } : {}) } : undefined}
    onNew={!modal && savedId && capabilities.create ? () => router.push(formHref(`${config.route}/nuevo`)) : undefined}
    onSaved={(values, _audit, name) => {
      setSavedId(values.id as string);
      setSavedName(name);
      if (modal) { modal.onSaved(values); return; }
      if (!record.id && values.id) router.replace(formHref(`${config.route}/${encodeURIComponent(values.id as string)}`));
      router.refresh();
    }}
    menuActions={onReload ? [{ id: "reload", label: "Recargar registro", icon: <RefreshCw size={16} />, onSelect: onReload }] : undefined}
    footer={<p className="text-xs text-base-content/55">Los cambios se guardan al presionar Guardar.</p>}
  >
    <FormDialogLock />
    <InsertionProvider modules={insertionModules} collectors={insertions}>{children ?? <ModelFields ui={ui} />}</InsertionProvider>
  </FormView></ChildCollectionRefreshContext.Provider></ModelUIContext.Provider>;
}

/**
 * Form wiring shared by every module model: loader, reload guard, routing, breadcrumbs,
 * activity and deletion. Custom views pass only their field layout as children.
 */
export default function ModelForm({ config: providedConfig, id: routeId, children, density }: { config: ModelClientConfig; id?: string; children?: ReactNode; density?: FormDensity }) {
  const modal = useModelFormPresentation(providedConfig.id);
  const config = modal?.config ?? providedConfig;
  const id = modal ? modal.id : routeId;
  const ui = useMemo(() => buildModelUI(config), [config]);
  const router = useRouter();
  const navigation = useFormNavigation();
  const alerts = useAlerts();
  const [attempt, setAttempt] = useState(0);
  const load = useCallback(() => modelRead(config.id, id!), [config.id, id]);
  // `default_<field>` proposes a Many2one value for a new record; the server validates it on save.
  const query = useSearchParams();
  const proposed = modal ? Object.fromEntries(Object.entries(modal.defaults ?? {}).filter(([name]) => Object.hasOwn(config.fields, name) && !config.fields[name].readOnly && !config.fields[name].sequence && !config.fields[name].sensitive)) : Object.fromEntries(Object.entries(config.fields).flatMap(([name, field]) => {
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
  // Precedence on create: field defaults < screen defaults (page only) < explicit proposals
  // (`default_<field>` or a relation's inverse in a modal). The server validates every value on save.
  const screenDefaults = modal ? {} : Object.fromEntries(Object.entries(config.screen?.defaults ?? {}).filter(([name]) => Object.hasOwn(config.fields, name) && !config.fieldAccess?.[name]?.noWrite && !config.fieldAccess?.[name]?.noRead));
  if (!id) return <Editor key={router.bfcacheId} ui={ui} density={density} record={{ ...ui.createDefaults(), ...screenDefaults, ...proposed }}>{children}</Editor>;
  return <FormViewLoader key={`${router.bfcacheId}:${id}:${attempt}`} recordKey={id} load={load}>
    {(record, _audit, displayName) => <Editor ui={ui} density={density} record={record} displayName={displayName} onReload={reload}>{children}</Editor>}
  </FormViewLoader>;
}
