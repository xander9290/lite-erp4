import ListView from "@/components/ui/list/ListView";
import { manifest } from "../manifest";
import { listRecords, listMyRecords, listActiveRecords, deleteRecords } from "../actions/record.actions";
import { recordFields } from "../schemas/record.schema";

const lists = {
  all: { title: manifest.name, description: manifest.description, load: listRecords },
  mine: { title: "Mis registros", description: "Registros creados por tu cuenta.", load: listMyRecords },
  active: { title: "Registros activos", description: "Registros que están activos.", load: listActiveRecords },
};

export default function RecordList({ view = "all" }: { view?: keyof typeof lists }) {
  const Icon = manifest.icon;
  const selected = lists[view];
  const breadcrumbs = view === "all"
    ? [{ label: "Aplicaciones", href: "/erp" }, { label: manifest.name }]
    : [{ label: "Aplicaciones", href: "/erp" }, { label: manifest.name, href: "/erp/flota" }, { label: selected.title }];
  return <ListView key={view} model="FlotaRecord" title={selected.title} description={selected.description} icon={<Icon size={22} />} load={selected.load}
    breadcrumbs={breadcrumbs} onDelete={deleteRecords}
    fields={recordFields} searchFields={["name"]} createHref="/erp/flota/nuevo" createLabel="Nuevo registro" recordHref="/erp/flota/{id}">
    <ListView.Field name="name" sortable />
    <ListView.Field name="active" sortable groupable />
  </ListView>;
}
