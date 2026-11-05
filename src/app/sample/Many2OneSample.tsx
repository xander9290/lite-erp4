"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Search, Link2 } from "lucide-react";
import FieldMany2One from "@/components/ui/form/FieldMany2One";
import FormLayout from "@/components/ui/form/FormLayout";
import FormGroup from "@/components/ui/form/FormGroup";
import { searchMany2One } from "@/lib/many2one/actions";
import type { Many2OneRecord } from "@/lib/many2one/types";
import { many2OneSampleSchema, type Many2OneSampleInput, type Many2OneSampleValues } from "./sample.schema";

const defaults: Many2OneSampleInput = { userId: null, partnerId: null };

export default function Many2OneSample() {
  const methods = useForm<Many2OneSampleInput, unknown, Many2OneSampleValues>({ resolver: zodResolver(many2OneSampleSchema), defaultValues: defaults });
  const [submitted, setSubmitted] = useState<Many2OneSampleValues | null>(null);
  const [change, setChange] = useState<{ id: string | null; record: Many2OneRecord | null } | null>(null);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const { isDirty, dirtyFields } = methods.formState;

  async function loadExample() {
    setLoading(true); setNotice(null);
    try {
      const result = await searchMany2One({ model: "user", searchFields: ["login", "partner.name"], displayName: "[{login}] {partner.name}", pageSize: 1 });
      if (!result.ok) { setNotice(result.error); return; }
      const first = result.items[0];
      if (!first) { setNotice("Aún no hay usuarios en la base de datos. Puedes explorar la búsqueda y su estado vacío."); return; }
      methods.reset({ userId: first.value, partnerId: first.record.partner?.id ?? null });
      setChange(null); setSubmitted(null);
    } catch { setNotice("No pudimos cargar el ejemplo. Intenta nuevamente."); }
    finally { setLoading(false); }
  }

  return (
    <section id="field-many2one" aria-labelledby="field-many2one-title" className="card min-w-0 scroll-mt-6 border border-base-300 bg-base-100 shadow-sm">
      <div className="card-body min-w-0 gap-5 p-4 sm:p-6">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-2">
            <div className="flex items-center gap-2"><span className="flex size-8 items-center justify-center rounded-xl bg-primary/10 text-primary"><Link2 size={17} aria-hidden="true" /></span><h2 id="field-many2one-title" className="text-xl font-semibold">FieldMany2One</h2></div>
            <p className="max-w-2xl text-sm text-base-content/65">Encuentra y selecciona registros de tu base de datos. Busca al escribir o explora más resultados en el modal.</p>
          </div>
          <span className="badge badge-soft badge-primary gap-1.5"><Search size={12} aria-hidden="true" />Búsqueda relacional</span>
        </header>

        <FormLayout methods={methods} onSubmit={setSubmitted} onInvalid={() => setSubmitted(null)} aria-labelledby="field-many2one-title">
          <FormGroup legend="Usuario · requerido">
            <FieldMany2One<Many2OneSampleInput> name="userId" label="Usuario" direction="inline" model="user" searchFields={["login", "partner.name"]} displayName="[{login}] {partner.name}"
              columns={[{ field: "login", label: "Login" }, { field: "partner.name", label: "Contacto" }]} pageSize={5} required
              onChange={(id, record) => { setChange({ id, record }); setSubmitted(null); }} />
            <p className="text-xs leading-relaxed text-base-content/55">Busca por login o por el nombre del contacto relacionado. La selección guarda únicamente el ID del usuario.</p>
          </FormGroup>
          <FormGroup legend="Contacto · opcional, sin label">
            <FieldMany2One<Many2OneSampleInput> name="partnerId" aria-label="Contacto opcional" model="partner" direction="inline" searchFields={["name", "user.login"]} displayName="{name}" placeholder="Buscar un contacto…"
              columns={[{ field: "user.login", label: "Usuario vinculado" }]} onChange={(id, record) => { setChange({ id, record }); setSubmitted(null); }} />
            <p className="text-xs leading-relaxed text-base-content/55">Sin label ocupa todo el ancho. También encuentra contactos por el login de su usuario vinculado.</p>
          </FormGroup>
          <div className="col-span-full flex flex-wrap items-center gap-2 border-t border-base-300 pt-4">
            <button type="submit" className="btn btn-primary">Validar ejemplo</button>
            <button type="button" className="btn btn-soft" disabled={loading} onClick={loadExample}>{loading && <span className="loading loading-spinner loading-xs" aria-hidden="true" />}Cargar primer usuario</button>
            <button type="button" className="btn btn-ghost" onClick={() => { methods.reset(defaults); setSubmitted(null); setChange(null); setNotice(null); }}>Restablecer</button>
            <span className={`badge ml-auto ${isDirty ? "badge-soft badge-warning" : "badge-ghost"}`} role="status">{isDirty ? "Con cambios" : "Sin cambios"}</span>
          </div>
        </FormLayout>

        {notice && <p role="status" className="rounded-xl bg-base-200 p-3 text-sm text-base-content/65">{notice}</p>}
        <div className="grid min-w-0 gap-3 sm:grid-cols-2">
          <div className="min-w-0 rounded-xl bg-base-200/60 p-4"><p className="mb-2 text-xs font-medium text-base-content/55">onChange(id, record)</p><pre className="max-h-44 overflow-auto text-xs leading-relaxed">{change ? JSON.stringify(change, null, 2) : "Selecciona o limpia un registro para ver el resultado."}</pre></div>
          <div className="min-w-0 rounded-xl bg-base-200/60 p-4"><p className="mb-2 text-xs font-medium text-base-content/55">Estado de React Hook Form</p><pre className="overflow-auto text-xs leading-relaxed">{JSON.stringify({ isDirty, dirtyFields }, null, 2)}</pre></div>
        </div>
        {submitted && <div className="min-w-0 rounded-xl border border-success/25 bg-success/5 p-4"><p className="mb-2 text-sm font-semibold">Datos validados</p><pre className="overflow-x-auto text-xs">{JSON.stringify(submitted, null, 2)}</pre></div>}
      </div>
    </section>
  );
}
