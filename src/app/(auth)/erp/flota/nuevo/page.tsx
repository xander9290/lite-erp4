import { Suspense } from "react";
import { getCurrentUser } from "@/lib/auth/access";
import { redirect } from "next/navigation";
import RecordForm from "../views/RecordForm";

async function NewRecord() {
  const user = await getCurrentUser();
  if (!user) redirect("/auth");
  if (!user.isAdmin) redirect("/erp");
  return <RecordForm />;
}
export default function Page() { return <Suspense fallback={<p role="status" className="p-6">Cargando…</p>}><NewRecord /></Suspense>; }
