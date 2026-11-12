import ListView from "@/components/ui/list/ListView";
import { listRecords, deleteRecords } from "../actions/vehicle.actions";
import { recordFields } from "../schemas/vehicle.schema";

export default function VehicleList() {
  return <ListView model="FlotaVehicle" title={"Vehicle"} load={listRecords} fields={recordFields} searchFields={["plate"]} breadcrumbs={[{ label: "Aplicaciones", href: "/erp" }, { label: "flota", href: "/erp/flota" }, { label: "Vehicle" }]} onDelete={deleteRecords} createHref="/erp/flota/vehicle/nuevo" createLabel="Nuevo" recordHref="/erp/flota/vehicle/{id}" >
    <ListView.Field name="name" sortable />
    <ListView.Field name="plate" sortable />
    <ListView.Field name="active" sortable groupable />
  </ListView>;
}
