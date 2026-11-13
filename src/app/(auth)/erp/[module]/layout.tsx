import { Suspense, type ReactNode } from "react";
import { notFound } from "next/navigation";
import ApplicationLayout from "@/components/ui/ApplicationLayout";
import { getModule } from "@/lib/modules/registry";

type Props = { children: ReactNode; params: Promise<{ module: string }> };

async function ModuleLayout({ children, params }: Props) {
  const { module } = await params;
  if (!getModule(module)) notFound();
  return <ApplicationLayout applicationId={module}>{children}</ApplicationLayout>;
}

/** Declarative modules only. Static application folders (contactos, citas, …) take precedence over this route. */
export default function Layout(props: Props) {
  // URL data is read inside Suspense so navigation keeps an instant shell (Next 16).
  return <Suspense fallback={<p role="status" className="p-6 text-sm text-base-content/60">Cargando…</p>}><ModuleLayout {...props} /></Suspense>;
}
