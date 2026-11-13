import ListView from "@/components/ui/list/ListView";
import CardView from "@/components/ui/card/CardView";
import { modelColumns, type PublishedFields } from "@/lib/orm/presentation";
import { modelDelete, modelList } from "@/lib/modules/actions";
import type { ModelClientConfig } from "@/lib/modules/config";

/** Default list/card for a module model. Server component: actions are bound to the model id here. */
export default function ModelCollection({ config }: { config: ModelClientConfig }) {
  const fields: PublishedFields = Object.fromEntries(Object.entries(config.fields).map(([name, metadata]) => [name, { metadata }]));
  const columns = modelColumns(fields, config.list.fields.filter(name => Object.hasOwn(fields, name)).map(field => ({
    field, sortable: config.list.sortable.includes(field), groupable: config.list.groupable.includes(field), filterable: config.list.filterable.includes(field),
  })));
  const breadcrumbs = [{ label: "Aplicaciones", href: "/erp" }, { label: config.moduleName, href: `/erp/${config.module}` }, { label: config.label }];
  const common = {
    model: config.name, title: config.label, columns, searchFields: config.list.searchFields, defaultSort: config.defaultSort, breadcrumbs,
    load: modelList.bind(null, config.id), createHref: `${config.route}/nuevo`, createLabel: "Nuevo", recordHref: `${config.route}/{id}`,
  };
  if (config.view === "card") return <CardView {...common} />;
  return <ListView {...common} onDelete={modelDelete.bind(null, config.id)} />;
}
