"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Tags } from "lucide-react";
import FieldRelationTag from "@/components/ui/form/FieldRelationTag";
import FormLayout from "@/components/ui/form/FormLayout";
import FormGroup from "@/components/ui/form/FormGroup";
import { searchMany2One } from "@/lib/many2one/actions";
import type { Many2OneRecord } from "@/lib/many2one/types";
import { relationTagSampleSchema, type RelationTagSampleValues } from "./sample.schema";

const defaults: RelationTagSampleValues = { partnerIds: [], userIds: [] };

export default function RelationTagSample() {
  const methods = useForm<RelationTagSampleValues>({ resolver: zodResolver(relationTagSampleSchema), defaultValues: defaults });
  const [submitted, setSubmitted] = useState<RelationTagSampleValues | null>(null);
  const [change, setChange] = useState<{ field: string; ids: string[]; records: Many2OneRecord[] } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { isDirty, dirtyFields } = methods.formState;

  async function loadExample() {
    setLoading(true); setNotice(null);
    try {
      const [partners, users] = await Promise.all([
        searchMany2One({ model: "partner", searchFields: ["name", "user.login"], displayName: "{name}", pageSize: 3 }),
        searchMany2One({ model: "user", searchFields: ["login", "partner.name"], displayName: "[{login}] {partner.name}", pageSize: 3 }),
      ]);
      if (!partners.ok || !users.ok) { setNotice("No pudimos cargar los registros. Intenta nuevamente."); return; }
      methods.reset({ partnerIds: partners.items.map(option => option.value), userIds: users.items.map(option => option.value) });
      setChange(null); setSubmitted(null);
      if (!partners.total) setNotice("Aún no hay contactos en la base de datos. Puedes probar la búsqueda y su estado vacío.");
    } catch { setNotice("No pudimos conectar para cargar los registros."); }
    finally { setLoading(false); }
  }

  return (
    <section id="field-relation-tag" aria-labelledby="field-relation-tag-title" className="card min-w-0 scroll-mt-6 border border-base-300 bg-base-100 shadow-sm">
      <div className="card-body min-w-0 gap-5 p-4 sm:p-6">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-2">
            <div className="flex items-center gap-2"><span className="flex size-8 items-center justify-center rounded-xl bg-primary/10 text-primary"><Tags size={17} aria-hidden="true" /></span><h2 id="field-relation-tag-title" className="text-xl font-semibold">FieldRelationTag</h2></div>
            <p className="max-w-2xl text-sm text-base-content/65">Varios registros, una selección. Agrega tags desde la búsqueda rápida o marca varios en el modal y aplica la selección.</p>
          </div>
          <span className="badge badge-soft badge-primary">Many2many · Tags</span>
        </header>
        <FormLayout methods={methods} onSubmit={setSubmitted} onInvalid={() => setSubmitted(null)} aria-labelledby="field-relation-tag-title">
          <FormGroup legend="Contactos · de 1 a 5">
            <FieldRelationTag<RelationTagSampleValues> name="partnerIds" label="Contactos" model="partner" searchFields={["name", "user.login"]} displayName="{name}"
              columns={[{ field: "user.login", label: "Usuario vinculado" }]} pageSize={5} maxSelected={5} required
              onChange={(ids, records) => { setChange({ field: "partnerIds", ids, records }); setSubmitted(null); }} />
            <p className="text-xs leading-relaxed text-base-content/55">Zod exige al menos un contacto. Busca por su nombre o por el login de su usuario vinculado.</p>
          </FormGroup>
          <FormGroup legend="Usuarios · opcional, sin label">
            <FieldRelationTag<RelationTagSampleValues> name="userIds" aria-label="Usuarios opcionales" direction="inline" model="user" searchFields={["login", "partner.name"]} displayName="[{login}] {partner.name}"
              columns={[{ field: "partner.name", label: "Contacto" }]} maxSelected={8} placeholder="Agregar usuarios…"
              onChange={(ids, records) => { setChange({ field: "userIds", ids, records }); setSubmitted(null); }} />
            <p className="text-xs leading-relaxed text-base-content/55">Sin label ocupa todo el ancho. Quita un tag con su ×, o usa Retroceso cuando la búsqueda esté vacía.</p>
          </FormGroup>
          <div className="col-span-full flex flex-wrap items-center gap-2 border-t border-base-300 pt-4">
            <button type="submit" className="btn btn-primary">Validar ejemplo</button>
            <button type="button" className="btn btn-soft" disabled={loading} onClick={loadExample}>{loading && <span className="loading loading-spinner loading-xs" aria-hidden="true" />}Cargar registros</button>
            <button type="button" className="btn btn-ghost" onClick={() => { methods.reset(defaults); setSubmitted(null); setChange(null); setNotice(null); }}>Restablecer</button>
            <span className={`badge ml-auto ${isDirty ? "badge-soft badge-warning" : "badge-ghost"}`} role="status">{isDirty ? "Con cambios" : "Sin cambios"}</span>
          </div>
        </FormLayout>
        {notice && <p role="status" className="rounded-xl bg-base-200 p-3 text-sm text-base-content/65">{notice}</p>}
        <div className="grid min-w-0 gap-3 sm:grid-cols-2">
          <div className="min-w-0 rounded-xl bg-base-200/60 p-4"><p className="mb-2 text-xs font-medium text-base-content/55">onChange(ids, records)</p><pre className="max-h-44 overflow-auto text-xs leading-relaxed">{change ? JSON.stringify(change, null, 2) : "Agrega o quita un tag para ver sus IDs y registros públicos."}</pre></div>
          <div className="min-w-0 rounded-xl bg-base-200/60 p-4"><p className="mb-2 text-xs font-medium text-base-content/55">Estado de React Hook Form</p><pre className="overflow-auto text-xs leading-relaxed">{JSON.stringify({ isDirty, dirtyFields }, null, 2)}</pre></div>
        </div>
        {submitted && <div className="min-w-0 rounded-xl border border-success/25 bg-success/5 p-4"><p className="mb-2 text-sm font-semibold">Datos validados · arreglos de IDs</p><pre className="overflow-x-auto text-xs">{JSON.stringify(submitted, null, 2)}</pre></div>}
      </div>
    </section>
  );
}
