import ModelCollection from "@/components/modules/ModelCollection";
import type { ModelClientConfig } from "@/lib/modules/config";

/**
 * Vista expulsada con eject:view: ordena, renombra o quita columnas.
 * Sólo se aceptan campos publicados por la política de lista del servidor.
 */
export default function VehicleList({ config }: { config: ModelClientConfig }) {
  return <ModelCollection config={config} columns={[{ field: "fabricanteLogo", widget: "image" }, { field: "name" }, { field: "plate" }, { field: "modeloId" }, { field: "active" }]} />;
}
