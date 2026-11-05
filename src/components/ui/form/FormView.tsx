"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { useFormState, type FieldPath, type FieldValues } from "react-hook-form";
import { FilePenLine, Plus, RotateCcw, Save } from "lucide-react";
import toast from "react-hot-toast";
import FormLayout, { type FormLayoutProps } from "./FormLayout";
import FormViewActionMenu, { type FormViewMenuAction } from "./FormViewActionMenu";
import type { FormViewContext, FormViewResult, FormViewSubmit } from "./formView.types";
import { useAlerts } from "../alerts/AlertProvider";
import { focusInvalidField, invalidFormFields } from "./notebookErrors";
import { useFormLeaveGuard, useFormNavigation } from "./FormNavigationProvider";

export type { FormViewContext, FormViewResult, FormViewSubmit } from "./formView.types";
export type { FormViewMenuAction } from "./FormViewActionMenu";

type Slot<TValues extends FieldValues, TContext, TOutput> = ReactNode | ((context: FormViewContext<TValues, TContext, TOutput>) => ReactNode);
export type FormViewProps<TValues extends FieldValues, TContext = unknown, TOutput = TValues> =
  Omit<FormLayoutProps<TValues, TContext, TOutput>, "onSubmit" | "onSubmitError" | "onSubmitSettled" | "contentClassName" | "title"> & {
    title: string;
    description?: string;
    icon?: ReactNode;
    width?: "normal" | "wide";
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
    onSaved?: (values: TValues) => void;
    onRevert?: () => void;
  };

class SaveRejected extends Error {
  constructor(message: string, readonly kind: "validation" | "server" = "server", readonly details: string[] = [], readonly field?: string) { super(message); }
}
const serverErrorTypes = ["server"];

export default function FormView<TValues extends FieldValues, TContext = unknown, TOutput = TValues>({
  title, description, icon, width = "normal", methods, mode = "edit", disabled = false, readOnly = false, busy: actionBusy = false,
  headerActions, menuActions, statebar, footer, saveLabel = "Guardar", revertLabel = "Revertir", newLabel = "Nuevo", onNew, onSubmit, onSaved, onRevert,
  children, id, className = "", onSubmitCapture, ...formProps
}: FormViewProps<TValues, TContext, TOutput>) {
  const generatedId = useId();
  const alerts = useAlerts();
  const navigation = useFormNavigation();
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const titleId = `${id ?? generatedId}-title`;
  const { isDirty, isSubmitting, errors } = useFormState({ control: methods.control });
  const markClean = useFormLeaveGuard(isDirty && !readOnly, methods.reset);
  const [saving, setSaving] = useState(false);
  const [startingNew, setStartingNew] = useState(false);
  const inFlight = useRef(false);
  const submitter = useRef<HTMLElement | null>(null);
  const pending = useRef<Extract<FormViewResult<TValues>, { ok: true }> | null>(null);
  const busy = actionBusy || isSubmitting || saving || startingNew;
  const locked = disabled || busy;
  const context = { methods, isDirty, busy: locked, readOnly };
  const actions = typeof headerActions === "function" ? headerActions(context) : headerActions;
  const secondaryActions = typeof menuActions === "function" ? menuActions(context) : menuActions;
  const footerContent = typeof footer === "function" ? footer(context) : footer;
  const serverError = errors.root?.server?.message;

  return <FormLayout {...formProps} id={id} methods={methods} aria-labelledby={titleId} aria-busy={busy} silentErrorTypes={serverErrorTypes}
    className={`card mx-auto w-full shrink-0 ${width === "wide" ? "max-w-7xl" : "max-w-5xl"} rounded-2xl border border-base-300 bg-base-100 shadow-sm ${className}`} contentClassName="flex min-w-0 flex-col"
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
      toast.success(saved.message ?? "Cambios guardados.");
      onSaved?.(saved.values);
    }}>
    <header data-slot="header" className="space-y-4 rounded-t-2xl border-b border-base-300 bg-linear-to-r from-primary/5 to-transparent px-4 py-5 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3"><span aria-hidden="true" className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">{icon ?? <FilePenLine size={22} />}</span><div className="min-w-0 space-y-1"><div className="flex flex-wrap items-center gap-2"><h2 id={titleId} className="text-xl font-semibold tracking-tight wrap-anywhere sm:text-2xl">{title}</h2><span className={`badge badge-sm ${isDirty ? "badge-soft badge-warning" : "badge-ghost"}`}>{readOnly ? "Solo lectura" : isDirty ? "Con cambios" : mode === "create" ? "Nuevo" : "Sin cambios"}</span></div>{description && <p className="max-w-2xl text-sm leading-relaxed text-base-content/60">{description}</p>}</div></div>
        {(!readOnly || onNew || Boolean(secondaryActions?.length)) && <fieldset disabled={locked} className="m-0 flex w-full min-w-0 flex-wrap items-center gap-1 border-0 p-0 sm:w-auto sm:gap-2">
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
          {Boolean(secondaryActions?.length) && <FormViewActionMenu actions={secondaryActions!} disabled={locked} />}
        </fieldset>}
      </div>
      {(actions || statebar) && <div className="flex min-w-0 flex-wrap items-center justify-between gap-3 border-t border-base-300/70 pt-4">
        {actions && <fieldset disabled={locked} className="m-0 flex min-w-0 flex-wrap items-center gap-2 border-0 p-0">{actions}</fieldset>}
        {statebar && <fieldset disabled={locked || readOnly} className="m-0 ml-auto min-w-0 max-w-full border-0 p-0">{statebar}</fieldset>}
      </div>}
    </header>
    <div data-slot="body" className="min-w-0 p-4 sm:p-6"><fieldset disabled={locked || readOnly} className="m-0 min-w-0 border-0 p-0"><div className="grid min-w-0 grid-cols-1 items-start gap-4 @2xl/form:grid-cols-2">{children}</div></fieldset></div>
    <footer data-slot="footer" className="space-y-3 rounded-b-2xl border-t border-base-300 bg-base-200/20 px-4 py-3 sm:px-6">
      <p role="status" className="text-xs text-base-content/60">{busy ? saving || isSubmitting ? "Guardando cambios…" : "Procesando acción…" : readOnly ? "Formulario de solo lectura" : isDirty ? "Tienes cambios sin guardar" : "Sin cambios pendientes"}</p>
      {typeof serverError === "string" && <p role="alert" className="text-sm text-error">{serverError}</p>}
      {footerContent && <div className="border-t border-base-300 pt-3">{footerContent}</div>}
    </footer>
  </FormLayout>;
}
