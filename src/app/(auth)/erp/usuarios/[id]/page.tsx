import { Suspense } from "react";
import UserEditor from "@/components/users/UserEditor";
type Props = { params: Promise<{ id: string }> };

async function UserRecord({ params }: Props) {
  const { id } = await params;
  return <UserEditor id={id} />;
}

export default function EditUserPage({ params }: Props) {
  return <Suspense fallback={<p role="status" className="p-6 text-sm text-base-content/60">Cargando…</p>}><UserRecord params={params} /></Suspense>;
}
