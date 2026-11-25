import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import ModelCollection from "@/components/modules/ModelCollection";
import ModelExtensionViews from "@/components/modules/ModelExtensionViews";
import CollectionViews from "@/components/modules/CollectionViews";
import { selectedCollectionView, type ModelClientConfig } from "@/lib/modules/config";
import { selectedScreen } from "@/lib/modules/screens";
import type { InsertionViewKind, ModuleModel } from "@/lib/modules/define";
import { getModuleModel, modelClientConfig } from "@/lib/modules/registry";
import { modelRead } from "@/lib/modules/actions";
import { getCurrentAccessUser } from "@/lib/access/current";
import { hasModuleGroup } from "@/lib/access/membership";
import { modelFormContent } from "./ModelFormSlots";

type SearchParams = Record<string, string | string[] | undefined>;

/** `[]` collection, `["nuevo"]` new record, `["<id>"]` record. Only registered models resolve. */
export function resolveModelPath(modelId: string, path: readonly string[]) {
  const found = getModuleModel(modelId);
  if (!found || path.length > 1) notFound();
  const id = !path.length || path[0] === "nuevo" ? undefined : decodeURIComponent(path[0]);
  if (id !== undefined && (!id.trim() || id.length > 100)) notFound();
  return { entry: found.entry, collection: !path.length, id };
}

/** Screen named by `?screen=`; unknown ids answer 404 instead of showing another screen's records. */
export function resolveModelScreen(entry: ModuleModel, query: SearchParams) {
  const screen = selectedScreen(entry, query.screen);
  if (!screen) notFound();
  return screen;
}

/** Shared metadata: reuses the authorized read, so a title never reveals a restricted record. */
export async function modelRouteMetadata(modelId: string, path: readonly string[], query: SearchParams = {}): Promise<Metadata> {
  const { entry, collection, id } = resolveModelPath(modelId, path);
  const screen = resolveModelScreen(entry, query);
  if (collection) return { title: entry.declaration.screens ? screen.label : entry.label };
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
  const query = await searchParams;
  const screen = resolveModelScreen(entry, query);
  const baseConfig = modelClientConfig(entry.id, actor);
  const named = Boolean(entry.declaration.screens);
  const screened: ModelClientConfig = {
    ...baseConfig,
    // Explicit screens name their collections and breadcrumbs; the implicit one keeps the menu label.
    ...(named ? { label: screen.label } : {}),
    screen: { id: screen.id, label: screen.label, isDefault: screen.id === entry.defaultScreen, defaults: screen.defaults },
  };
  const config = application ? { ...screened, label: application.label, application: { name: application.name, href: application.href } } : screened;
  if (collection) {
    const selected = selectedCollectionView(query.view, screen.collectionViews, screen.view);
    const loader = screen.views[selected];
    const Presentation = typeof loader === "function" ? (await loader()).default : ModelCollection;
    const viewConfig = { ...config, view: selected, collectionViews: screen.collectionViews };
    const collectionInsertions = await insertionSlots(entry.extensions, selected, viewConfig);
    return <CollectionViews views={screen.collectionViews} selected={selected}><ModelExtensionViews model={entry.id} insertions={{ [selected]: collectionInsertions }}><Presentation config={viewConfig} /></ModelExtensionViews></CollectionViews>;
  }
  // The page form and this model's own modal use the screen's layouts; related models keep theirs.
  return modelFormContent({ ...entry, views: screen.views }, config, id);
}
