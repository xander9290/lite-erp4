"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Fields } from "@/lib/orm/fields";
import FormLayout from "@/components/ui/form/FormLayout";
import FieldText from "@/components/ui/form/FieldText";

const fields = {
  name: Fields.Text({ label: "Nombre", required: true }),
  codigo: Fields.Text({ label: "Código protegido", required: true }),
  interno: Fields.Text({ label: "Referencia interna" }),
  reservado: Fields.Text({ label: "Dato sin lectura", required: true }),
};
// A no-read field is absent from both the payload and the client validation schema.
const schema = z.strictObject({ name: fields.name.schema, codigo: fields.codigo.schema, interno: fields.interno.schema });
type Input = z.input<typeof schema>;
type Values = z.output<typeof schema>;
const unrestricted = { noRead: false, noWrite: false, invisible: false, readOnly: false };

export default function FieldAccessSample() {
  const [invisible, setInvisible] = useState(false);
  const [blocked, setBlocked] = useState(true);
  const [result, setResult] = useState<Values | null>(null);
  const [executed, setExecuted] = useState(false);
  const methods = useForm<Input, unknown, Values>({ resolver: zodResolver(schema), defaultValues: { name: "Ejemplo", codigo: "CAT-001", interno: "Referencia ficticia" } });
  return <section id="field-action-access" className="card space-y-4 border border-base-300 bg-base-100 p-5">
    <h2 className="text-xl font-semibold">Restricciones de campos y acciones</h2>
    <p className="text-sm">Demo ficticia de presentación, sin persistencia. El código se conserva como sólo lectura; el campo sin lectura no tiene valor ni validación en el cliente. Las pruebas de servidor comprueban la autorización real.</p>
    <div className="flex flex-wrap gap-4">
      <label className="flex items-center gap-2"><input type="checkbox" autoComplete="off" checked={invisible} onChange={event => setInvisible(event.target.checked)} />Ocultar referencia</label>
      <label className="flex items-center gap-2"><input type="checkbox" autoComplete="off" checked={blocked} onChange={event => setBlocked(event.target.checked)} />Bloquear acción</label>
    </div>
    <FormLayout methods={methods} model={{ fields, fieldAccess: {
      codigo: { ...unrestricted, noWrite: true },
      interno: { ...unrestricted, invisible },
      reservado: { ...unrestricted, noRead: true, noWrite: true },
    } }} onSubmit={setResult}>
      <FieldText<Input> name="name" />
      <FieldText<Input> name="codigo" />
      <FieldText<Input> name="interno" />
      <FieldText name="reservado" />
      <div className="flex flex-wrap gap-2">
        <button type="submit" className="btn btn-primary">Validar</button>
        {!blocked && <button type="button" className="btn" onClick={() => setExecuted(true)}>Ejecutar ejemplo</button>}
      </div>
    </FormLayout>
    {executed && <p role="status">Acción ficticia ejecutada.</p>}
    {result && <pre className="overflow-auto text-xs">{JSON.stringify(result, null, 2)}</pre>}
  </section>;
}
