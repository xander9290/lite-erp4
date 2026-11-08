import ListView from "@/components/ui/list/ListView";
import { manifest } from "../manifest";
import { listRecords } from "../actions/record.actions";
import { recordColumns, recordSearchFields } from "./record.list";

export default function RecordList() {
  const Icon = manifest.icon;
  return <ListView model="FlotaRecord" title={manifest.name} description={manifest.description} icon={<Icon size={22} />} load={listRecords}
    breadcrumbs={[{ label: "Aplicaciones", href: "/erp" }, { label: manifest.name }]}
    columns={recordColumns} searchFields={recordSearchFields} createHref="/erp/flota/nuevo" createLabel="Nuevo registro" recordHref="/erp/flota/{id}" />;
}
