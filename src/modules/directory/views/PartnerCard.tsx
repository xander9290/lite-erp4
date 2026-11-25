"use client";
import ModelCollection from "@/components/modules/ModelCollection";
import type { ModelClientConfig } from "@/lib/modules/config";
import CollectionImage from "@/components/ui/collection/CollectionImage";
import ListCellValue from "@/components/ui/list/ListCellValue";

/**
 * Vista expulsada con eject:view: ordena, renombra o quita columnas.
 * Sólo se aceptan campos publicados por la política de lista del servidor.
 */
export default function PartnerList({ config }: { config: ModelClientConfig }) {
  return (
    <ModelCollection
      config={config}
      view="card"
      columns={[
        { field: "image", widget: "image" },
        { field: "name" },
        { field: "phones" },
        { field: "street" },
        { field: "streetNumber" },
        { field: "vat" },
        { field: "provinceId" },
        { field: "tagIds" },
        { field: "activityIds" },
      ]}
      renderCard={(record) => (
        <div className="flex items-start gap-4 p-3">
          <CollectionImage
            value={record.image}
            label={String(record.name ?? "Contacto")}
            size="lg"
          />

          <div className="min-w-0 flex-1 space-y-1 wrap-anywhere">
            <h3 className="font-semibold">
              {record.$displayName ?? String(record.name ?? "")}
            </h3>

            <p className="text-sm">{String(record.phones ?? "")}</p>

            <p className="text-sm">
              <ListCellValue
                record={record}
                column={{
                  field: "provinceId",
                  label: "Estado",
                  widget: "many2one",
                }}
              />
              {", "}
              <ListCellValue
                record={record}
                column={{
                  field: "countyId",
                  label: "Municipio",
                  widget: "many2one",
                }}
              />
            </p>
            <p>
              <ListCellValue
                record={record}
                column={{ field: "tagIds", label: "Etiquetas", widget: "tags" }}
              />
            </p>
          </div>
        </div>
      )}
    />
  );
}
