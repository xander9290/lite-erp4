"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import FormLayout from "@/components/ui/form/FormLayout";
import FormGroup from "@/components/ui/form/FormGroup";
import FieldRelationTag from "@/components/ui/form/FieldRelationTag";
import type { Many2OneLoader } from "@/lib/many2one/model-lookup";
import type { Many2OneCreator } from "@/lib/many2one/types";
import { tags, many2manySampleSchema, type Many2manySampleValues } from "./many2many.schema";

const options = ["Urgente", "Instalación", "Revisión", "Soporte", "Garantía"].map((label, index) => ({ value: `tag-${index}`, label, record: { id: `tag-${index}` } }));
const load: Many2OneLoader = async request => {
  const matches = options.filter(option => request.ids ? request.ids.includes(option.value) : option.label.toLocaleLowerCase().includes((request.query ?? "").toLocaleLowerCase()));
  const page = request.page ?? 1, pageSize = request.ids?.length ?? request.pageSize ?? 5;
  return { ok: true, items: matches.slice((page - 1) * pageSize, page * pageSize), total: matches.length, page, pageSize };
};
// In the ERP, modelQuickCreate creates through the target service; here, in memory.
const create: Many2OneCreator = async text => {
  await new Promise(resolve => setTimeout(resolve, 300));
  const existing = options.find(option => option.label.toLocaleLowerCase() === text.toLocaleLowerCase());
  if (existing) return { ok: true, item: existing, created: false };
  if (text.toLocaleLowerCase() === "error") return { ok: false, error: "Ejemplo de rechazo del servidor: no tienes permiso para crear etiquetas." };
  const item = { value: `tag-${options.length}`, label: text, record: { id: `tag-${options.length}` } };
  options.push(item);
  return { ok: true, item, created: true };
};
const model = { fields: {}, many2many: { etiquetas: tags }, lookups: { etiquetas: load }, creators: { etiquetas: create } };

export default function Many2manySample() {
  const methods = useForm<Many2manySampleValues>({ resolver: zodResolver(many2manySampleSchema), defaultValues: { etiquetas: [] } });
  const [result, setResult] = useState<Many2manySampleValues | null>(null);
  return <section id="many2many-model" className="card min-w-0 scroll-mt-6 border border-base-300 bg-base-100 p-4 sm:p-6">
    <h2 className="text-xl font-semibold">Many2many declarativo</h2>
    <p className="my-3 text-sm">Selecciona entre una y tres etiquetas. Escribe un nombre que no exista para ver «Crear …» (escribe «error» para ver un rechazo). Datos ficticios en memoria: esta demo valida IDs y no persiste registros ni vínculos.</p>
    <FormLayout methods={methods} model={model} onSubmit={setResult}>
      <FormGroup><FieldRelationTag<Many2manySampleValues> name="etiquetas" direction="inline" /></FormGroup>
      <div className="col-span-full flex gap-2">
        <button type="submit" className="btn btn-primary">Validar selección</button>
        <button type="button" className="btn btn-soft" onClick={() => { methods.reset({ etiquetas: ["tag-0", "tag-1"] }); setResult(null); }}>Cargar ejemplo</button>
        <button type="button" className="btn btn-ghost" onClick={() => { methods.reset({ etiquetas: [] }); setResult(null); }}>Restablecer</button>
      </div>
    </FormLayout>
    {result && <pre role="status" className="mt-3 overflow-auto text-xs">{JSON.stringify(result, null, 2)}</pre>}
  </section>;
}
