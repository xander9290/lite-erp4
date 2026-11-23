import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import ModelCollection from "@/components/modules/ModelCollection";
import ModelForm from "@/components/modules/ModelForm";
import ModelExtensionViews from "@/components/modules/ModelExtensionViews";
import CollectionViews from "@/components/modules/CollectionViews";
import { selectedCollectionView, type ModelClientConfig } from "@/lib/modules/config";
import type { InsertionViewKind, ModuleModel } from "@/lib/modules/define";
import { getModuleModel, modelClientConfig } from "@/lib/modules/registry";
import { modelRead } from "@/lib/modules/actions";
import { getCurrentAccessUser } from "@/lib/access/current";
import { hasModuleGroup } from "@/lib/access/membership";
import { ModelFormTemplates } from "./ModelFormPresentation";
import { formExtensionContent, resolveFormView, type FormViewKind } from "@/lib/modules/form-view";

type SearchParams = Record<string, string | string[] | undefined>;

/** `[]` collection, `["nuevo"]` new record, `["<id>"]` record. Only registered models resolve. */
export function resolveModelPath(modelId: string, path: readonly string[]) {
  const found = getModuleModel(modelId);
  if (!found || path.length > 1) notFound();
  const id = !path.length || path[0] === "nuevo" ? undefined : decodeURIComponent(path[0]);
  if (id !== undefined && (!id.trim() || id.length > 100)) notFound();
  return { entry: found.entry, collection: !path.length, id };
}

/** Shared metadata: reuses the authorized read, so a title never reveals a restricted record. */
export async function modelRouteMetadata(modelId: string, path: readonly string[]): Promise<Metadata> {
  const { entry, collection, id } = resolveModelPath(modelId, path);
  if (collection) return { title: entry.label };
  if (!id) return { title: "Nuevo registro" };
  const record = await modelRead(entry.id, id);
  return { title: record.ok && record.displayName ? record.displayName : "Registro" };
}

/** Insertion files of the extensions for one view, resolved on the server as React slots. */
async function insertionSlots(extensions: ModuleModel["extensions"], kind: InsertionViewKind, config: ModelClientConfig) {
  return Object.fromEntries(await Promise.all(extensions.flatMap(extension => {
    const load = extension.insertions?.[kind];
    return load ? [{ extension, load }] : [];
  }).map(async ({ extension, load }) => {
    const View = (await load()).default;
    return [extension.module, <View key={extension.module} config={config} />] as const;
  })));
}

/** Independent layouts; both retain the same authorized form runtime. */
async function formSlot(entry: ModuleModel, config: ModelClientConfig, id?: string, presentation: FormViewKind = "form") {
  const selected = resolveFormView(entry, presentation);
  const Form = selected.load ? (await selected.load()).default : ModelForm;
  const content = formExtensionContent(entry.extensions, presentation, selected.kind);
  const extensionViews = Object.fromEntries(await Promise.all(content.filter(extension => extension.form).map(async extension => {
    const View = (await extension.form!()).default;
    return [extension.module, <View key={extension.module} config={config} />];
  })));
  const insertionViews = Object.fromEntries(await Promise.all(content.filter(extension => extension.insertions).map(async extension => {
    const View = (await extension.insertions!()).default;
    return [extension.module, <View key={extension.module} config={config} />];
  })));
  return <ModelExtensionViews model={entry.id} formKind={presentation} views={extensionViews} insertions={{ [presentation]: insertionViews }}><Form config={config} id={id} /></ModelExtensionViews>;
}

/**
 * Collection or form of one module model, with the actor's capabilities. Used by the
 * `/erp/<module>/<model>` convention and by applications that present native models
 * (Ajustes → Usuarios over core.user).
 */
export default async function ModelRoute({ modelId, path, searchParams, application }: { modelId: string; path: readonly string[]; searchParams: Promise<SearchParams>; application?: { name: string; href: `/erp/${string}`; label: string } }) {
  const { entry, collection, id } = resolveModelPath(modelId, path);
  const actor = await getCurrentAccessUser();
  if (!actor) redirect("/auth");
  const permissions = actor.modelAccess[entry.id];
  if ((!actor.isAdmin && !hasModuleGroup(entry.id.split(".")[0], actor.directGroups)) || !permissions?.read || (!collection && !id && !permissions.create)) return <p role="alert" className="p-6">No tienes permiso para abrir esta vista.</p>;
  const baseConfig = modelClientConfig(entry.id, actor);
  const config = application ? { ...baseConfig, label: application.label, application: { name: application.name, href: application.href } } : baseConfig;
  const { views } = entry;
  if (collection) {
    const query = await searchParams;
    const selected = selectedCollectionView(query.view, entry.collectionViews, entry.view);
    const loader = views[selected];
    const Presentation = typeof loader === "function" ? (await loader()).default : ModelCollection;
    const viewConfig = { ...config, view: selected };
    const collectionInsertions = await insertionSlots(entry.extensions, selected, viewConfig);
    return <CollectionViews views={entry.collectionViews} selected={selected}><ModelExtensionViews model={entry.id} insertions={{ [selected]: collectionInsertions }}><Presentation config={viewConfig} /></ModelExtensionViews></CollectionViews>;
  }
  // Only this form and its published child collections, not an import of the registry on
  // the client. Child configs already stop at one level; a self relation reuses this view.
  const configs = new Map(Object.values(config.collections ?? {}).map(child => [child.config.id, child.config]));
  if (configs.has(config.id)) configs.set(config.id, config);
  const templates = Object.fromEntries(await Promise.all([...configs].filter(([, candidate]) => candidate.capabilities?.read).map(async ([model, candidate]) => {
    const target = getModuleModel(model)!;
    return [model, await formSlot(target.entry, candidate, undefined, "modal")];
  })));
  return <ModelFormTemplates value={templates}><div key={id ?? "nuevo"} className="flex min-h-0 min-w-0 flex-1 flex-col">{await formSlot(entry, config, id)}</div></ModelFormTemplates>;
}
