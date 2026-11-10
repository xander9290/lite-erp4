import ListView from "@/components/ui/list/ListView";
import { manifest } from "../manifest";
import { deleteRecords, listRecords } from "../actions/record.actions";
import { listMyVehicles, listMyActiveVehicles } from "../actions/my-vehicles.actions";
import { recordColumns, recordSearchFields } from "./record.list";

const views = {
  all: {
    title: manifest.name,
    description: manifest.description,
    load: listRecords,
  },
  mine: {
    title: "Mis vehículos",
    description: "Vehículos creados por tu cuenta.",
    load: listMyVehicles,
  },
  "mine-active": {
    title: "Mis vehículos activos",
    description: "Vehículos activos creados por tu cuenta.",
    load: listMyActiveVehicles,
  },
};

export default function RecordList({ view = "all" }: { view?: keyof typeof views }) {
  const Icon = manifest.icon;
  const selected = views[view];

  const breadcrumbs =
    view === "all"
      ? [{ label: "Aplicaciones", href: "/erp" }, { label: manifest.name }]
      : [{ label: "Aplicaciones", href: "/erp" }, { label: manifest.name, href: "/erp/flota" }, { label: selected.title }];

  return (
    <ListView
      key={view}
      model="FlotaRecord"
      title={selected.title}
      description={selected.description}
      icon={<Icon size={22} />}
      load={selected.load}
      breadcrumbs={breadcrumbs}
      onDelete={deleteRecords}
      columns={recordColumns}
      searchFields={recordSearchFields}
      createHref="/erp/flota/nuevo"
      createLabel="Nuevo registro"
      recordHref="/erp/flota/{id}"
    />
  );
}
