import { Suspense, type ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/access";

async function AdministratorOnly({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/auth");
  if (!user.isAdmin) return <div role="alert" className="space-y-3 p-6"><p>Necesitas permisos de administrador para gestionar usuarios.</p><Link href="/erp" className="btn btn-soft btn-sm">Volver a aplicaciones</Link></div>;
  return children;
}

/** Temporary app until the application scaffold is defined. */
export default function UsersLayout({ children }: { children: ReactNode }) {
  return <Suspense fallback={<p role="status" className="p-6 text-sm text-base-content/60">Cargando…</p>}><AdministratorOnly>{children}</AdministratorOnly></Suspense>;
}
