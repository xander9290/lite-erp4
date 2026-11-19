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
import { InsertionProvider, useInsertionAnchors, useInsertionFallbackEntries, useInsertionReport } from "@/components/ui/form/insertions/Insertions";
import type { InsertionSlot } from "@/components/ui/form/insertions/resolve";
import { placeCardColumns, placeListColumns, type CardZoneName, type ColumnEntry } from "@/lib/modules/collection-insertions";
import type { CardInsertions } from "@/components/ui/collection/types";
import { useModelExtensionInsertions } from "./ModelExtensionViews";
import { entryColumns } from "./Column";

const cardTargets = ["card:title", "card:body", "card:footer"] as const;
const noCollectors = Object.freeze({});

/**
 * Collection of a model with the insertions of its extensions for the current view
 * (`insertions.list|card|kanban`). A list without declared `columns` already derives every
 * published column (extensions included), so list insertions apply only to declared columns.
 */
export default function ModelCollection(props: ModelCollectionProps) {
  const view = props.view ?? props.config.view;
  const found = useModelExtensionInsertions(view, props.config.id);
  const collectors = view === "list" && !props.columns ? noCollectors : found;
  const extensions = props.config.extensions;
  const modules = useMemo(() => (extensions ?? []).map(extension => ({ module: extension.module, depends: extension.depends ?? [] })), [extensions]);
  return <InsertionProvider modules={modules} collectors={collectors}><CollectionBody {...props} view={view} /></InsertionProvider>;
}

/** Inserted columns/rows resolved against the declared presentation (server policy unchanged). */
function useCollectionInsertions(config: ModelClientConfig, view: CollectionView, columns: readonly ModelColumn[] | undefined, customCard: boolean) {
  const listKey = view === "list" && columns ? columns.map(column => column.field).join("|") : "";
  const targets = useMemo(() => view === "list" ? (listKey ? [...listKey.split("|").map(field => `column:${field}`), "columns:end"] : []) : customCard ? [] : [...cardTargets], [view, listKey, customCard]);
  const { slots } = useInsertionAnchors(targets);
  const fallback = useInsertionFallbackEntries();
  const placement = useMemo(() => {
    const issues: string[] = [];
    const parse = (entry: Parameters<typeof entryColumns>[0]): ColumnEntry => { const result = entryColumns(entry); issues.push(...result.issues); return result.entry; };
    const parsed = Object.fromEntries(Object.entries(slots).map(([target, slot]) => [target, { before: slot.before.map(parse), inside: slot.inside.map(parse), after: slot.after.map(parse), ...(slot.replace ? { replace: parse(slot.replace) } : {}) } satisfies InsertionSlot<readonly ModelColumn[]>]));
    const unplaced = fallback.map(parse);
    if (!Object.keys(parsed).length && !unplaced.length) return { columns, cards: undefined, issues };
    const policy = {
      published: config.list.fields,
      extensionFields: Object.fromEntries((config.extensions ?? []).map(extension => [extension.module, extension.fields])),
      modules: (config.extensions ?? []).map(extension => ({ module: extension.module, depends: extension.depends ?? [] })),
    };
    if (view === "list") {
      if (!columns) return { columns, cards: undefined, issues };
      const placed = placeListColumns(columns, parsed, unplaced, policy);
      return { columns: placed.columns, cards: undefined, issues: [...issues, ...placed.issues] };
    }
    const placed = placeCardColumns(parsed, unplaced, policy);
    return { columns, cards: placed.cards, issues: [...issues, ...placed.issues] };
  }, [slots, fallback, columns, view, config]);
  useInsertionReport("collection", placement.issues);
  return placement;
}

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
function CollectionBody({ config, columns: declared, view = config.view, title = config.label, create = true, open = true, delete: canDelete = true, movable = true, source: provider, renderCell, pageSize = 25, embedded = false, createDefaults, ...presentation }: ModelCollectionProps) {
  const pathname = usePathname();
  const params = useSearchParams().toString();
  const returnTo = `${pathname}${params ? `?${params}` : ""}`;
  const { columns, cards } = useCollectionInsertions(config, view, declared, Boolean(presentation.renderCard));
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
  // Card rows use the published column descriptors (label may be overridden by the insertion).
  const cardInsertions = useMemo<CardInsertions | undefined>(() => {
    if (!cards) return undefined;
    const published = new Map(source.queryColumns.map(column => [column.field, column]));
    const project = (list: readonly ModelColumn[]) => list.flatMap(column => { const base = published.get(column.field); return base ? [{ ...base, ...(column.label ? { label: column.label } : {}) }] : []; });
    return Object.fromEntries((Object.keys(cards) as CardZoneName[]).map(zone => [zone, { before: project(cards[zone].before), inside: project(cards[zone].inside), after: project(cards[zone].after) }]));
  }, [cards, source.queryColumns]);
  const capabilities = modelUiCapabilities(config.capabilities);
  if (!capabilities.read) return <p role="alert" className="p-6">No tienes permiso para consultar esta colección.</p>;
  const common = {
    ...source.common, ...presentation, title, pageSize, filterLookups: source.provider.filterLookups,
    columns: source.columns, queryColumns: source.queryColumns, cardInsertions,
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
