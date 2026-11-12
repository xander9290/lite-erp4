import ListView from "@/components/ui/list/ListView";
import { listRecords, deleteRecords } from "../actions/vehicle.actions";
import { recordCollectionFields as recordFields } from "../schemas/vehicle.schema";

export default function VehicleList() {
  return <ListView model="FlotaVehicle" title={"Vehículos"} load={listRecords} fields={recordFields} searchFields={[]} breadcrumbs={[{ label: "Aplicaciones", href: "/erp" }, { label: "flota", href: "/erp/flota" }, { label: "Vehículos" }]} onDelete={deleteRecords} createHref="/erp/flota/vehicle/nuevo" createLabel="Nuevo" recordHref="/erp/flota/vehicle/{id}" >
    <ListView.Field name="name" sortable groupable />
    <ListView.Field name="active" sortable groupable />
      <ListView.Field name="plate" sortable />
  </ListView>;
}
