"use client";

import { createContext, useContext, type ButtonHTMLAttributes, type ReactNode } from "react";
import { createPortal } from "react-dom";
import type { FieldValues } from "react-hook-form";
import type { FormViewResult } from "./formView.types";
import { actionReferenceName, type ModelActionReference } from "@/lib/orm/action-reference";

/** Saved identity the action runs on: always the revision persisted by the form cycle. */
export type FormActionTarget = { id: string; revision: string };
/** Server execution of a named, published action (e.g. `modelAction(model, {action, id, revision})`). */
export type FormActionRunner<TValues extends FieldValues = FieldValues> = (action: string, target: FormActionTarget, params?: Record<string, unknown>) => Promise<FormViewResult<TValues>>;

type FormActionsContextValue = {
  /** Model contract name (config.name for declarative forms). */
  model?: string;
  /** Header slot rendered by FormView (portal target for FormHeader). */
  header: HTMLElement | null;
  locked: boolean;
  readOnly: boolean;
  /** Labels of the actions the server publishes for this form, when known. */
  actions?: readonly import("@/lib/orm/action-parameters").ClientModelAction[];
  /** Runs save (if new/dirty) and then the action, under one lock. Resolves true on success. */
  run: ((action: string) => Promise<boolean>) | null;
  /** Which action is running, for its spinner. */
  running: string | null;
};
export const FormActionsContext = createContext<FormActionsContextValue | null>(null);

function useFormActions(component: string) {
  const context = useContext(FormActionsContext);
  if (!context) throw new Error(`${component} se usa dentro de FormView o ModelForm.`);
  return context;
}

/**
 * Puts buttons and the state field in the form header, inside the same RHF context.
 * Children can use useFormContext/useWatch and decide their own visibility.
 */
export function FormHeader({ children }: { children: ReactNode }) {
  const { header, locked, readOnly } = useFormActions("FormHeader");
  return header ? createPortal(<fieldset disabled={locked || readOnly} className="m-0 flex min-w-0 max-w-full flex-1 flex-wrap items-center justify-between gap-2 border-0 p-0 [&_[data-form-widget=statebar]]:ml-auto [&_[data-form-widget=statebar]]:w-auto [&_[data-form-widget=statebar]]:max-w-full">{children}</fieldset>, header) : null;
}

export type FormButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "type" | "onClick" | "children"> & {
  /** Generated reference to a published action; the server still authorizes every call. */
  action: ModelActionReference;
  /** Defaults to the published label. */
  children?: ReactNode;
  variant?: "primary" | "secondary";
  /** Hide without unmounting state; use React conditions for business visibility. */
  invisible?: boolean;
};

/**
 * Collects declared parameters first (cancel does not save), then validates and saves
 * the form (only if new or modified); on success, runs the
 * named action with the saved ID/revision. One lock covers both phases; a failed save
 * never runs the action, and a failed action keeps what was already saved.
 */
export function FormButton({ action, children, variant = "primary", invisible = false, disabled, className = "", ...props }: FormButtonProps) {
  const { model, locked, readOnly, actions, run, running } = useFormActions("FormButton");
  const name = actionReferenceName(action, model);
  const published = name ? actions?.find(item => item.name === name) : undefined;
  if (invisible || readOnly || !run || !published || !name) return null;
  const label = children ?? published.label;
  return <button {...props} type="button" disabled={disabled || locked}
    className={`btn btn-sm ${variant === "primary" ? "btn-primary" : "btn-soft"} gap-1.5 ${className}`}
    onClick={() => { void run(name); }}>
    {running === name && <span className="loading loading-spinner loading-xs" aria-hidden="true" />}
    {label}
  </button>;
}
