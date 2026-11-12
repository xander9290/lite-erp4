import { listRecords } from "../actions/fabricante.actions";
import CardView from "@/components/ui/card/CardView";
import { recordColumns } from "./fabricante.list";

export default function FabricanteList() {
  return (
    <CardView
      model="FlotaFabricante"
      title={"Fabricantes"}
      load={listRecords}
      columns={recordColumns}
      searchFields={["name"]}
      breadcrumbs={[
        { label: "Aplicaciones", href: "/erp" },
        { label: "flota", href: "/erp/flota" },
        { label: "Fabricantes" },
      ]}
      createHref="/erp/flota/fabricante/nuevo"
      createLabel="Nuevo"
      recordHref="/erp/flota/fabricante/{id}"
    />
  );
}
