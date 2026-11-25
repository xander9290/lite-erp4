import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import ModelRoute, { modelRouteMetadata } from "@/components/modules/ModelRoute";
import { getModule } from "@/lib/modules/registry";
import { getCurrentAccessUser } from "@/lib/access/current";
import { applicationNavigation, firstApplicationMenu } from "@/lib/applications/navigation";
import { applications } from "@/lib/applications/registry";
import { menuLinkHref } from "@/lib/applications/manifest";

type Props = { params: Promise<{ module: string; path?: string[] }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

/** Shared route validation for the page and its metadata. Native modules have no route here. */
async function resolveRoute(params: Props["params"]) {
  const { module: moduleId, path = [] } = await params;
  const definition = getModule(moduleId);
  if (!definition || definition.native || !definition.models.length) notFound();
  if (!path.length) {
    const actor = await getCurrentAccessUser();
    if (!actor) redirect("/auth");
    const application = applications.get(moduleId);
    const navigation = application && applicationNavigation(application, actor);
    if (!navigation) redirect("/erp");
    const first = firstApplicationMenu(navigation.menus);
    if (first) redirect(menuLinkHref(first));
    return { modelId: undefined, rest: [], label: definition.application.name };
  }
  return { modelId: `${moduleId}.${path[0]}`, rest: path.slice(1) };
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { modelId, rest, ...route } = await resolveRoute(params);
  if (!modelId) return { title: "label" in route ? route.label : "Aplicación" };
  return modelRouteMetadata(modelId, rest, await searchParams);
}

/** Convention: /erp/<module>/<model>, /nuevo and /<id>. Only registered models resolve. */
async function Resolve({ params, searchParams }: Props) {
  const { modelId, rest } = await resolveRoute(params);
  if (!modelId) return <p role="status" className="p-6">No hay menús visibles para tu grupo. Puedes volver al cajón de aplicaciones.</p>;
  return <ModelRoute modelId={modelId} path={rest} searchParams={searchParams} />;
}

export default function Page(props: Props) {
  return <Suspense fallback={<p role="status" className="p-6">Cargando…</p>}><Resolve {...props} /></Suspense>;
}
