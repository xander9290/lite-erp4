"use client";

import { useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Fields } from "@/lib/orm/fields";
import { compileActionParameters, parseActionParameters } from "@/lib/orm/action-parameters";
import { ActionParameterError } from "@/lib/orm/context";
import FormView from "@/components/ui/form/FormView";
import FormGroup from "@/components/ui/form/FormGroup";
import FormHeader from "@/components/ui/form/FormHeader";
import FormButton from "@/components/ui/form/FormButton";
import FieldText from "@/components/ui/form/FieldText";
import type { FormViewResult } from "@/components/ui/form/formView.types";
import type { FormActionTarget } from "@/components/ui/form/formActions";
import { defineActionReferences } from "@/lib/orm/action-reference";

const ticketActions = defineActionReferences("SampleParameterTicket", ["cerrar"]);

const parameters = compileActionParameters({ nota: Fields.Text({ label: "Nota de resolución", required: true, maxLength: 1000 }), avisar: Fields.Boolean({ label: "Solicitar aviso", default: false }) })!;
const actions = [{ name: "cerrar", label: "Cerrar ticket", params: parameters.metadata }];
const schema = z.strictObject({ id: z.string(), revision: z.iso.datetime(), name: z.string().trim().min(1, "Escribe un título."), resolucion: z.string(), estado: z.enum(["abierto", "cerrado"]) });
type Values = z.infer<typeof schema>;
const initial: Values = { id: "ticket-param-demo", revision: "2026-11-17T12:00:00.000Z", name: "Revisar equipo", resolucion: "", estado: "abierto" };
const next = (revision: string) => new Date(Date.parse(revision) + 1).toISOString();

function Editor() {
  const stored = useRef(initial);
  const [log, setLog] = useState<string[]>([]);
  const methods = useForm<Values>({ resolver: zodResolver(schema), defaultValues: initial });
  const estado = useWatch({ control: methods.control, name: "estado" });
  const note = (message: string) => setLog(previous => [...previous, message]);
  const save = async (values: Values): Promise<FormViewResult<Values>> => {
    if (values.revision !== stored.current.revision) return { ok: false, kind: "validation", error: "Recarga el registro." };
    stored.current = { ...values, revision: next(values.revision) }; note("Guardado del formulario");
    return { ok: true, values: stored.current };
  };
  const run = async (_action: string, target: FormActionTarget, input?: Record<string, unknown>): Promise<FormViewResult<Values>> => {
    note("Ejecución de cerrar con revisión guardada");
    if (target.revision !== stored.current.revision || target.id !== stored.current.id) return { ok: false, kind: "validation", error: "Recarga el registro." };
    if (stored.current.estado === "cerrado") return { ok: false, kind: "validation", error: "El ticket ya está cerrado." };
    try {
      const params = parseActionParameters(parameters, input);
      if (params.nota === "rechazar") throw new ActionParameterError("Revisa la nota.", { nota: "Usa otra nota para completar la demostración." });
      stored.current = { ...stored.current, estado: "cerrado", resolucion: String(params.nota), revision: next(stored.current.revision) };
      return { ok: true, values: stored.current, message: "Ticket ficticio cerrado." };
    } catch (error) {
      return { ok: false, kind: "validation", error: error instanceof Error ? error.message : "Datos inválidos.", ...(error instanceof ActionParameterError ? { parameterErrors: error.parameterErrors } : {}) };
    }
  };
  return <>
    <FormView title="Ticket ficticio con parámetros" methods={methods} actionModel="SampleParameterTicket" actions={actions} onSubmit={save} runAction={run}>
      <FormHeader><FormButton action={ticketActions.cerrar} invisible={estado === "cerrado"} /></FormHeader>
      <FormGroup legend="Datos del ticket">
        <FieldText<Values> name="name" label="Título del ticket" />
        <FieldText<Values> name="resolucion" label="Resolución guardada" widget="long" readOnly />
        <FieldText<Values> name="estado" label="Estado" readOnly />
      </FormGroup>
    </FormView>
    <ol aria-label="Orden de llamadas del ejemplo" className="list-decimal pl-5 text-xs">{log.map((message, index) => <li key={index}>{message}</li>)}</ol>
  </>;
}

export default function ActionParametersSample() {
  const [version, setVersion] = useState(0);
  return <section id="action-parameters" className="min-w-0 scroll-mt-6 space-y-3">
    <h2 className="text-xl font-semibold">Acciones con parámetros</h2>
    <p className="text-sm">Demo en memoria, sin BD ni avisos reales. Cerrar ticket pide una nota; Cancelar no guarda ni ejecuta. Modifica el título para probar guardado → acción. La nota «rechazar» simula un error del servidor; al reintentar conserva los argumentos confirmados.</p>
    <button type="button" className="btn btn-soft btn-sm" onClick={() => setVersion(value => value + 1)}>Restablecer parámetros de ejemplo</button>
    <Editor key={version} />
  </section>;
}
