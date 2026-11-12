"use client";

import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import FormView from "@/components/ui/form/FormView";
import FormGroup from "@/components/ui/form/FormGroup";
import FieldText from "@/components/ui/form/FieldText";
import { recordIdentityShape, validateRecordIdentity } from "@/lib/orm/record";

const schema = z.object({ ...recordIdentityShape, name: z.string().min(1, "Escribe un nombre.") }).superRefine(validateRecordIdentity);
type Values = z.infer<typeof schema>;
const initial: Values = { id: "form-delete-demo", revision: "2026-11-12T12:00:00.000Z", name: "Registro ficticio" };

function Editor() {
  const record = useRef<Values | null>({ ...initial });
  const [reject, setReject] = useState(false);
  const [readOnly, setReadOnly] = useState(false);
  const methods = useForm<Values>({ resolver: zodResolver(schema), defaultValues: initial });
  return <>
    <div className="flex flex-wrap gap-4 text-sm">
      <label className="flex items-center gap-2"><input autoComplete="off" type="checkbox" className="checkbox checkbox-sm" checked={reject} onChange={event => setReject(event.target.checked)} />Simular relación que impide eliminar</label>
      <label className="flex items-center gap-2"><input autoComplete="off" type="checkbox" className="checkbox checkbox-sm" checked={readOnly} onChange={event => setReadOnly(event.target.checked)} />Formulario en consulta</label>
    </div>
    <FormView title="Registro para eliminar" methods={methods} readOnly={readOnly}
      onSubmit={async values => {
        if (!record.current) return { ok: false, error: "El registro ficticio ya fue eliminado." };
        record.current = { ...values, revision: new Date(Date.parse(record.current.revision!) + 1).toISOString() };
        return { ok: true, values: record.current };
      }}
      deletion={{ returnHref: "/sample#form-deletion-result", action: async targets => {
        if (reject) return { ok: false, kind: "validation", error: "Simulación: otro registro utiliza este elemento. El formulario y sus cambios se conservan." };
        if (targets.length !== 1 || targets[0].id !== record.current?.id || targets[0].revision !== record.current?.revision) return { ok: false, kind: "validation", error: "El registro ficticio cambió o ya no existe." };
        record.current = null;
        return { ok: true, deleted: 1 };
      } }}>
      <FormGroup legend="Datos ficticios"><FieldText<Values> name="name" label="Nombre para eliminación" /></FormGroup>
    </FormView>
  </>;
}

export default function FormDeletionSample() {
  const [version, setVersion] = useState(0);
  return <section id="form-deletion" className="min-w-0 scroll-mt-6 space-y-3">
    <header className="space-y-1"><h2 className="text-xl font-semibold">Eliminar desde FormView</h2><p className="text-sm text-base-content/60">Demo reversible en memoria, sin base de datos ni acciones sobre registros reales. Edita el nombre y prueba cancelar, un rechazo y eliminar desde el menú de acciones. Una confirmación cubre la eliminación y los cambios pendientes.</p></header>
    <Editor key={version} />
    <div id="form-deletion-result" className="scroll-mt-6 space-y-2 text-sm"><p>El borrado confirmado vuelve a este punto de la demo. En el ERP se vuelve a la colección autorizada, conservando filtros y paginación de returnTo.</p><button type="button" className="btn btn-ghost btn-sm" onClick={() => setVersion(value => value + 1)}>Restablecer eliminación de ejemplo</button></div>
  </section>;
}
