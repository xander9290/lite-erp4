"use client";

import { useMemo } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import ListView, { type ListViewProps } from "@/components/ui/list/ListView";
import CardView from "@/components/ui/card/CardView";
import KanbanView from "@/components/ui/kanban/KanbanView";
import type { CollectionProps } from "@/components/ui/collection/types";
import { modelCreators, modelLookup, modelDelete, modelKanban, modelList, modelMove } from "@/lib/modules/actions";
import type { CollectionView, ModelClientConfig } from "@/lib/modules/config";
import { modelCollection, type CollectionSource, type ModelColumn } from "@/lib/modules/collection";
import { modelUiCapabilities } from "@/lib/access/capabilities";

export type { ModelColumn } from "@/lib/modules/collection";
export type ModelCollectionProps = Pick<CollectionProps, "renderCard" | "titleField" | "subtitleField" | "headerActions" | "footer" | "className" | "pageSize" | "paramPrefix"> & {
  config: ModelClientConfig;
  columns?: readonly ModelColumn[];
  view?: CollectionView;
  title?: string;
  create?: boolean;
  open?: boolean;
  delete?: boolean;
  movable?: boolean;
  source?: CollectionSource;
  renderCell?: ListViewProps["renderCell"];
  /** Inside another form (read-only relation): no breadcrumbs. */
  embedded?: boolean;
  /** Values proposed to a new record (`default_<field>` in the URL; the server validates them). */
  createDefaults?: Readonly<Record<string, string>>;
};

/** Presentation only: shared publication, navigation and authorized data providers. */
export default function ModelCollection({ config, columns, view = config.view, title = config.label, create = true, open = true, delete: canDelete = true, movable = true, source: provider, renderCell, pageSize = 25, embedded = false, createDefaults, ...presentation }: ModelCollectionProps) {
  const pathname = usePathname();
  const params = useSearchParams().toString();
  const returnTo = `${pathname}${params ? `?${params}` : ""}`;
  const source = useMemo(() => ({
    ...modelCollection(config, columns),
    provider: provider ?? {
      filterLookups: {
        ...Object.fromEntries(Object.entries(config.lookups).map(([field, target]) => [field, modelLookup.bind(null, target)])),
        // «Creado por»: creators of readable records of this model, by contact name.
        ...(config.audit && config.list.fields.includes("createBy") ? { createBy: modelCreators.bind(null, config.id) } : {}),
      },
      load: modelList.bind(null, config.id), loadKanban: modelKanban.bind(null, config.id),
      move: modelMove.bind(null, config.id), remove: modelDelete.bind(null, config.id),
    },
  }), [config, columns, provider]);
  const capabilities = modelUiCapabilities(config.capabilities);
  if (!capabilities.read) return <p role="alert" className="p-6">No tienes permiso para consultar esta colección.</p>;
  const common = {
    ...source.common, ...presentation, title, pageSize, filterLookups: source.provider.filterLookups,
    columns: source.columns, queryColumns: source.queryColumns,
    createHref: create && capabilities.create ? `${source.common.createHref}?${new URLSearchParams({ ...Object.fromEntries(Object.entries(createDefaults ?? {}).map(([field, value]) => [`default_${field}`, value])), returnTo })}` : undefined,
    recordHref: open ? source.common.recordHref : undefined,
    breadcrumbs: embedded ? [] : [{ label: "Aplicaciones", href: "/erp" }, ...(config.application?.href === config.route
      ? [{ label: config.application.name }]
      : [{ label: config.application?.name ?? config.moduleName, href: config.application?.href ?? `/erp/${config.module}` }, { label: title }])],
  };
  if (view === "kanban") {
    if (!source.kanban || !source.provider.loadKanban) throw new Error(`${config.id}: configura kanban y su proveedor antes de mostrar el tablero.`);
    return <KanbanView {...common} {...source.kanban} load={source.provider.loadKanban} onMove={movable && capabilities.move ? source.provider.move : undefined} />;
  }
  if (view === "card") return <CardView {...common} load={source.provider.load} />;
  return <ListView {...common} load={source.provider.load} delete={canDelete && capabilities.unlink} onDelete={source.provider.remove} renderCell={renderCell} />;
}
