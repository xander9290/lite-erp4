"use client";

import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import FormView from "@/components/ui/form/FormView";
import FormGroup from "@/components/ui/form/FormGroup";
import FormHeader from "@/components/ui/form/FormHeader";
import FormButton from "@/components/ui/form/FormButton";
import FieldText from "@/components/ui/form/FieldText";
import FieldSelect from "@/components/ui/form/FieldSelect";
import { recordIdentityShape, validateRecordIdentity } from "@/lib/orm/record";
import type { FormViewResult } from "@/components/ui/form/FormView";
import { defineActionReferences } from "@/lib/orm/action-reference";

const saleActions = defineActionReferences("SampleSale", ["confirmar", "cancelar"]);

const estados = [{ value: "borrador", label: "Borrador" }, { value: "confirmada", label: "Confirmada" }, { value: "cancelada", label: "Cancelada" }] as const;
const schema = z.object({ ...recordIdentityShape, name: z.string().trim().min(1, "Escribe el cliente."), estado: z.enum(["borrador", "confirmada", "cancelada"]) }).superRefine(validateRecordIdentity);
type Values = z.infer<typeof schema>;
type Stored = Values & { id: string; revision: string };
const existing: Stored = { id: "venta-demo", revision: "2026-11-14T12:00:00.000Z", name: "Cliente ficticio", estado: "borrador" };
const blank: Values = { name: "", estado: "borrador" };
const next = (revision: string) => new Date(Date.parse(revision) + 1000).toISOString();

/**
 * In-memory stand-in for a model with `@action` methods: the rules (transition from
 * borrador, revision check) live on the "server" side, never in the buttons.
 */
function Editor({ creating }: { creating: boolean }) {
  const stored = useRef<Stored | null>(creating ? null : existing);
  const [failAction, setFailAction] = useState(false);
  const [readOnly, setReadOnly] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const note = (line: string) => setLog(lines => [...lines.slice(-5), line]);
  const methods = useForm<Values>({ resolver: zodResolver(schema), defaultValues: creating ? blank : existing });

  async function save(values: Values): Promise<FormViewResult<Values>> {
    await new Promise(resolve => setTimeout(resolve, 300));
    const current = stored.current;
    if (current && values.revision !== current.revision) return { ok: false, kind: "validation", error: "El registro cambió. Recárgalo." };
    stored.current = { ...values, id: current?.id ?? "venta-nueva", revision: current ? next(current.revision) : "2026-11-14T12:00:00.000Z" };
    note(`Guardado (rev. ${stored.current.revision.slice(11, 19)})`);
    return { ok: true, values: stored.current, message: "Registro guardado." };
  }
  async function runAction(action: string, target: { id: string; revision: string }): Promise<FormViewResult<Values>> {
    await new Promise(resolve => setTimeout(resolve, 400));
    const current = stored.current;
    note(`Acción «${action}» con rev. ${target.revision.slice(11, 19)}`);
    if (!current || current.id !== target.id || current.revision !== target.revision) return { ok: false, kind: "validation", error: "El registro cambió desde que lo abriste." };
    if (failAction) return { ok: false, kind: "validation", error: "Simulación: la acción falló; lo guardado se conserva." };
    if (action === "confirmar" && current.estado !== "borrador") return { ok: false, kind: "validation", error: "Sólo se confirman ventas en borrador." };
    if (action === "cancelar" && current.estado === "cancelada") return { ok: false, kind: "validation", error: "La venta ya está cancelada." };
    stored.current = { ...current, estado: action === "confirmar" ? "confirmada" : "cancelada", revision: next(current.revision) };
    return { ok: true, values: stored.current, message: `${action === "confirmar" ? "Confirmar" : "Cancelar"}: acción completada.` };
  }

  return <>
    <div className="flex flex-wrap gap-4 text-sm">
      <label className="flex items-center gap-2"><input autoComplete="off" type="checkbox" className="checkbox checkbox-sm" checked={failAction} onChange={event => setFailAction(event.target.checked)} />Simular fallo de la acción</label>
      <label className="flex items-center gap-2"><input autoComplete="off" type="checkbox" className="checkbox checkbox-sm" checked={readOnly} onChange={event => setReadOnly(event.target.checked)} />Formulario en consulta</label>
    </div>
    <FormView title="Venta ficticia" methods={methods} readOnly={readOnly} actionModel="SampleSale"
      onSubmit={save} runAction={runAction}
      actions={[{ name: "confirmar", label: "Confirmar" }, { name: "cancelar", label: "Cancelar venta" }]}>
      <FormHeader>
        <div className="flex flex-wrap gap-2">
          <FormButton action={saleActions.confirmar} />
          <FormButton action={saleActions.cancelar} variant="secondary" />
        </div>
        <FieldSelect<Values> name="estado" widget="statebar" options={estados} />
      </FormHeader>
      <FormGroup legend="Datos de la venta"><FieldText<Values> name="name" label="Cliente" /></FormGroup>
    </FormView>
    <ol className="list-decimal space-y-1 pl-5 text-xs text-base-content/70" aria-label="Registro de llamadas simuladas">{log.map((line, index) => <li key={index}>{line}</li>)}</ol>
  </>;
}

export default function FormActionsSample() {
  const [version, setVersion] = useState(0);
  const [creating, setCreating] = useState(false);
  return <section id="form-actions" className="min-w-0 scroll-mt-6 space-y-3">
    <header className="space-y-1">
      <h2 className="text-xl font-semibold">Acciones de formulario</h2>
      <p className="text-sm text-base-content/60">FormHeader y FormButton con datos ficticios en memoria. El botón valida y guarda si el registro es nuevo o tiene cambios; sólo entonces ejecuta la acción con la revisión guardada. Sin cambios, ejecuta la acción directamente. Si la acción falla, lo guardado se conserva.</p>
    </header>
    <div className="flex flex-wrap gap-2">
      <button type="button" className="btn btn-sm btn-soft" onClick={() => { setCreating(false); setVersion(value => value + 1); }}>Venta existente</button>
      <button type="button" className="btn btn-sm btn-soft" onClick={() => { setCreating(true); setVersion(value => value + 1); }}>Venta nueva</button>
    </div>
    <Editor key={`${version}:${creating}`} creating={creating} />
  </section>;
}
