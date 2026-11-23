"use client";

import { useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import FormView from "@/components/ui/form/FormView";
import FormHeader from "@/components/ui/form/FormHeader";
import FormButton from "@/components/ui/form/FormButton";
import FieldText from "@/components/ui/form/FieldText";
import FieldSelect from "@/components/ui/form/FieldSelect";
import FormGroup from "@/components/ui/form/FormGroup";
import { useAlerts } from "@/components/ui/alerts/AlertProvider";
import { modelUiCapabilities } from "@/lib/access/capabilities";
import { projectModelAccess } from "@/lib/modules/access";
import type { ModelClientConfig } from "@/lib/modules/config";
import { capabilitiesSampleSchema, type CapabilitiesSampleValues as Values } from "./capabilities.schema";
import { defineActionReferences } from "@/lib/orm/action-reference";

const capabilityActions = defineActionReferences("CapabilitiesDemo", ["activate", "reset"]);

const options = [{ value: "draft", label: "Borrador" }, { value: "active", label: "Activo" }];
const declarations = [{ name: "activate", label: "Activar" }, { name: "reset", label: "Volver a borrador", groups: ["responsable"] }];
const config: ModelClientConfig = {
  id: "sample.capabilities", module: "sample", moduleName: "Ejemplos", key: "capabilities", name: "CapabilitiesDemo", label: "Capacidades ficticias", route: "/sample",
  fields: {}, preview: {}, related: [], reactionRules: [], lookups: {}, actions: declarations,
  list: { fields: [], searchFields: [], sortable: [], filterable: [], groupable: [] }, view: "list",
};
const initialValues: Values = { id: "demo", revision: "2026-11-14T00:00:00.000Z", name: "Registro ficticio", state: "draft" };

function Header() {
  const state = useWatch<Values>({ name: "state" });
  return <FormHeader>
    <div className="flex flex-wrap gap-2"><FormButton action={capabilityActions.activate} invisible={state !== "draft"} /><FormButton action={capabilityActions.reset} invisible={state !== "active"} /></div>
    <FieldSelect<Values> name="state" label="Estado de demostración" widget="statebar" readOnly={false} options={options} />
  </FormHeader>;
}

export default function CapabilitiesSample() {
  const [profile, setProfile] = useState("consulta");
  const alerts = useAlerts();
  const saved = useRef<Values>({ ...initialValues });
  const methods = useForm<Values>({ resolver: zodResolver(capabilitiesSampleSchema), defaultValues: initialValues });
  const writable = profile === "operador" || profile === "responsable";
  const access = projectModelAccess(config, { isAdmin: false, groups: new Set(profile === "responsable" ? ["sample.responsable"] : []), modelAccess: {
    [config.id]: { read: true, create: writable, write: writable, unlink: profile === "responsable" || profile === "eliminador" },
  } }, declarations);
  const caps = modelUiCapabilities(access.capabilities);
  const revision = () => new Date(Date.parse(saved.current.revision) + 1000).toISOString();
  return <section id="model-capabilities" aria-labelledby="model-capabilities-title" className="min-w-0 scroll-mt-6 space-y-4">
    <h2 id="model-capabilities-title" className="text-xl font-semibold">Capacidades por modelo</h2>
    <p className="text-sm text-base-content/65">Perfiles simulados; no cambia cuentas ni permisos reales. Consulta bloquea campos y estado; Operador permite crear/editar; Responsable añade acciones y eliminación. Eliminador sólo permite consultar/eliminar. Guardado local, sin BD.</p>
    <label className="flex flex-wrap items-center gap-2 text-sm">Perfil de demostración
      <select autoComplete="off" aria-label="Perfil de capacidades" className="select select-sm" value={profile} onChange={event => setProfile(event.target.value)}>
        <option value="consulta">Consulta</option><option value="operador">Operador</option><option value="responsable">Responsable</option><option value="eliminador">Eliminador</option>
      </select>
    </label>
    <FormView methods={methods} title="Registro de capacidades ficticio" mode="edit" readOnly={!caps.write} actionModel={config.name} actions={access.actions}
      onNew={caps.create ? async () => { await alerts.info({ title: "Nuevo", message: "En un módulo se abriría su formulario de creación. Esta demo no crea registros." }); } : undefined}
      deletion={caps.unlink ? { allowReadOnly: true, returnHref: "/sample", action: async () => ({ ok: false as const, kind: "validation" as const, error: "Demostración: no se eliminan registros." }) } : undefined}
      onSubmit={async values => ({ ok: true, values: { ...values, revision: revision() } })}
      onSaved={values => { saved.current = values; }}
      runAction={async (name, target) => {
        if (!caps.write || !access.actions.some(action => action.name === name) || target.revision !== saved.current.revision) return { ok: false, error: "Acción no disponible." };
        return { ok: true, values: { ...saved.current, revision: revision(), state: name === "activate" ? "active" as const : "draft" as const } };
      }}>
      <Header />
      <FormGroup legend="Campos de demostración"><FieldText<Values> name="name" label="Nombre de capacidades" /></FormGroup>
    </FormView>
  </section>;
}
