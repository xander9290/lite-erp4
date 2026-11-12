import { Suspense } from "react";
import { getCurrentUser } from "@/lib/auth/access";
import { redirect } from "next/navigation";
import RecordForm from "../views/RecordForm";
type Props = { params: Promise<{ id: string }> };

async function OpenRecord({ params }: Props) {
  const [{ id }, user] = await Promise.all([params, getCurrentUser()]);
  if (!user) redirect("/auth");
  if (!user.isAdmin) redirect("/erp");
  return <RecordForm id={id} />;
}
export default function Page(props: Props) { return <Suspense fallback={<p role="status" className="p-6">Cargando…</p>}><OpenRecord {...props} /></Suspense>; }
