import "server-only";
import type { ReactNode } from "react";
import type { ModelFormReference } from "@/lib/modules/form-reference";
import { getCurrentAccessUser } from "@/lib/access/current";
import { hasModuleGroup } from "@/lib/access/membership";
import { getModuleModel, modelClientConfig } from "@/lib/modules/registry";
import { ModelFormTemplates } from "./ModelFormPresentation";
import { modelFormContent } from "./ModelFormSlots";

/** Explicit server composition for buttons targeting other models; no global client registry. */
export default async function ModelFormTargets({ forms, children }: { forms: readonly ModelFormReference[]; children: ReactNode }) {
  const actor = await getCurrentAccessUser();
  const templates: Record<string, ReactNode> = {};
  for (const model of new Set(forms.map(form => form.model))) {
    const found = getModuleModel(model);
    if (!found) throw new Error("ModelFormTargets: referencia de modelo no registrada.");
    if (!actor?.modelAccess[model]?.read || (!actor.isAdmin && !hasModuleGroup(found.module.id, actor.directGroups))) continue;
    const config = modelClientConfig(model, actor);
    const [modal, form] = await Promise.all([modelFormContent(found.entry, config, undefined, "modal"), modelFormContent(found.entry, config, undefined, "form")]);
    templates[`${model}:modal`] = modal;
    templates[`${model}:form`] = form;
  }
  return <ModelFormTemplates value={templates}>{children}</ModelFormTemplates>;
}
