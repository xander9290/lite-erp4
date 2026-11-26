"use client";

import ActionParametersDialog from "./ActionParametersDialog";
import type { ClientModelAction } from "@/lib/orm/action-parameters";
import FormPendingStatus from "./FormPendingStatus";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { useFormState, type FieldPath, type FieldValues } from "react-hook-form";
import { ChevronLeft, ChevronRight, Plus, RotateCcw, Save, Trash2 } from "lucide-react";
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
import { FormActionsContext, type FormActionRunner } from "./formActions";

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
    /**
     * «3 / 12» with previous/next buttons (e.g. the records of the list page the form came from).
     * Each move runs through the unsaved-changes guard. A missing callback disables that arrow.
     */
    pager?: FormViewPager;
    onSubmit: FormViewSubmit<TValues, TOutput>;
    onSaved?: (values: TValues, audit?: import("@/lib/orm/audit").RecordAudit, displayName?: string) => void;
    onRevert?: () => void;
    /** Explicit authorized action; hidden for unsaved or read-only records. */
    deletion?: FormDeletion;
    /** Executes named business actions for FormButton (e.g. ModelForm → modelAction). */
    runAction?: FormActionRunner<TValues>;
    /** Contract name used to scope typed FormButton references. ModelForm supplies it. */
    actionModel?: string;
    /** Published action labels, so FormButton can default its text. */
    actions?: readonly ClientModelAction[];
  };

export type FormViewPager = {
  readonly position: number;
  readonly total: number;
  readonly onPrevious?: () => void | Promise<void>;
  readonly onNext?: () => void | Promise<void>;
};

class SaveRejected extends Error {
  constructor(message: string, readonly kind: "validation" | "server" = "server", readonly details: string[] = [], readonly field?: string) { super(message); }
}
const serverErrorTypes = ["server"];

