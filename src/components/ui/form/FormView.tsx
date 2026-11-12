"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { useFormState, type FieldPath, type FieldValues } from "react-hook-form";
import { Plus, RotateCcw, Save, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import FormLayout, { type FormLayoutProps } from "./FormLayout";
import FormViewActionMenu, { type FormViewMenuAction } from "./FormViewActionMenu";
import type { FormViewContext, FormViewResult, FormViewSubmit } from "./formView.types";
import { useAlerts } from "../alerts/AlertProvider";
import { focusInvalidField, invalidFormFields } from "./notebookErrors";
import { useFormLeaveGuard, useFormNavigation } from "./FormNavigationProvider";
import Breadcrumbs, { type Breadcrumb } from "../Breadcrumbs";
import FormAuditPanel from "./FormAuditPanel";
import type { RecordAudit } from "@/lib/orm/audit";
import type { FormActivity } from "@/lib/orm/activity";
import { deleteFormRecord, formDeleteReturnHref, formDeleteTarget, FormDeletionError, type FormDeletion } from "./formDeletion";

export type { FormViewContext, FormViewResult, FormViewSubmit } from "./formView.types";
export type { FormViewMenuAction } from "./FormViewActionMenu";
export type { FormDeletion } from "./formDeletion";

type Slot<TValues extends FieldValues, TContext, TOutput> = ReactNode | ((context: FormViewContext<TValues, TContext, TOutput>) => ReactNode);
export type FormViewProps<TValues extends FieldValues, TContext = unknown, TOutput = TValues> =
  Omit<FormLayoutProps<TValues, TContext, TOutput>, "onSubmit" | "onSubmitError" | "onSubmitSettled" | "contentClassName" | "title"> & {
    title: string;
    /** Compatibility metadata; not rendered by the compact header. */
    description?: string;
    /** Compatibility metadata; not rendered by the compact header. */
    icon?: ReactNode;
    width?: "normal" | "wide";
    layout?: "content" | "page";
    breadcrumbs?: readonly Breadcrumb[];
    /** undefined hides the panel; null reserves it for an unsaved record. */
    audit?: RecordAudit | null;
    activity?: FormActivity;
    mode?: "create" | "edit";
    disabled?: boolean;
    readOnly?: boolean;
    busy?: boolean;
    headerActions?: Slot<TValues, TContext, TOutput>;
    menuActions?: readonly FormViewMenuAction[] | ((context: FormViewContext<TValues, TContext, TOutput>) => readonly FormViewMenuAction[]);
    statebar?: ReactNode;
    footer?: Slot<TValues, TContext, TOutput>;
    saveLabel?: string;
    revertLabel?: string;
    newLabel?: string;
    onNew?: () => void | Promise<void>;
    onSubmit: FormViewSubmit<TValues, TOutput>;
    onSaved?: (values: TValues, audit?: import("@/lib/orm/audit").RecordAudit, displayName?: string) => void;
    onRevert?: () => void;
    /** Explicit authorized action; hidden for unsaved or read-only records. */
    deletion?: FormDeletion;
  };

class SaveRejected extends Error {
  constructor(message: string, readonly kind: "validation" | "server" = "server", readonly details: string[] = [], readonly field?: string) { super(message); }
}
const serverErrorTypes = ["server"];

export default function FormView<TValues extends FieldValues, TContext = unknown, TOutput = TValues>({
  title, width = "normal", layout = "content", breadcrumbs, audit, activity, methods, mode = "edit", disabled = false, readOnly = false, busy: actionBusy = false,
  headerActions, menuActions, statebar, footer, saveLabel = "Guardar", revertLabel = "Revertir", newLabel = "Nuevo", onNew, onSubmit, onSaved, onRevert, deletion,
  children, id, className = "", onSubmitCapture, ...formProps
}: FormViewProps<TValues, TContext, TOutput>) {
  const generatedId = useId();
  const alerts = useAlerts();
  const router = useRouter();
  const navigation = useFormNavigation();
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const titleId = `${id ?? generatedId}-title`;
  const { isDirty, isSubmitting, errors, defaultValues } = useFormState({ control: methods.control });
  const markClean = useFormLeaveGuard(isDirty && !readOnly, methods.reset);
  const [saving, setSaving] = useState(false);
  const [startingNew, setStartingNew] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deletedHref, setDeletedHref] = useState<string | null>(null);
  const inFlight = useRef(false);
  const submitter = useRef<HTMLElement | null>(null);
  const pending = useRef<Extract<FormViewResult<TValues>, { ok: true }> | null>(null);
  const busy = actionBusy || isSubmitting || saving || startingNew || deleting || deletedHref !== null;
  const locked = disabled || busy;
  const context = { methods, isDirty, busy: locked, readOnly };
  const actions = typeof headerActions === "function" ? headerActions(context) : headerActions;
  const customActions = typeof menuActions === "function" ? menuActions(context) : menuActions;
  const savedTarget = formDeleteTarget({ id: defaultValues?.id, revision: defaultValues?.revision });
  const canDelete = Boolean(deletion && mode === "edit" && !readOnly && savedTarget);
  const hasSecondaryActions = Boolean(customActions?.length) || canDelete;
  const secondaryActions: readonly FormViewMenuAction[] = [...(customActions ?? []), ...(canDelete ? [{ id: "form-delete", label: "Eliminar", icon: <Trash2 size={16} />, danger: true, onSelect: () => { void removeRecord(); } }] : [])];
  const footerContent = typeof footer === "function" ? footer(context) : footer;
  const serverError = errors.root?.server?.message;
  const pageLayout = layout === "page";
  const hasAudit = audit !== undefined || activity !== undefined;
  const [activityVersion, setActivityVersion] = useState(0);
  // Legacy presentation metadata must not be forwarded to the HTML form.
  delete formProps.description;
  delete formProps.icon;

  async function removeRecord() {
    if (!deletion || locked || readOnly || mode !== "edit" || inFlight.current) return;
    const target = savedTarget;
    if (!target) return;
    inFlight.current = true; setDeleting(true);
    let close = () => {};
    let confirmedDeleted = false;
    try {
      const href = formDeleteReturnHref(new URLSearchParams(window.location.search).get("returnTo"), deletion.returnHref, deletion.returnPaths);
      await navigation.run(async () => {
        if (!mounted.current) throw new FormDeletionError("El formulario cambió. Abre nuevamente el registro.");
        const current = formDeleteTarget(methods.getValues());
        if (current?.id !== target.id || current?.revision !== target.revision) throw new FormDeletionError("El registro cambió. Confirma nuevamente su eliminación.", "validation");
        methods.clearErrors("root.server");
        close = alerts.loading({ title: "Eliminando…", message: "Espera mientras se elimina el registro." });
        await deleteFormRecord(target, deletion.action);
        close();
        if (!mounted.current) throw new FormDeletionError("El formulario se cerró.");
        confirmedDeleted = true;
        markClean(); navigation.discard(); setDeletedHref(href);
        toast.success("Registro eliminado.");
        router.replace(href);
      }, () => alerts.confirm({
        title: "Eliminar registro", message: "Se eliminará este registro. Esta acción no se puede deshacer. También se descartarán los cambios sin guardar de esta página.",
        confirmLabel: "Eliminar", cancelLabel: "Cancelar", danger: true,
      }));
    } catch (error) {
      close();
      if (!mounted.current) return;
      const message = confirmedDeleted ? "El registro fue eliminado. Usa el enlace para volver a la vista anterior." : error instanceof FormDeletionError ? error.message : "No se pudo confirmar la eliminación. Recarga el registro antes de volver a intentarlo.";
      methods.setError("root.server", { type: "server", message });
      await (error instanceof FormDeletionError && error.kind === "validation" ? alerts.validation : alerts.error)({ title: confirmedDeleted ? "Registro eliminado" : "No se pudo eliminar", message });
    } finally { close(); inFlight.current = false; if (mounted.current) setDeleting(false); }
  }

  return <FormLayout {...formProps} id={id} methods={methods} aria-labelledby={titleId} aria-busy={busy} silentErrorTypes={serverErrorTypes}
    className={`card w-full ${pageLayout ? "flex min-h-0 flex-1 flex-col" : `mx-auto shrink-0 ${width === "wide" ? "max-w-7xl" : "max-w-5xl"}`} rounded-2xl border border-base-300 bg-base-100 shadow-sm ${className}`} contentClassName={`flex min-w-0 flex-col ${pageLayout ? "min-h-0 flex-1" : ""}`}
    onSubmitCapture={event => {
      onSubmitCapture?.(event);
      if (event.defaultPrevented || locked || inFlight.current || readOnly || (mode === "edit" && !isDirty)) {
        event.preventDefault();
        event.stopPropagation();
      } else {
        submitter.current = (event.nativeEvent as SubmitEvent).submitter;
      }
    }}
    onSubmit={async (values, event) => {
      if (inFlight.current) return;
      inFlight.current = true; setSaving(true); pending.current = null;
      methods.clearErrors("root.server");
      try {
        const result = await onSubmit(values, event);
        if (!result || !result.ok) {
          if (result && !result.ok) for (const [name, message] of Object.entries(result.fieldErrors ?? {})) {
            if (typeof message === "string") methods.setError(name as FieldPath<TValues>, { type: "server", message });
          }
          if (result && !result.ok) {
            const fields = Object.entries(result.fieldErrors ?? {}).filter((entry): entry is [string, string] => typeof entry[1] === "string");
            throw new SaveRejected(result.error, result.kind ?? (fields.length ? "validation" : "server"), [...new Set(fields.map(([, message]) => message))], fields[0]?.[0]);
          }
          throw new SaveRejected("No se pudo confirmar el guardado.");
        }
        if (!result.values || typeof result.values !== "object" || Array.isArray(result.values)) throw new SaveRejected("No se pudo confirmar el guardado.");
        pending.current = result;
      } finally { inFlight.current = false; setSaving(false); }
    }}
    onSubmitError={error => {
      pending.current = null;
      const message = error instanceof SaveRejected ? error.message : "No se pudo guardar. Revisa tu conexión e intenta nuevamente.";
      methods.setError("root.server", { type: "server", message });
      const present = error instanceof SaveRejected && error.kind === "validation" ? alerts.validation : alerts.error;
      void present({ title: error instanceof SaveRejected && error.kind === "validation" ? "Error de validación" : "No se pudo guardar", message, details: error instanceof SaveRejected ? error.details : undefined }).then(() => {
        if (!mounted.current) return;
        if (error instanceof SaveRejected && error.field) {
          const form = document.getElementById(titleId)?.closest("form");
          const first = form && invalidFormFields(form, methods.getErrors())[0];
          if (first) focusInvalidField(first, name => methods.setFocus(name as FieldPath<TValues>));
          else methods.setFocus(error.field as FieldPath<TValues>);
        }
        else if (submitter.current?.isConnected && !submitter.current.matches(":disabled")) submitter.current.focus();
      });
    }}
    onSubmitSettled={() => {
      const saved = pending.current;
      pending.current = null;
      if (!saved) return;
      // handleSubmit has finished; reset can now establish a reliable saved baseline.
      methods.reset(saved.values);
      markClean();
      setActivityVersion(version => version + 1);
      toast.success(saved.message ?? "Cambios guardados.");
      onSaved?.(saved.values, saved.audit, saved.displayName);
    }}>
    <h2 id={titleId} className="sr-only">{title}</h2>
    <header data-slot="header" className="shrink-0 space-y-3 rounded-t-2xl border-b border-base-300 bg-linear-to-r from-primary/5 to-transparent px-4 py-3 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {!!breadcrumbs?.length && <div className="min-w-0 flex-1 basis-48"><Breadcrumbs items={breadcrumbs} /></div>}
        {(!readOnly || onNew || hasSecondaryActions) && <fieldset disabled={locked} className="m-0 ml-auto flex min-w-0 flex-wrap items-center gap-1 border-0 p-0 sm:gap-2">
          {onNew && <button type="button" disabled={locked} className="btn btn-soft btn-primary btn-sm gap-1.5" onClick={async () => {
            if (locked) return;
            setStartingNew(true);
            try { await navigation.run(onNew); }
            catch { await alerts.error({ title: "No se pudo iniciar el registro", message: "Intenta nuevamente. Tus cambios no se han guardado." }); }
            finally { if (mounted.current) setStartingNew(false); }
          }}>{startingNew ? <span className="loading loading-spinner loading-xs" aria-hidden="true" /> : <Plus size={15} aria-hidden="true" />}{newLabel}</button>}
          {!readOnly && <>
          <button type="submit" disabled={locked || (mode === "edit" && !isDirty)} className="btn btn-primary btn-sm gap-2">{saving || isSubmitting ? <span className="loading loading-spinner loading-xs" aria-hidden="true" /> : <Save size={15} aria-hidden="true" />}{saving || isSubmitting ? "Guardando…" : saveLabel}</button>
          <button type="button" disabled={locked || !isDirty} className="btn btn-ghost btn-sm gap-1.5 px-2" onClick={() => { methods.reset(); markClean(); onRevert?.(); }}><RotateCcw size={15} aria-hidden="true" />{revertLabel}</button>
          </>}
          {hasSecondaryActions && <FormViewActionMenu actions={secondaryActions} disabled={locked} />}
        </fieldset>}
      </div>
      {(actions || statebar) && <div className="flex min-w-0 flex-wrap items-center justify-between gap-3 border-t border-base-300/70 pt-4">
        {actions && <fieldset disabled={locked} className="m-0 flex min-w-0 flex-wrap items-center gap-2 border-0 p-0">{actions}</fieldset>}
        {statebar && <fieldset disabled={locked || readOnly} className="m-0 ml-auto min-w-0 max-w-full border-0 p-0">{statebar}</fieldset>}
      </div>}
    </header>
    <div data-slot="body" className={`min-w-0 ${pageLayout ? `min-h-0 flex-1 overflow-y-auto ${hasAudit ? "@4xl/form:overflow-hidden" : ""}` : ""}`}>
      <div className={`grid min-w-0 grid-cols-1 items-stretch ${pageLayout ? "min-h-full" : ""} ${hasAudit ? `${activity ? "@4xl/form:grid-cols-[minmax(0,1fr)_24rem]" : "@4xl/form:grid-cols-[minmax(0,1fr)_18rem]"} ${pageLayout ? "@4xl/form:h-full" : ""}` : ""}`}>
        <div className={`min-w-0 p-2 sm:p-3 ${pageLayout && hasAudit ? "@4xl/form:min-h-0 @4xl/form:overflow-y-auto" : ""}`}><div className={`@container/form w-full min-w-0 ${pageLayout ? "" : width === "wide" ? "max-w-7xl" : "max-w-5xl"}`}>
          <fieldset disabled={locked || readOnly} className="m-0 min-w-0 border-0 p-0"><div className="grid min-w-0 grid-cols-1 items-start gap-2 @2xl/form:grid-cols-2">{children}</div></fieldset>
        </div></div>
        {hasAudit && <FormAuditPanel audit={audit} creating={mode === "create"} activity={activity} refreshToken={activityVersion} readOnly={readOnly || locked} />}
      </div>
    </div>
    <footer data-slot="footer" className="shrink-0 space-y-3 rounded-b-2xl border-t border-base-300 bg-base-200/20 px-4 py-3 sm:px-6">
      <p role="status" className="text-xs text-base-content/60">{deletedHref ? "Registro eliminado" : deleting ? "Eliminando registro…" : busy ? saving || isSubmitting ? "Guardando cambios…" : "Procesando acción…" : readOnly ? "Formulario de solo lectura" : isDirty ? "Tienes cambios sin guardar" : "Sin cambios pendientes"}</p>
      {deletedHref && <button type="button" className="btn btn-link btn-sm px-0" onClick={() => { void navigation.run(() => router.replace(deletedHref)); }}>Volver a la vista anterior</button>}
      {typeof serverError === "string" && <p role="alert" className="text-sm text-error">{serverError}</p>}
      {footerContent && <div className="border-t border-base-300 pt-3">{footerContent}</div>}
    </footer>
  </FormLayout>;
}
