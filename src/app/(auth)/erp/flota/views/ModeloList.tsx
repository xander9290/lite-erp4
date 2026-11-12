import ListView from "@/components/ui/list/ListView";
import { listRecords, deleteRecords } from "../actions/modelo.actions";
import { recordCollectionFields as recordFields } from "../schemas/modelo.schema";

export default function ModeloList() {
  return <ListView model="FlotaModelo" title={"Modelos"} load={listRecords} fields={recordFields} searchFields={["name"]} breadcrumbs={[{ label: "Aplicaciones", href: "/erp" }, { label: "flota", href: "/erp/flota" }, { label: "Modelos" }]} onDelete={deleteRecords} createHref="/erp/flota/modelo/nuevo" createLabel="Nuevo" recordHref="/erp/flota/modelo/{id}" >
    <ListView.Field name="name" sortable />
    <ListView.Field name="active" sortable groupable />
    <ListView.Field name="fabricanteId" sortable groupable />
  </ListView>;
}
