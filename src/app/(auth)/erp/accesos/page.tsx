import { Suspense } from "react";
import Link from "next/link";
import { Users } from "lucide-react";
import Breadcrumbs from "@/components/ui/Breadcrumbs";
import { requireAdmin } from "@/lib/auth/access";
import { prisma } from "@/lib/prisma";
import { accessOverview } from "@/lib/access/admin";
import { accessManifest } from "./manifest";

async function Overview() {
  const modules = await accessOverview(prisma, await requireAdmin());
  if (!modules.length) return <p className="text-sm text-base-content/60">Ningún módulo instalado declara grupos de acceso.</p>;
  return <div className="space-y-4">
    {modules.map(module => <section key={module.id} aria-labelledby={`modulo-${module.id}`} className="rounded-box border border-base-300">
      <h2 id={`modulo-${module.id}`} className="border-b border-base-300 px-3 py-2 text-sm font-semibold">{module.name}</h2>
      <ul className="divide-y divide-base-300">
        {module.groups.map(group => <li key={group.id}>
          <Link href={`/erp/accesos/grupo/${encodeURIComponent(group.id)}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 hover:bg-base-200 focus-visible:outline-2 focus-visible:outline-primary">
            <span className="font-medium">{group.label}</span>
            <code className="text-xs text-base-content/50">{group.id}</code>
            {group.implies.length > 0 && <span className="text-xs text-base-content/60">incluye {group.implies.join(", ")}</span>}
            <span className="ml-auto inline-flex items-center gap-1 text-xs text-base-content/70"><Users size={14} aria-hidden="true" />{group.members} {group.members === 1 ? "miembro" : "miembros"}</span>
          </Link>
        </li>)}
      </ul>
    </section>)}
  </div>;
}

export default function AccessPage() {
  return <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-2 sm:p-3">
    <Breadcrumbs items={[{ label: "Aplicaciones", href: "/erp" }, { label: accessManifest.name }]} />
    <h1 className="sr-only">{accessManifest.name}</h1>
    <p className="text-sm text-base-content/70">Los grupos, permisos y reglas se declaran en el manifest de cada módulo. Aquí se asignan usuarios y se ajustan permisos y reglas. Los administradores tienen acceso total.</p>
    <Suspense fallback={<p role="status" className="text-sm text-base-content/60">Cargando grupos…</p>}><Overview /></Suspense>
  </div>;
}
