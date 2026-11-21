import type { Many2OneLoader } from "../many2one/model-lookup";
import { collectionFieldMetadata, type ModelClientConfig } from "./config";
import { modelColumns } from "../orm/presentation";
import { auditCollectionColumns } from "../orm/audit";
import type { ListColumn } from "../list/types";
import type { ListResult, ListState } from "../list/types";
import type { KanbanLoader, KanbanMover } from "../kanban/types";
import type { ListDeleteResult, ListDeleteTarget } from "../list/selection";

export type ModelColumn = Omit<Partial<ListColumn>, "field"> & { field: string };
/** Alternate providers retain the same paging contracts; applications authorize their server implementations. */
export type CollectionSource = {
  filterLookups?: Readonly<Record<string, Many2OneLoader>>;
  load: (state: ListState) => Promise<ListResult>;
  loadKanban?: KanbanLoader;
  move?: KanbanMover;
  remove?: (selection: readonly ListDeleteTarget[]) => Promise<ListDeleteResult>;
};

/** One published source contract; presentations never choose delegates, domains or arbitrary fields. */
export function modelCollection(config: ModelClientConfig, declared?: readonly ModelColumn[]) {
  const metadata = collectionFieldMetadata(config);
  const fields = Object.fromEntries(Object.entries(metadata).map(([name, metadata]) => [name, { metadata }]));
  // Audit columns have fixed descriptors (readable creator and dates), never a User field chosen here.
  const audit: Readonly<Record<string, ListColumn>> = config.audit ? Object.fromEntries(auditCollectionColumns.map(column => [column.field, column])) : {};
  // Many2many (tags): IDs and labels come from the server; filter by membership, never sort/group.
  const many = config.many2many ?? {};
  const tagColumn = (column: ModelColumn): ListColumn => ({ ...column, field: column.field, label: column.label ?? many[column.field].label ?? column.field, widget: "tags", type: "text", sortable: false, groupable: false, filterable: column.filterable !== false });
  const project = (columns: readonly ModelColumn[]) => columns.filter(column => !config.fieldAccess?.[column.field]?.noRead && !config.fieldAccess?.[column.field]?.invisible).map(column => {
    if (Object.hasOwn(many, column.field)) return tagColumn(column);
    const isAudit = Object.hasOwn(audit, column.field);
    if (!config.list.fields.includes(column.field) || (!Object.hasOwn(fields, column.field) && !isAudit)) throw new Error(`${config.id}: la columna ${column.field} no está publicada en la política de lista del servidor.`);
    const capabilities = {
      sortable: config.list.sortable.includes(column.field) && column.sortable !== false,
      filterable: config.list.filterable.includes(column.field) && column.filterable !== false,
      groupable: config.list.groupable.includes(column.field) && column.groupable !== false,
    };
    if (!isAudit) return modelColumns(fields, [{ ...column, ...capabilities }])[0];
    const fixed = audit[column.field];
    if ((column.widget !== undefined && column.widget !== fixed.widget) || (column.avatarField !== undefined && column.avatarField !== fixed.avatarField) || (column.type !== undefined && column.type !== fixed.type)) throw new Error(`${config.id}: la columna de auditoría ${column.field} sólo admite cambiar label, ancho y orden.`);
    return { ...fixed, ...column, widget: fixed.widget, avatarField: fixed.avatarField, type: fixed.type, ...capabilities } as ListColumn;
  });
  const scalarColumns = project(config.list.fields.map(field => ({ field })));
  // Without declared columns, Many2many columns follow the published ones (12 columns at most).
  const publishedColumns = [...scalarColumns, ...project(Object.keys(many).map(field => ({ field }))).slice(0, Math.max(0, 12 - scalarColumns.length))];
  const columns = declared ? project(declared) : publishedColumns;
  // Keep query support for omitted fields, while honoring explicit presentation restrictions.
  const overrides = new Map(columns.map(column => [column.field, column]));
  const queryColumns = [...publishedColumns.map(column => overrides.get(column.field) ?? column), ...columns.filter(column => !publishedColumns.some(published => published.field === column.field))];
  const kanbanField = config.kanban ? metadata[config.kanban] : undefined;
  if (config.kanban && (kanbanField?.kind !== "selection" || !config.list.fields.includes(config.kanban))) throw new Error(`${config.id}: el tablero necesita un Selection publicado.`);
  return {
    columns,
    queryColumns,
    common: {
      model: config.name, searchFields: config.list.searchFields.filter(field => !config.fieldAccess?.[field]?.noRead), defaultSort: config.defaultSort && !config.fieldAccess?.[config.defaultSort.field]?.noRead ? config.defaultSort : undefined,
      createHref: `${config.route}/nuevo`, createLabel: "Nuevo", recordHref: `${config.route}/{id}`,
    },
    kanban: kanbanField?.kind === "selection" ? { groupField: config.kanban!, groups: kanbanField.choices, transitions: config.kanbanTransitions } : undefined,
  };
}
