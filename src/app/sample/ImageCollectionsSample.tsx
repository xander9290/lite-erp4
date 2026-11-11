"use client";

import { useMemo, useState } from "react";
import ListView from "@/components/ui/list/ListView";
import CardView from "@/components/ui/card/CardView";
import KanbanView from "@/components/ui/kanban/KanbanView";
import type { CollectionField } from "@/components/ui/collection/types";
import type { ListState } from "@/lib/list/types";
import type { KanbanRequest } from "@/lib/kanban/types";
import { createDemoRecords, demoColumns, demoGroups, demoPage } from "./collection-demo";

const records = createDemoRecords().slice(0, 3).map((record, index) => ({ ...record,
  status: demoGroups[index].value,
  photo: index === 0 ? "https://res.cloudinary.com/demo/image/upload/sample.jpg" : index === 1 ? null : "https://example.invalid/missing-image.webp",
}));
const load = async (state: ListState) => demoPage(records, state);
const loadColumn = async ({ state, group }: KanbanRequest) => demoPage(records, state, group);

export default function ImageCollectionsSample() {
  const [shape, setShape] = useState<"rounded" | "squared">("rounded");
  const columns = useMemo(() => [demoColumns[0], { field: "photo", label: "Imagen", widget: "image", imageSize: "md", imageShape: shape, type: "text", sortable: false, filterable: false }, ...demoColumns.slice(1, 3)] as const satisfies readonly CollectionField[], [shape]);
  return <section id="image-collections" className="min-w-0 scroll-mt-6 space-y-4">
    <header><h2 className="text-xl font-semibold">Imágenes en colecciones</h2><p className="mt-1 text-sm text-base-content/65">Datos ficticios: imagen pública, imagen vacía y URL que falla. ListView, CardView y KanbanView comparten miniaturas y fallback accesible. No se suben archivos ni se guardan registros.</p></header>
    <label className="flex items-center gap-2 text-sm">Forma de miniaturas
      <select autoComplete="off" className="select select-sm w-auto" value={shape} onChange={event => setShape(event.target.value as "rounded" | "squared")}><option value="rounded">rounded</option><option value="squared">squared</option></select>
    </label>
    <ListView model="ImageDemo" title="Imágenes en lista" columns={columns} searchFields={["name", "client"]} load={load} create={false} delete={false} pageSize={5} paramPrefix="imagesList" />
    <CardView model="ImageDemo" title="Imágenes en tarjetas" titleField="name" columns={columns} searchFields={["name", "client"]} load={load} pageSize={3} paramPrefix="imagesCards" />
    <KanbanView model="ImageDemo" title="Imágenes en tablero" titleField="name" columns={columns} searchFields={["name", "client"]} groupField="status" groups={demoGroups} load={loadColumn} pageSize={3} paramPrefix="imagesBoard" className="h-[38rem]" />
  </section>;
}
