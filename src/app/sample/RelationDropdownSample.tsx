"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import FieldMany2One from "@/components/ui/form/FieldMany2One";
import FieldRelationTag from "@/components/ui/form/FieldRelationTag";
import FormLayout from "@/components/ui/form/FormLayout";
import Modal from "@/components/ui/alerts/Modal";
import type { Many2OneLoader } from "@/lib/many2one/model-lookup";

const options = ["Aguascalientes", "Baja California", "Baja California Sur", "Campeche", "Coahuila de Zaragoza", "Colima"].map((label, index) => ({ value: `demo-${index}`, label, record: { id: `demo-${index}` } }));
const load: Many2OneLoader = async request => {
  const matches = options.filter(option => request.id ? option.value === request.id : request.ids ? request.ids.includes(option.value) : option.label.toLocaleLowerCase().includes((request.query ?? "").toLocaleLowerCase()));
  const page = request.page ?? 1, pageSize = request.ids?.length ?? request.pageSize ?? 5;
  return { ok: true, items: matches.slice((page - 1) * pageSize, page * pageSize), total: matches.length, page, pageSize };
};
const schema = z.strictObject({ superior: z.string().nullable(), inferior: z.string().nullable(), etiquetas: z.array(z.string()), modal: z.string().nullable() });
type Values = z.input<typeof schema>;

export default function RelationDropdownSample() {
  const methods = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { superior: null, inferior: null, etiquetas: [], modal: null } });
  const [modal, setModal] = useState(false);
  const [saved, setSaved] = useState<Values | null>(null);
  return <section id="relation-dropdown" className="card min-w-0 scroll-mt-6 space-y-4 border border-base-300 bg-base-100 p-5">
    <h2 className="text-xl font-semibold">Dropdowns de relaciones: espacio disponible</h2>
    <p className="text-sm">Datos ficticios sin BD. Abre los selectores y desplaza el recuadro: el menú usa el espacio visible arriba o abajo, sin agrandar el scroll. Flechas y Enter conservan la selección.</p>
    <FormLayout methods={methods} onSubmit={setSaved}>
      <div data-dropdown-demo className="col-span-full h-96 overflow-y-auto rounded-xl border border-base-300 p-4">
        <FieldMany2One name="superior" label="Selector superior" load={load} />
        <div className="h-40" aria-hidden="true" />
        <FieldMany2One name="inferior" label="Selector inferior" load={load} />
        <div className="h-40" aria-hidden="true" />
        <FieldRelationTag name="etiquetas" label="Etiquetas inferiores" load={load} />
      </div>
      <button type="submit" className="btn btn-primary">Validar dropdowns</button>
      <button type="button" className="btn btn-soft" onClick={() => setModal(true)}>Probar dropdown en modal</button>
    </FormLayout>
    {saved && <pre role="status" className="overflow-auto text-xs">{JSON.stringify(saved, null, 2)}</pre>}
    <Modal open={modal} title="Selector en modal" onClose={() => setModal(false)}>
      <FormLayout methods={methods} onSubmit={setSaved}>
        <div className="col-span-full h-64 overflow-y-auto p-3">
          <div className="h-32" aria-hidden="true" />
          <FieldMany2One name="modal" label="Estado en modal" load={load} />
        </div>
        <button type="button" className="btn btn-soft" onClick={() => setModal(false)}>Cerrar ejemplo</button>
      </FormLayout>
    </Modal>
  </section>;
}
