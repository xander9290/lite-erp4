"use client";

import { useCallback } from "react";
import Link from "next/link";
import Breadcrumbs from "@/components/ui/Breadcrumbs";
import FormViewLoader from "@/components/ui/form/FormViewLoader";
import { kindLabel, statusLabel } from "@/lib/module-manager/types";
import { readModule } from "./actions";
import OperationPanel from "./OperationPanel";

function References({ ids }: { ids: readonly string[] }) {
  return ids.length ? <ul className="flex flex-wrap gap-2">{ids.map(id => <li key={id}><Link href={`/erp/modulos/${encodeURIComponent(id)}`} className="link link-primary break-all">{id}</Link></li>)}</ul> : <span className="text-base-content/60">Ninguno</span>;
}

export default function ModuleDetail({ id }: { id: string }) {
  const load = useCallback(() => readModule(id), [id]);
  return <FormViewLoader recordKey={id} load={load}>{record => <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-2 sm:p-3">
    <Breadcrumbs items={[{ label: "Aplicaciones", href: "/erp" }, { label: "Módulos", href: "/erp/modulos" }, { label: record.name }]} />
    <h1 className="sr-only">{record.name}</h1>
    <div className="grid gap-3 lg:grid-cols-2">
      <section className="rounded-box border border-base-300 p-3" aria-label="Información del módulo">
        <h2 className="mb-3 font-semibold">Información</h2>
        <dl className="grid grid-cols-[7rem_minmax(0,1fr)] gap-2 text-sm">
          <dt>Nombre</dt><dd className="break-words">{record.name}</dd>
          <dt>Identificador</dt><dd className="break-all">{record.id}</dd>
          <dt>Tipo</dt><dd>{kindLabel(record.kind)}</dd>
          <dt>Versión</dt><dd>{record.version || "No disponible"}</dd>
          <dt>Estado</dt><dd>{statusLabel(record.status)}</dd>
          <dt>En el catálogo</dt><dd>{record.registered ? "Sí" : "No"}</dd>
        </dl>
        {record.description && <p className="mt-3 text-sm text-base-content/70">{record.description}</p>}
      </section>
      <section className="space-y-3 rounded-box border border-base-300 p-3 text-sm" aria-label="Dependencias">
        <h2 className="font-semibold">Dependencias</h2>
        <p>Necesita:</p><References ids={record.depends} />
        <p>Otras aplicaciones que lo necesitan:</p><References ids={record.dependents} />
        {record.missingDependencies.length > 0 && <div role="status" className="rounded-box bg-warning/10 p-3">Hay dependencias que requieren atención: {record.missingDependencies.join(", ")}.</div>}
      </section>
    </div>
    {record.issues.length > 0 && <ul role="status" className="list-inside list-disc rounded-box bg-warning/10 p-3 text-sm">{record.issues.map(issue => <li key={issue}>{issue}</li>)}</ul>}
    <section className="space-y-3 rounded-box border border-base-300 p-3 text-sm" aria-label="Instalación">
      <h2 className="font-semibold">Instalación</h2>
      <p>El estado contrasta los modelos declarados, su registro y las tablas de esta base. Los cambios de campos aún no sincronizados y las diferencias de índices o restricciones requieren una revisión adicional.</p>
      {record.models.length > 0 ? <ul className="space-y-2">{record.models.map(model => {
        const table = record.tables.find(table => table.model === model);
        return <li key={model} className="break-words"><span className="font-medium">{model}</span><span className="text-base-content/65"> — {!table ? "Pendiente de incorporar al esquema" : !table.present ? "Tabla pendiente" : table.missingColumns.length ? `Faltan ${table.missingColumns.length} campos en la base` : "Presente en la base"}</span></li>;
      })}</ul> : <p>{record.kind === "manual" ? "Esta aplicación no declara modelos propios." : "Añade el primer modelo antes de instalar este módulo."}</p>}
    </section>
    <OperationPanel record={record} />
  </div>}</FormViewLoader>;
}
