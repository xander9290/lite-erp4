import { Suspense } from "react";
import ModuleDetail from "../ModuleDetail";

async function Detail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ModuleDetail id={id} />;
}

export default function ModulePage(props: { params: Promise<{ id: string }> }) {
  return <Suspense fallback={<p role="status" className="p-3">Cargando…</p>}><Detail {...props} /></Suspense>;
}
