import ListView from "@/components/ui/list/ListView";
import CardView from "@/components/ui/card/CardView";
import { modelColumns, type PublishedFields } from "@/lib/orm/presentation";
import { modelDelete, modelList } from "@/lib/modules/actions";
import type { ModelClientConfig } from "@/lib/modules/config";
import type { ListColumn } from "@/lib/list/types";

export type ModelColumn = Omit<Partial<ListColumn>, "field"> & { field: string };
type Props = {
  config: ModelClientConfig;
  /** Presentation only: order, labels and widgets. Each field must be published by the server list policy. */
  columns?: readonly ModelColumn[];
  view?: "list" | "card";
  title?: string;
};

/** Default list/card for a module model. Server component: actions are bound to the model id here. */
export default function ModelCollection({ config, columns: custom, view = config.view, title = config.label }: Props) {
  const fields: PublishedFields = Object.fromEntries(Object.entries(config.fields).map(([name, metadata]) => [name, { metadata }]));
  const capability = (field: string) => ({ sortable: config.list.sortable.includes(field), groupable: config.list.groupable.includes(field), filterable: config.list.filterable.includes(field) });
  const declared: readonly ModelColumn[] = custom ?? config.list.fields.filter(name => Object.hasOwn(fields, name)).map(field => ({ field }));
  for (const column of declared) {
    if (!config.list.fields.includes(column.field) || !Object.hasOwn(fields, column.field)) throw new Error(`${config.id}: la columna ${column.field} no está publicada en la política de lista del servidor.`);
  }
  // Custom columns may restrict capabilities, never extend what the server policy allows.
  const columns = modelColumns(fields, declared.map(column => {
    const allowed = capability(column.field);
    return { ...column, sortable: allowed.sortable && column.sortable !== false, groupable: allowed.groupable && column.groupable !== false, filterable: allowed.filterable && column.filterable !== false };
  }));
  const breadcrumbs = [{ label: "Aplicaciones", href: "/erp" }, { label: config.moduleName, href: `/erp/${config.module}` }, { label: title }];
  const common = {
    model: config.name, title, columns, searchFields: config.list.searchFields, defaultSort: config.defaultSort, breadcrumbs,
    load: modelList.bind(null, config.id), createHref: `${config.route}/nuevo`, createLabel: "Nuevo", recordHref: `${config.route}/{id}`,
  };
  if (view === "card") return <CardView {...common} />;
  return <ListView {...common} onDelete={modelDelete.bind(null, config.id)} />;
}
