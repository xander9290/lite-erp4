import { Suspense } from "react";
import type { Metadata } from "next";
import ModelRoute, { modelRouteMetadata } from "@/components/modules/ModelRoute";

type Props = { params: Promise<{ path?: string[] }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

/** Accounts of the native core.user: list, /nuevo and /<id>, with the shared model views. */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return modelRouteMetadata("core.user", (await params).path ?? []);
}

async function Users({ params, searchParams }: Props) {
  return <ModelRoute modelId="core.user" path={(await params).path ?? []} searchParams={searchParams} application={{ name: "Ajustes", href: "/erp/ajustes", label: "Usuarios" }} />;
}

export default function UsersPage(props: Props) {
  return <Suspense fallback={<p role="status" className="p-6">Cargando…</p>}><Users {...props} /></Suspense>;
}
