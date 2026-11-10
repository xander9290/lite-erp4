import ListView from "@/components/ui/list/ListView";
import { loadGroupingSample } from "./list-grouping.actions";
import { groupingSampleColumns } from "./list-grouping.config";

export default function ListGroupingSample() {
  return <section id="list-grouping" className="min-w-0 scroll-mt-6 space-y-3">
    <h2 className="text-xl font-semibold">Agrupación anidada</h2>
    <p className="text-sm text-base-content/60">Datos ficticios consultados en el servidor; no persisten. Añade Activo → Asegurado → Disponible, abre grupos y prueba sus páginas y filtros.</p>
    <ListView model="grouping-demo" title="Vehículos ficticios" columns={groupingSampleColumns} load={loadGroupingSample} searchFields={[]} pageSize={10} paramPrefix="groupdemo" create={false} delete={false} />
  </section>;
}
