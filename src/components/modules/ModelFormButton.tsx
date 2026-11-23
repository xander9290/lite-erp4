"use client";

import { startTransition, useContext, useEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import { useAlerts } from "@/components/ui/alerts/AlertProvider";
import { FormActionsContext } from "@/components/ui/form/formActions";
import type { FormDefaults, ModelFormReference, ModelFormSaved, ModelFormOpenResult } from "@/lib/modules/form-reference";
import { openModelForm } from "./model-form.actions";
import ModelFormModal from "./ModelFormModal";
import { useModelFormTemplate } from "./ModelFormPresentation";

type ButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "type" | "onClick" | "form">;
type Prepared = ModelFormOpenResult & { content?: ReactNode };

/** Shared interaction for the real endpoint and the fictitious transport demo. */
export function FormOpenButton({ prepare, onSaved, disabled, className = "", children, ...props }: ButtonProps & {
  prepare: () => Promise<Prepared>;
  onSaved?: (values: Record<string, unknown>) => void | Promise<void>;
}) {
  const alerts = useAlerts();
  const form = useContext(FormActionsContext);
  const [pending, setPending] = useState(false);
  const [opened, setOpened] = useState<Extract<Prepared, { ok: true }> | null>(null);
  const busy = useRef(false);
  const mounted = useRef(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const open = () => {
    if (busy.current || disabled || form?.locked || opened) return;
    busy.current = true;
    setPending(true);
    startTransition(async () => {
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        const result = await Promise.race([prepare(), new Promise<never>((_resolve, reject) => {
          timer = setTimeout(() => reject(new Error("timeout")), 15000);
        })]);
        if (!mounted.current) return;
        if (result.ok) setOpened(result);
        else await alerts.error({ title: "No se pudo abrir el formulario", message: result.error });
      } catch {
        if (mounted.current) await alerts.error({ title: "No se pudo abrir el formulario", message: "Intenta nuevamente. Tus cambios siguen en el formulario principal." });
      } finally {
        clearTimeout(timer);
        busy.current = false;
        if (mounted.current) setPending(false);
      }
    });
  };
  const saved = (values: Record<string, unknown>) => {
    // A callback failure must never leave an already-saved record open for a duplicate retry.
    setOpened(null);
    void Promise.resolve().then(() => onSaved?.(values)).catch(() => {
      void alerts.error({ title: "Registro guardado", message: "No se pudo actualizar la vista relacionada. Actualízala manualmente." });
    });
  };
  return <>
    <button {...props} type="button" className={`btn btn-sm btn-soft ${className}`} disabled={disabled || pending || Boolean(opened) || form?.locked} aria-busy={pending || undefined} onClick={open}>
      {pending && <span className="loading loading-spinner loading-xs" aria-hidden="true" />}{children}
    </button>
    {opened && <ModelFormModal config={opened.config} id={opened.id} defaults={opened.defaults} view={opened.view} onClose={() => setOpened(null)} onSaved={saved}>{opened.content}</ModelFormModal>}
  </>;
}

export type ModelFormButtonProps<Reference extends ModelFormReference> = ButtonProps & {
  form: Reference;
  /** Layout to use inside the dialog. Defaults to the modal layout, with its normal fallback. */
  view?: "modal" | "form";
  id?: string;
  defaults?: Partial<NoInfer<FormDefaults<Reference>>>;
  /** When initial values depend on this record, require its persisted ID and revalidate its read access. */
  origin?: { form: ModelFormReference; id?: string };
  onSaved?: (values: ModelFormSaved<NoInfer<Reference>>) => void | Promise<void>;
};

export default function ModelFormButton<Reference extends ModelFormReference>({ form, view = "modal", id, defaults, origin, onSaved, disabled, title, ...props }: ModelFormButtonProps<Reference>) {
  const unsaved = Boolean(origin && !origin.id);
  const template = useModelFormTemplate(form.model, view);
  return <FormOpenButton {...props} disabled={disabled || unsaved} title={unsaved ? "Guarda primero el registro principal." : title}
    prepare={() => template == null ? Promise.resolve({ ok: false as const, error: "Este formulario no está disponible en esta página." }) : openModelForm({ model: form.model, view, ...(id !== undefined ? { id } : {}), ...(!id && defaults ? { defaults } : {}),
      ...(origin ? { origin: { model: origin.form.model, id: origin.id } } : {}) })}
    onSaved={values => onSaved?.(values as ModelFormSaved<Reference>)} />;
}
