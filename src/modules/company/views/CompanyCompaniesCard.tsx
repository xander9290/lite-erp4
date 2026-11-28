"use client";

import ModelCollection from "@/components/modules/ModelCollection";
import type { ModelClientConfig } from "@/lib/modules/config";
import CollectionImage from "@/components/ui/collection/CollectionImage";
import ListCellValue from "@/components/ui/list/ListCellValue";

/**
 * Vista expulsada con eject:view: ordena, renombra o quita columnas.
 * Sólo se aceptan campos publicados por la política de lista del servidor.
 */
export default function CompanyCompaniesCard({ config }: { config: ModelClientConfig }) {
  return (
    <ModelCollection
      config={config}
      view="card"
      create={config.screen?.id !== "branches"}
      footer={config.screen?.id === "branches" ? <p className="text-xs">Crea las sucursales desde la pestaña Sucursales de su empresa matriz.</p> : undefined}
      columns={[{ field: "name" }, { field: "code" }, { field: "image" }, { field: "parentId" }, { field: "provinceId" }, { field: "countyId" }, { field: "active" }]}
      renderCard={(record) => (
        <div className="flex min-w-0 items-start gap-3 p-3">
          <CollectionImage value={record.image} label={String(record.name ?? "Empresa")} size="md" />
          <div className="min-w-0 flex-1 space-y-1 wrap-anywhere">
            <h3 className="font-semibold">{record.$displayName ?? String(record.name ?? "Empresa")}</h3>
            <p className="text-sm">Código: {String(record.code ?? "")}</p>
            {record.active === false && <span className="badge badge-soft badge-neutral badge-sm">Inactiva</span>}
            {record.parentId && (
              <p className="text-sm">
                Matriz: <ListCellValue record={record} column={{ field: "parentId", label: "Empresa matriz", widget: "many2one" }} />
              </p>
            )}
            <div className="text-sm text-base-content/70">
              <ListCellValue record={record} column={{ field: "provinceId", label: "Estado", widget: "many2one" }} />
              {record.provinceId && record.countyId ? " · " : null}
              <ListCellValue record={record} column={{ field: "countyId", label: "Municipio", widget: "many2one" }} />
            </div>
          </div>
        </div>
      )}
    />
  );
}
