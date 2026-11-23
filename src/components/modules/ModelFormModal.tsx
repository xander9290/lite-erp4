"use client";

import type { ReactNode } from "react";
import FormDialog from "@/components/ui/form/FormDialog";
import type { ModelClientConfig } from "@/lib/modules/config";
import ModelForm from "./ModelForm";
import { ModelFormPresentation, useModelFormTemplate } from "./ModelFormPresentation";

/** A configured ModelForm with its own RHF/save/guard, without changing the page URL. */
export default function ModelFormModal({ config, id, defaults, onClose, onSaved, children }: {
  config: ModelClientConfig;
  id?: string;
  defaults?: Readonly<Record<string, unknown>>;
  onClose: () => void;
  onSaved: (values: Record<string, unknown>) => void;
  children?: ReactNode;
}) {
  const template = useModelFormTemplate(config.id);
  return <FormDialog title={id ? `Editar · ${config.label}` : `Nuevo · ${config.label}`} onClose={onClose}>
    <ModelFormPresentation value={{ model: config.id, id, defaults, onSaved: values => { onSaved(values); onClose(); } }}>
      {children ?? template ?? <ModelForm config={config} />}
    </ModelFormPresentation>
  </FormDialog>;
}