export default function FormView<TValues extends FieldValues, TContext = unknown, TOutput = TValues>({
  title, width = "normal", layout = "content", breadcrumbs, audit, activity, methods, mode = "edit", disabled = false, readOnly = false, busy: actionBusy = false,
  headerActions, menuActions, statebar, footer, saveLabel = "Guardar", revertLabel = "Revertir", newLabel = "Nuevo", onNew, pager, onSubmit, onSaved, onRevert, deletion, runAction, actions: publishedActions,
  children, id, className = "", onSubmitCapture, actionModel, ...formProps
}: FormViewProps<TValues, TContext, TOutput>) {
  const generatedId = useId();
  const alerts = useAlerts();
  const router = useRouter();
  const navigation = useFormNavigation();
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const titleId = `${id ?? generatedId}-title`;
  const { isDirty, isSubmitting, errors, defaultValues } = useFormState({ control: methods.control });
  const markClean = useFormLeaveGuard(isDirty, methods.reset);
  const [saving, setSaving] = useState(false);
  const [startingNew, setStartingNew] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deletedHref, setDeletedHref] = useState<string | null>(null);
  const [acting, setActing] = useState<string | null>(null);
  const [confirmingAction, setConfirmingAction] = useState(false);
  const actionLock = useRef(false);
  const actionRuntime = useRef({ disabled, actionBusy, readOnly, actionModel, publishedActions, runAction, isDirty });
  useEffect(() => {
    actionRuntime.current = { disabled, actionBusy, readOnly, actionModel, publishedActions, runAction, isDirty };
  }, [disabled, actionBusy, readOnly, actionModel, publishedActions, runAction, isDirty]);
  const [parameterAction, setParameterAction] = useState<{ action: ClientModelAction; values?: Record<string, unknown>; errors?: Record<string, string> } | null>(null);
  const parameterWaiter = useRef<((values: Record<string, unknown> | null) => void) | null>(null);
  const parameterDrafts = useRef(new Map<string, Record<string, unknown>>());
  const parameterErrors = useRef(new Map<string, Record<string, string>>());
  useEffect(() => () => { parameterWaiter.current?.(null); parameterWaiter.current = null; }, []);
  const finishParameters = (values: Record<string, unknown> | null) => {
    const finish = parameterWaiter.current;
    parameterWaiter.current = null;
    setParameterAction(null);
    finish?.(values);
  };
  const [headerSlot, setHeaderSlot] = useState<HTMLDivElement | null>(null);
  // Save → action coordination: the action's own submit bypasses the lock it holds.
  const actionSubmit = useRef(false);
  const saveWaiter = useRef<((saved: Extract<FormViewResult<TValues>, { ok: true }> | null) => void) | null>(null);
  const inFlight = useRef(false);
  const submitter = useRef<HTMLElement | null>(null);
  const pending = useRef<Extract<FormViewResult<TValues>, { ok: true }> | null>(null);
  const busy = actionBusy || isSubmitting || saving || startingNew || deleting || deletedHref !== null || acting !== null;
  const locked = disabled || busy;
  const context = { methods, isDirty, busy: locked, readOnly };
  const actions = typeof headerActions === "function" ? headerActions(context) : headerActions;
  const customActions = typeof menuActions === "function" ? menuActions(context) : menuActions;
  const savedTarget = formDeleteTarget({ id: defaultValues?.id, revision: defaultValues?.revision });
  const canDelete = Boolean(deletion && mode === "edit" && (!readOnly || deletion.allowReadOnly) && savedTarget);
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
    if (!deletion || locked || (readOnly && !deletion.allowReadOnly) || mode !== "edit" || inFlight.current) return;
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

  /**
   * FormButton sequence: one lock from optional confirmation through parameters and action;
   * validate/save through the normal submit when the record
   * is new or dirty (no second pipeline); only after success run the action with the saved
   * ID/revision. A failed save stops; a failed action keeps the saved record and revision.
   */
  async function runFormAction(name: string, confirmation?: string): Promise<boolean> {
    if (publishedActions && !publishedActions.some(item => item.name === name)) return false;
    // Synchronous lock: two clicks in the same frame must not both pass before `acting` renders.
    if (!runAction || locked || readOnly || inFlight.current || saveWaiter.current || actionLock.current) return false;
    actionLock.current = true;
    setActing(name);
    let saved: Extract<FormViewResult<TValues>, { ok: true }> | null = null;
    let mutationStarted = false;
    const initial = methods.getValues();
    const initialId = initial.id;
    const initialRevision = initial.revision;
    const available = () => {
      const current = actionRuntime.current;
      return mounted.current && !current.disabled && !current.actionBusy && !current.readOnly && current.actionModel === actionModel && Boolean(current.runAction)
        && (current.publishedActions ? current.publishedActions.some(action => action.name === name) : !publishedActions);
    };
    const sameRecord = () => {
      const current = methods.getValues();
      return current.id === initialId && current.revision === initialRevision;
    };
    try {
      if (confirmation?.trim()) {
        setConfirmingAction(true);
        const accepted = await alerts.confirm({ title: "Confirmar acción", message: confirmation, confirmLabel: "Continuar", cancelLabel: "Cancelar" });
        if (mounted.current) setConfirmingAction(false);
        if (!accepted) return false;
      }
      if (!available() || !sameRecord()) return false;
      const declared = actionRuntime.current.publishedActions?.find(action => action.name === name);
      const params = declared?.params ? await new Promise<Record<string, unknown> | null>(resolve => { parameterWaiter.current = resolve; setParameterAction({ action: declared, values: parameterDrafts.current.get(name), errors: parameterErrors.current.get(name) }); }) : undefined;
      if (params === null || !available() || !sameRecord()) return false;
      if (params !== undefined) parameterDrafts.current.set(name, params);
      parameterErrors.current.delete(name);
      let target = mode === "edit" && !actionRuntime.current.isDirty ? formDeleteTarget(methods.getValues()) : null;
      if (!target) {
        const form = document.getElementById(titleId)?.closest("form");
        if (!form) return false;
        saved = await new Promise(resolve => {
          saveWaiter.current = resolve;
          actionSubmit.current = true;
          mutationStarted = true;
          try { form.requestSubmit(); } finally { actionSubmit.current = false; }
        });
        if (!saved) return false;
        target = formDeleteTarget({ id: saved.values.id, revision: saved.values.revision });
        if (!target) return false;
      }
      if (!available()) {
        if (saved && mounted.current) onSaved?.(saved.values, saved.audit, saved.displayName);
        return false;
      }
      methods.clearErrors("root.server");
      mutationStarted = true;
      const outcome = await actionRuntime.current.runAction!(name, target, params);
      if (!mounted.current) return false;
      if (!outcome.ok) {
        if (outcome.parameterErrors) parameterErrors.current.set(name, outcome.parameterErrors);
        for (const [field, message] of Object.entries(outcome.fieldErrors ?? {})) if (typeof message === "string") methods.setError(field as FieldPath<TValues>, { type: "server", message });
        methods.setError("root.server", { type: "server", message: outcome.error });
        const details = [...new Set([...Object.values(outcome.fieldErrors ?? {}), ...Object.values(outcome.parameterErrors ?? {})].filter((message): message is string => typeof message === "string"))];
        await (outcome.kind === "validation" ? alerts.validation : alerts.error)({ title: "No se pudo completar la acción", message: outcome.error, details });
        if (saved) onSaved?.(saved.values, saved.audit, saved.displayName);
        return false;
      }
      parameterDrafts.current.delete(name);
      parameterErrors.current.delete(name);
      methods.reset(outcome.values);
      markClean();
      setActivityVersion(version => version + 1);
      toast.success(outcome.message ?? "Acción completada.");
      onSaved?.(outcome.values, outcome.audit, outcome.displayName);
      return true;
    } catch {
      if (!mutationStarted) {
        if (mounted.current) await alerts.error({ title: "No se pudo iniciar la acción", message: "Intenta nuevamente. Tus cambios siguen en el formulario." });
        return false;
      }
      // Unknown network outcome: never present success nor retry a mutation automatically.
      if (mounted.current) {
        methods.setError("root.server", { type: "server", message: "No se pudo confirmar la acción. Recarga el registro antes de reintentar." });
        if (saved) onSaved?.(saved.values, saved.audit, saved.displayName);
        await alerts.error({ title: "No se pudo confirmar la acción", message: "Recarga el registro para comprobar su estado antes de reintentar." });
      }
      return false;
    } finally {
      saveWaiter.current = null;
      actionLock.current = false;
      if (mounted.current) { setActing(null); setConfirmingAction(false); }
    }
  }

  return <FormActionsContext.Provider value={{ model: actionModel, header: headerSlot, locked, readOnly, actions: publishedActions, run: runAction ? runFormAction : null, running: acting }}>
  <FormLayout {...formProps} id={id} methods={methods} aria-labelledby={titleId} aria-busy={busy} silentErrorTypes={serverErrorTypes}
    className={`card w-full ${pageLayout ? "flex min-h-0 flex-1 flex-col" : `mx-auto shrink-0 ${width === "wide" ? "max-w-7xl" : "max-w-5xl"}`} rounded-2xl border border-base-300 bg-base-100 shadow-sm ${className}`} contentClassName={`flex min-w-0 flex-col ${pageLayout ? "min-h-0 flex-1" : ""}`}
    onSubmitCapture={event => {
      if (event.target !== event.currentTarget) return;
      onSubmitCapture?.(event);
      if (actionSubmit.current && !event.defaultPrevented) { submitter.current = null; return; }
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
          // Disabled or group-hidden Notebook pages cannot be revealed: skip their fields.
          const first = form && invalidFormFields(form, methods.getErrors()).find(element => !element.closest('[data-notebook-disabled="true"]'));
          if (first) focusInvalidField(first, name => methods.setFocus(name as FieldPath<TValues>));
          else methods.setFocus(error.field as FieldPath<TValues>);
        }
        else if (submitter.current?.isConnected && !submitter.current.matches(":disabled")) submitter.current.focus();
      });
    }}
    onSubmitSettled={() => {
      const saved = pending.current;
      pending.current = null;
      // A FormButton is waiting: it receives the outcome and calls onSaved after its action.
      const waiter = saveWaiter.current;
      saveWaiter.current = null;
      if (!saved) { waiter?.(null); return; }
      if (waiter) {
        methods.reset(saved.values);
        markClean();
        setActivityVersion(version => version + 1);
        waiter(saved);
        return;
      }
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
        {busy && !deletedHref && <FormPendingStatus announce={false}>{saving || isSubmitting ? "Guardando cambios…" : deleting ? "Eliminando registro…" : acting ? confirmingAction ? "Esperando confirmación…" : parameterAction ? "Esperando parámetros…" : "Ejecutando acción…" : "Procesando…"}</FormPendingStatus>}
        {!!breadcrumbs?.length && <div className="min-w-0 flex-1 basis-48"><Breadcrumbs items={breadcrumbs} /></div>}
        {pager && <nav aria-label="Navegar entre registros" className="ml-auto flex shrink-0 items-center gap-1">
          <span className="px-1 text-sm tabular-nums text-base-content/60" aria-live="polite">{pager.position} / {pager.total}</span>
          <button type="button" className="btn btn-ghost btn-sm btn-square" aria-label="Registro anterior" title="Registro anterior" disabled={locked || !pager.onPrevious} onClick={() => { if (pager.onPrevious) void navigation.run(pager.onPrevious).catch(() => undefined); }}><ChevronLeft size={17} aria-hidden="true" /></button>
          <button type="button" className="btn btn-ghost btn-sm btn-square" aria-label="Registro siguiente" title="Registro siguiente" disabled={locked || !pager.onNext} onClick={() => { if (pager.onNext) void navigation.run(pager.onNext).catch(() => undefined); }}><ChevronRight size={17} aria-hidden="true" /></button>
        </nav>}
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
      {/* FormHeader portal target: hidden while empty. */}
      <div ref={setHeaderSlot} className="flex min-w-0 flex-wrap items-center gap-2 border-t border-base-300/70 pt-2 empty:hidden" />
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
      <p role="status" className="text-xs text-base-content/60">{deletedHref ? "Registro eliminado" : deleting ? "Eliminando registro…" : busy ? acting && !(saving || isSubmitting) ? "Ejecutando acción…" : saving || isSubmitting ? "Guardando cambios…" : "Procesando acción…" : readOnly ? "Formulario de solo lectura" : isDirty ? "Tienes cambios sin guardar" : "Sin cambios pendientes"}</p>
      {deletedHref && <button type="button" className="btn btn-link btn-sm px-0" onClick={() => { void navigation.run(() => router.replace(deletedHref)); }}>Volver a la vista anterior</button>}
      {typeof serverError === "string" && <p role="alert" className="text-sm text-error">{serverError}</p>}
      {footerContent && <div className="border-t border-base-300 pt-3">{footerContent}</div>}
    </footer>
  </FormLayout>
  {parameterAction && <ActionParametersDialog key={parameterAction.action.name} action={parameterAction.action} initialValues={parameterAction.values} errors={parameterAction.errors} onConfirm={finishParameters} onCancel={() => finishParameters(null)} />}
  </FormActionsContext.Provider>;
}
