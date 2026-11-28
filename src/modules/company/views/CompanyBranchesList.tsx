import ModelCollection from "@/components/modules/ModelCollection";
import type { ModelClientConfig } from "@/lib/modules/config";

export default function CompanyBranchesList({ config }: { config: ModelClientConfig }) {
  return <ModelCollection config={config} view="list" create={false}
    footer={<p className="text-xs">Crea las sucursales desde la pestaña Sucursales de su empresa matriz.</p>} />;
}
