"use client";

import { useState } from "react";
import ListView from "@/components/ui/list/ListView";
import CardView from "@/components/ui/card/CardView";
import KanbanView from "@/components/ui/kanban/KanbanView";
import type { CollectionField } from "@/components/ui/collection/types";
import { demoColumns, demoGroups } from "./collection-demo";
import { sampleRelationList, sampleRelationKanban } from "./displayName.actions";

const columns = [demoColumns[0], { field: "client", label: "Vehículo", type: "text", widget: "many2one", sortable: true }, demoColumns[4]] as const satisfies readonly CollectionField[];

export default function RelationCollectionsSample() {
  const [view, setView] = useState<"list" | "card" | "kanban">("list");
  return <div className="mt-6 min-w-0 space-y-3">
    <p className="text-sm">El mismo displayName aparece en listas, tarjetas y kanban. Los IDs permanecen intactos; el tercer registro no tiene vehículo. Datos ficticios.</p>
    <div className="flex gap-2" aria-label="Vista de relaciones">
      {([ ["list", "Lista"], ["card", "Tarjetas"], ["kanban", "Kanban"] ] as const).map(([value, label]) => <button key={value} type="button" aria-pressed={view === value} className={`btn btn-sm ${view === value ? "btn-primary" : "btn-ghost"}`} onClick={() => setView(value)}>{label}</button>)}
    </div>
    {view === "list" && <ListView model="RelationDemo" title="Relaciones en lista" columns={columns} searchFields={["name"]} load={sampleRelationList} create={false} delete={false} pageSize={5} paramPrefix="relationList" />}
    {view === "card" && <CardView model="RelationDemo" title="Relaciones en tarjetas" columns={columns} searchFields={["name"]} titleField="name" subtitleField="client" load={sampleRelationList} pageSize={5} paramPrefix="relationCard" />}
    {view === "kanban" && <KanbanView model="RelationDemo" title="Relaciones en kanban" columns={columns} searchFields={["name"]} titleField="name" subtitleField="client" groups={demoGroups} groupField="status" load={sampleRelationKanban} pageSize={5} paramPrefix="relationKanban" className="h-[30rem]" />}
  </div>;
}
