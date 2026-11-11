import ListView from "@/components/ui/list/ListView";
import { listRecords, deleteRecords } from "../actions/fabricante.actions";
import { recordColumns, recordSearchFields } from "./fabricante.list";

export default function FabricanteList() {
  return <ListView model="FlotaFabricante" title={"Fabricante"} load={listRecords} columns={recordColumns} searchFields={recordSearchFields} breadcrumbs={[{ label: "Aplicaciones", href: "/erp" }, { label: "flota", href: "/erp/flota" }, { label: "Fabricante" }]} onDelete={deleteRecords} createHref="/erp/flota/fabricante/nuevo" createLabel="Nuevo" recordHref="/erp/flota/fabricante/{id}"  />;
}
