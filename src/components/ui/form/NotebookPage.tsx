"use client";

import { useContext, useEffect, useRef, type ReactNode } from "react";
import { useFormContext } from "react-hook-form";
import { NotebookContext, notebookPageId, notebookTabId } from "./notebookContext";
import { invalidFormFields, revealNotebookFieldEvent } from "./notebookErrors";

export type NotebookPageProps = {
  name: string;
  label: string;
  icon?: ReactNode;
  badge?: ReactNode;
  disabled?: boolean;
  children: ReactNode;
  className?: string;
};

export default function NotebookPage({ name, disabled = false, children, className = "" }: NotebookPageProps) {
  const notebook = useContext(NotebookContext);
  const { subscribe, getErrors } = useFormContext();
  const panel = useRef<HTMLDivElement>(null);
  if (!notebook) throw new Error("NotebookPage debe estar dentro de Notebook.");
  const { id, active, activate, reportErrors } = notebook;

  useEffect(() => {
    const element = panel.current;
    if (!element) return;
    const sync = () => reportErrors(name, invalidFormFields(element, getErrors()).length);
    const reveal = () => { if (!disabled) activate(name); };
    element.addEventListener(revealNotebookFieldEvent, reveal);
    const unsubscribe = subscribe({ formState: { errors: true }, callback: sync });
    const observer = new MutationObserver(sync);
    observer.observe(element, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-form-field"] });
    sync();
    return () => { unsubscribe(); observer.disconnect(); element.removeEventListener(revealNotebookFieldEvent, reveal); };
  }, [name, disabled, activate, reportErrors, subscribe, getErrors]);

  return <div ref={panel} id={notebookPageId(id, name)} role="tabpanel" aria-labelledby={notebookTabId(id, name)}
    data-notebook-panel={name} data-notebook-disabled={disabled || undefined} hidden={active !== name} inert={active !== name}
    tabIndex={0} className={`min-w-0 rounded-b-xl outline-offset-4 focus-visible:outline-2 focus-visible:outline-primary ${active !== name ? "hidden" : ""} ${className}`}>
    <div className="grid min-w-0 grid-cols-1 items-start gap-4 p-3 @2xl/form:grid-cols-2 sm:p-5">{children}</div>
  </div>;
}
