import ListView from "@/components/ui/list/ListView";
import { listRecords, deleteRecords } from "../actions/modelo.actions";
import { recordColumns, recordSearchFields } from "./modelo.list";

export default function ModeloList() {
  return <ListView model="FlotaModelo" title={"Modelo"} load={listRecords} columns={recordColumns} searchFields={recordSearchFields} breadcrumbs={[{ label: "Aplicaciones", href: "/erp" }, { label: "flota", href: "/erp/flota" }, { label: "Modelo" }]} onDelete={deleteRecords} createHref="/erp/flota/modelo/nuevo" createLabel="Nuevo" recordHref="/erp/flota/modelo/{id}"  />;
}
