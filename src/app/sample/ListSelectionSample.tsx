"use client";

import { useCallback, useRef, useState } from "react";
import ListView from "@/components/ui/list/ListView";
import { listDeleteSelectionSchema, type ListDeleteResult, type ListDeleteTarget } from "@/lib/list/selection";
import type { ListState } from "@/lib/list/types";
import { createDemoRecords, demoColumns, demoPage } from "./collection-demo";

export default function ListSelectionSample() {
  const records = useRef(createDemoRecords());
  const [version, setVersion] = useState(0);
  const load = useCallback(async (state: ListState) => demoPage(records.current, state), []);
  const remove = useCallback(async (selection: readonly ListDeleteTarget[]): Promise<ListDeleteResult> => {
    const parsed = listDeleteSelectionSchema.safeParse(selection);
    if (!parsed.success) return { ok: false, kind: "validation", error: "Selección inválida." };
    if (parsed.data.some(target => !records.current.some(row => row.id === target.id && row.revision === target.revision))) return { ok: false, kind: "validation", error: "La selección cambió. Actualiza el ejemplo." };
    const ids = new Set(parsed.data.map(target => target.id));
    records.current = records.current.filter(row => !ids.has(row.id));
    return { ok: true, deleted: ids.size };
  }, []);
  return <section id="list-selection" className="min-w-0 scroll-mt-6 space-y-3">
    <header className="space-y-1 px-1"><h3 className="text-lg font-semibold">Selección individual y múltiple</h3><p className="text-sm text-base-content/60">Selecciona filas o toda la página y prueba Eliminar. Datos ficticios en memoria; restablecer recupera el ejemplo. Crear está oculto con create=false.</p></header>
    <ListView key={version} model="SelectionDemo" title="Selección de proyectos" columns={demoColumns} searchFields={["name", "client"]} load={load} onDelete={remove}
      create={false} createHref="/erp/flota/nuevo" pageSize={3} paramPrefix="selection" className="h-[34rem]"
      headerActions={<button type="button" className="btn btn-ghost btn-sm" onClick={() => { records.current = createDemoRecords(); setVersion(value => value + 1); }}>Restablecer ejemplo</button>}
      footer={<span>La casilla del encabezado selecciona sólo la página visible. Cambiar la consulta limpia la selección.</span>} />
  </section>;
}
