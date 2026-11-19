"use client";

import { useMemo, useState, type ReactNode } from "react";
import type { ListState } from "@/lib/list/types";
import ModelCollection from "@/components/modules/ModelCollection";
import ModelExtensionViews from "@/components/modules/ModelExtensionViews";
import Column from "@/components/modules/Column";
import { Inserter } from "@/components/ui/form/insertions/Insertions";
import { Fields } from "@/lib/orm/fields";
import type { CollectionView, ModelClientConfig } from "@/lib/modules/config";
import type { CollectionSource } from "@/lib/modules/collection";
import { createDemoRecords, demoPage } from "./collection-demo";

/** Fictitious base model + two simulated extensions (no modules, no database). */
const fields = {
  name: Fields.Text({ label: "Proyecto", required: true }),
  client: Fields.Text({ label: "Cliente" }),
  status: Fields.Selection([{ value: "todo", label: "Por hacer" }, { value: "progress", label: "En curso" }, { value: "done", label: "Finalizado" }], { label: "Estado", required: true }),
  rfc: Fields.Text({ label: "RFC" }),
  responsable: Fields.Text({ label: "Responsable" }),
};
const config: ModelClientConfig = {
  capabilities: { read: true, create: false, write: false, unlink: false, move: false },
  id: "sample.insertions", module: "sample", moduleName: "Ejemplos", key: "insertions", name: "InsertionsDemo", label: "Proyectos con extensiones", route: "/sample",
  fields: Object.fromEntries(Object.entries(fields).map(([name, field]) => [name, field.metadata])), preview: {}, related: [], reactionRules: [], lookups: {}, actions: [],
  list: { fields: ["name", "client", "status", "rfc", "responsable"], searchFields: ["name", "client"], sortable: ["name", "client", "status"], filterable: ["name", "client", "status"], groupable: [] },
  view: "list", collectionViews: ["list", "card", "kanban"], kanban: "status", defaultSort: { field: "name", direction: "asc" },
  extensions: [
    { module: "fiscal", label: "Fiscal", fields: ["rfc"], depends: [], insertions: ["list", "card", "kanban"] },
    { module: "crm", label: "CRM", fields: ["responsable"], depends: ["fiscal"], insertions: ["list", "card", "kanban"] },
  ],
};
const people = ["Ana López", "Luis Pérez", "Marta Ruiz"];
const rows = createDemoRecords().map((row, index) => ({ ...row, rfc: `XAXX0101010${String(index).padStart(2, "0")}`, responsable: people[index % 3] }));

// «fiscal»: RFC after the client column; on cards, under the title.
function FiscalList() { return <Inserter target="column:client" position="after"><Column field="rfc" label="RFC (fiscal)" /></Inserter>; }
function FiscalCard() { return <Inserter target="card:title" position="inside"><Column field="rfc" /></Inserter>; }
// «crm» depends on fiscal: column at the end; on cards, a footer row.
function CrmList() { return <Inserter target="columns:end" position="inside"><Column field="responsable" label="Responsable (crm)" /></Inserter>; }
function CrmCard() { return <Inserter target="card:footer" position="inside"><Column field="responsable" label="Responsable (crm)" /></Inserter>; }
// Faulty variant: a base field (not of crm) and a missing column.
function CrmFaulty() {
  return <>
    <Inserter target="columns:end" position="inside"><Column field="responsable" /><Column field="client" /></Inserter>
    <Inserter target="column:presupuesto" position="after"><Column field="responsable" label="Duplicada" /></Inserter>
  </>;
}

export default function CollectionInsertionsSample() {
  const [view, setView] = useState<CollectionView>("list");
  const [faulty, setFaulty] = useState(false);
  const source = useMemo<CollectionSource>(() => ({
    load: async (state: ListState) => demoPage(rows, state),
    loadKanban: async ({ group, state }) => demoPage(rows, state, group),
  }), []);
  const crm: Record<CollectionView, ReactNode> = { list: faulty ? <CrmFaulty /> : <CrmList />, card: <CrmCard />, kanban: <CrmCard /> };
  const insertions = { [view]: { fiscal: view === "list" ? <FiscalList /> : <FiscalCard />, crm: crm[view] } };
  return <section id="collection-insertions" aria-labelledby="collection-insertions-title" className="min-w-0 scroll-mt-6 space-y-4">
    <h2 id="collection-insertions-title" className="text-xl font-semibold">Inserciones en colecciones</h2>
    <p className="text-sm text-base-content/65">Datos ficticios. La lista base declara Proyecto, Cliente y Estado; dos módulos simulados agregan RFC y Responsable sin editarla. Card y Kanban reciben filas en la tarjeta.</p>
    <div className="flex flex-wrap items-center gap-2">
      <div role="group" aria-label="Vista" className="join">
        {(["list", "card", "kanban"] as const).map(item => <button key={item} type="button" className={`btn btn-sm join-item ${view === item ? "btn-primary" : "btn-outline"}`} onClick={() => setView(item)}>{{ list: "Lista", card: "Tarjetas", kanban: "Kanban" }[item]}</button>)}
      </div>
      {view === "list" && <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="checkbox checkbox-sm" checked={faulty} onChange={event => setFaulty(event.currentTarget.checked)} />Inserción con errores</label>}
    </div>
    <div className="flex h-[36rem] min-w-0 flex-col overflow-hidden rounded-xl border border-base-300">
      <ModelExtensionViews key={`${view}-${faulty}`} model={config.id} insertions={insertions}>
        <ModelCollection config={config} source={source} view={view} columns={view === "list" ? [{ field: "name" }, { field: "client" }, { field: "status" }] : undefined}
          paramPrefix="ins" pageSize={6} create={false} open={false} delete={false} movable={false} />
      </ModelExtensionViews>
    </div>
  </section>;
}
