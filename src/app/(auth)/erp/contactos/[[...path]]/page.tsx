import { Suspense } from "react";
import type { Metadata } from "next";
import ModelRoute, { modelRouteMetadata } from "@/components/modules/ModelRoute";

type Props = { params: Promise<{ path?: string[] }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const path = (await params).path ?? [];
  return path.length ? modelRouteMetadata("core.partner", path) : { title: "Contactos" };
}

async function Contacts({ params, searchParams }: Props) {
  return <ModelRoute modelId="core.partner" path={(await params).path ?? []} searchParams={searchParams}
    application={{ name: "Contactos", href: "/erp/contactos", label: "Contactos" }} />;
}

export default function ContactsPage(props: Props) {
  return <Suspense fallback={<p role="status" className="p-6">Cargando contactos…</p>}><Contacts {...props} /></Suspense>;
}
