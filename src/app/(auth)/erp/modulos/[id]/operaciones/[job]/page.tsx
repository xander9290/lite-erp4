import { Suspense } from "react";
import { OperationRecord } from "../../../OperationPanel";

async function Record({ params }: { params: Promise<{ id: string; job: string }> }) {
  const { id, job } = await params;
  return <OperationRecord module={id} id={job} />;
}
export default function Page(props: { params: Promise<{ id: string; job: string }> }) {
  return <Suspense fallback={<p role="status" className="p-3">Cargando operación…</p>}><Record {...props} /></Suspense>;
}
