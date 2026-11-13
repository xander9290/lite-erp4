"use client";

import { useCallback, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { RefreshCw } from "lucide-react";
import FormView from "@/components/ui/form/FormView";
import FormViewLoader from "@/components/ui/form/FormViewLoader";
import FormGroup from "@/components/ui/form/FormGroup";
import FieldText from "@/components/ui/form/FieldText";
import FieldBoolean from "@/components/ui/form/FieldBoolean";
import FieldNumber from "@/components/ui/form/FieldNumber";
import FieldDate from "@/components/ui/form/FieldDate";
import FieldSelect from "@/components/ui/form/FieldSelect";
import FieldImage from "@/components/ui/form/FieldImage";
import FieldMany2One from "@/components/ui/form/FieldMany2One";
import { useFormNavigation } from "@/components/ui/form/FormNavigationProvider";
import { useAlerts } from "@/components/ui/alerts/AlertProvider";
import { buildModelUI, type ModelUI } from "@/lib/modules/client";
import type { ModelClientConfig } from "@/lib/modules/config";
import { modelActivity, modelDelete, modelNote, modelRead, modelSave } from "@/lib/modules/actions";

type Values = Record<string, unknown>;

/** Controls derived from metadata, used when a view does not provide its own layout. */
export function ModelFields({ ui }: { ui: ModelUI }) {
  const controls = Object.entries(ui.config.fields).map(([name, field]) => {
    switch (field.kind) {
      case "image": return <FieldImage<Values> key={name} name={name} widget="avatar" />;
      case "boolean": return <FieldBoolean<Values> key={name} name={name} direction="inline" />;
      case "integer": return <FieldNumber<Values> key={name} name={name} type="integer" direction="inline" />;
      case "datetime": return <FieldDate<Values> key={name} name={name} type="datetime" direction="inline" />;
      case "selection": return <FieldSelect<Values> key={name} name={name} direction="inline" />;
      case "many2one": return Object.hasOwn(ui.config.lookups, name) ? <FieldMany2One<Values> key={name} name={name} direction="inline" /> : null;
      default: return <FieldText<Values> key={name} name={name} direction="inline" />;
    }
  });
  const display = Object.entries(ui.config.preview).map(([name, field]) =>
    field.kind === "image" ? <FieldImage key={name} mode="display" name={name} direction="inline" />
      : field.kind === "integer" ? <FieldNumber key={name} mode="display" name={name} type="integer" direction="inline" />
      : field.kind === "text" ? <FieldText key={name} mode="display" name={name} direction="inline" /> : null);
  return <FormGroup legend="Datos generales">{controls}{display}</FormGroup>;
}

function Editor({ ui, record, displayName, onReload, children }: { ui: ModelUI; record: Values; displayName?: string; onReload?: () => void; children?: ReactNode }) {
  const router = useRouter();
  const { config } = ui;
  const [savedId, setSavedId] = useState(record.id as string | undefined);
  const [savedName, setSavedName] = useState(displayName);
  const methods = useForm<Values>({ resolver: zodResolver(ui.schema as never), defaultValues: record });
  return <FormView
    layout="page"
    breadcrumbs={[{ label: "Aplicaciones", href: "/erp" }, { label: config.label, href: config.route }, { label: savedId ? savedName || "Registro" : "Nuevo registro" }]}
    title={savedId ? "Editar registro" : "Nuevo registro"}
    methods={methods}
    model={ui.recordUI as never}
    activity={{ recordId: savedId, load: request => modelActivity(config.id, request), addNote: request => modelNote(config.id, request) }}
    mode={savedId ? "edit" : "create"}
    onSubmit={values => modelSave(config.id, values)}
    deletion={{ action: selection => modelDelete(config.id, selection), returnHref: config.route }}
    onNew={savedId ? () => router.push(`${config.route}/nuevo`) : undefined}
    onSaved={(values, _audit, name) => {
      setSavedId(values.id as string);
      setSavedName(name);
      if (!record.id && values.id) router.replace(`${config.route}/${encodeURIComponent(values.id as string)}`);
      router.refresh();
    }}
    menuActions={onReload ? [{ id: "reload", label: "Recargar registro", icon: <RefreshCw size={16} />, onSelect: onReload }] : undefined}
    footer={<p className="text-xs text-base-content/55">Los cambios se guardan al presionar Guardar.</p>}
  >
    {children ?? <ModelFields ui={ui} />}
  </FormView>;
}

/**
 * Form wiring shared by every module model: loader, reload guard, routing, breadcrumbs,
 * activity and deletion. Custom views pass only their field layout as children.
 */
export default function ModelForm({ config, id, children }: { config: ModelClientConfig; id?: string; children?: ReactNode }) {
  const ui = useMemo(() => buildModelUI(config), [config]);
  const router = useRouter();
  const navigation = useFormNavigation();
  const alerts = useAlerts();
  const [attempt, setAttempt] = useState(0);
  const load = useCallback(() => modelRead(config.id, id!), [config.id, id]);
  const reload = () => {
    void navigation.run(() => setAttempt(value => value + 1)).catch(() => {
      void alerts.error({ title: "No se pudo recargar el registro", message: "Intenta nuevamente. Tus cambios siguen en el formulario." });
    });
  };
  if (!id) return <Editor key={router.bfcacheId} ui={ui} record={ui.createDefaults()}>{children}</Editor>;
  return <FormViewLoader key={`${router.bfcacheId}:${id}:${attempt}`} recordKey={id} load={load}>
    {(record, _audit, displayName) => <Editor ui={ui} record={record} displayName={displayName} onReload={reload}>{children}</Editor>}
  </FormViewLoader>;
}
