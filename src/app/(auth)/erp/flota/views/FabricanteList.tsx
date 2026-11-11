import { listRecords } from "../actions/fabricante.actions";
import { recordColumns, recordSearchFields } from "./fabricante.list";
import CardView from "@/components/ui/card/CardView";

export default function FabricanteList() {
  return (
    <CardView
      model="FlotaFabricante"
      title={"Fabricante"}
      breadcrumbs={[{ label: "Aplicaciones", href: "/erp" }, { label: "Flota", href: "/erp/flota" }, { label: "Fabricante" }]}
      titleField="name"
      load={listRecords}
      columns={recordColumns}
      searchFields={recordSearchFields}
      createHref="/erp/flota/fabricante/nuevo"
      createLabel="Nuevo"
      recordHref="/erp/flota/fabricante/{id}"
    />
  );
}
