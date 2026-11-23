import "server-only";
import ModelForm from "./ModelForm";
import ModelExtensionViews from "./ModelExtensionViews";
import { ModelFormTemplates } from "./ModelFormPresentation";
import { getModuleModel } from "@/lib/modules/registry";
import type { ModelClientConfig } from "@/lib/modules/config";
import type { ModuleModel } from "@/lib/modules/define";
import { formExtensionContent, resolveFormView, type FormViewKind } from "@/lib/modules/form-view";

/** Independent layouts; both retain the same authorized form runtime. */
export async function modelFormSlot(entry: ModuleModel, config: ModelClientConfig, id?: string, presentation: FormViewKind = "form") {
  const selected = resolveFormView(entry, presentation);
  const Form = selected.load ? (await selected.load()).default : ModelForm;
  const content = formExtensionContent(entry.extensions, presentation, selected.kind);
  const extensionViews = Object.fromEntries(await Promise.all(content.filter(extension => extension.form).map(async extension => {
    const View = (await extension.form!()).default;
    return [extension.module, <View key={extension.module} config={config} />];
  })));
  const insertionViews = Object.fromEntries(await Promise.all(content.filter(extension => extension.insertions).map(async extension => {
    const View = (await extension.insertions!()).default;
    return [extension.module, <View key={extension.module} config={config} />];
  })));
  return <ModelExtensionViews model={entry.id} formKind={presentation} views={extensionViews} insertions={{ [presentation]: insertionViews }}><Form config={config} id={id} /></ModelExtensionViews>;
}

export async function modelFormContent(entry: ModuleModel, config: ModelClientConfig, id?: string, presentation: FormViewKind = "form") {
  // Only this form and its published child collections, not an import of the registry on
  // the client. Child configs already stop at one level; a self relation reuses this view.
  const configs = new Map(Object.values(config.collections ?? {}).map(child => [child.config.id, child.config]));
  if (configs.has(config.id)) configs.set(config.id, config);
  const templates = Object.fromEntries(await Promise.all([...configs].filter(([, candidate]) => candidate.capabilities?.read).map(async ([model, candidate]) => {
    const target = getModuleModel(model)!;
    return [`${model}:modal`, await modelFormSlot(target.entry, candidate, undefined, "modal")];
  })));
  const [modal, form] = await Promise.all([modelFormSlot(entry, config, undefined, "modal"), modelFormSlot(entry, config)]);
  templates[`${entry.id}:modal`] = modal;
  templates[`${entry.id}:form`] = form;
  return <ModelFormTemplates value={templates}><div key={id ?? "nuevo"} className="flex min-h-0 min-w-0 flex-1 flex-col">{await modelFormSlot(entry, config, id, presentation)}</div></ModelFormTemplates>;
}
