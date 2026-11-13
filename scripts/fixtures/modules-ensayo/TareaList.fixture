import ModelCollection from "@/components/modules/ModelCollection";
import type { ModelClientConfig } from "@/lib/modules/config";

/**
 * Vista expulsada con eject:view: ordena, renombra o quita columnas.
 * Sólo se aceptan campos publicados por la política de lista del servidor.
 */
export default function TareaList({ config }: { config: ModelClientConfig }) {
  return (
    <ModelCollection
      config={config}
      columns={[
        { field: "name" },
        { field: "estado" },
        { field: "categoria" },
        { field: "prioridad" },
        { field: "vence", label: "Fecha límite", filterable: false },
      ]}
    />
  );
}
