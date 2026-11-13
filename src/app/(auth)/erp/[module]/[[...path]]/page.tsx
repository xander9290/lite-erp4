import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import ModelCollection from "@/components/modules/ModelCollection";
import ModelForm from "@/components/modules/ModelForm";
import { getModule, getModuleModel, modelClientConfig } from "@/lib/modules/registry";

type Props = { params: Promise<{ module: string; path?: string[] }> };

/** Convention: /erp/<module>/<model>, /nuevo and /<id>. Only registered models resolve. */
async function Resolve({ params }: Props) {
  const { module: moduleId, path = [] } = await params;
  const definition = getModule(moduleId);
  if (!definition || !definition.models.length) notFound();
  if (!path.length) redirect(definition.models[0].route);
  const found = getModuleModel(`${moduleId}.${path[0]}`);
  if (!found || path.length > 2) notFound();
  const config = modelClientConfig(found.entry.id);
  const { views } = found.entry;
  if (path.length === 1) {
    const List = views.list ? (await views.list()).default : ModelCollection;
    return <List config={config} />;
  }
  const id = path[1] === "nuevo" ? undefined : decodeURIComponent(path[1]);
  if (id !== undefined && (!id.trim() || id.length > 100)) notFound();
  const Form = views.form ? (await views.form()).default : ModelForm;
  return <Form key={id ?? "nuevo"} config={config} id={id} />;
}

export default function Page(props: Props) {
  return <Suspense fallback={<p role="status" className="p-6">Cargando…</p>}><Resolve {...props} /></Suspense>;
}
