import { Suspense, type ReactNode } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/access";
import { applications } from "@/lib/applications/registry";
import { canOpenApplication } from "@/lib/applications/manifest";

async function ApplicationAccess({ applicationId, children }: { applicationId: string; children: ReactNode }) {
  const application = applications.get(applicationId);
  if (!application) notFound();
  const user = await getCurrentUser();
  if (!user) redirect("/auth");
  if (!canOpenApplication(application, user)) return (
    <div role="alert" className="space-y-3 p-6">
      <p>Necesitas permisos de administrador para abrir {application.name}.</p>
      <Link href="/erp" className="btn btn-soft btn-sm">Volver a aplicaciones</Link>
    </div>
  );
  return children;
}

/** Route access only: server actions must also authorize every operation. */
export default function ApplicationLayout({ applicationId, children }: { applicationId: string; children: ReactNode }) {
  return <Suspense fallback={<p role="status" className="p-6 text-sm text-base-content/60">Cargando…</p>}>
    <ApplicationAccess applicationId={applicationId}>{children}</ApplicationAccess>
  </Suspense>;
}
