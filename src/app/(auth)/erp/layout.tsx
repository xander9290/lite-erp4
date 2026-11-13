import { Suspense, type ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import Clock from "@/components/Clock";
import ThemeToggle from "@/components/ui/ThemeToggle";
import UserTheme from "@/components/ui/UserTheme";
import UserMenu from "@/components/login/UserMenu";
import { getCurrentAccessUser } from "@/lib/access/current";
import ApplicationNavigation from "@/components/ui/ApplicationNavigation";
import { applications } from "@/lib/applications/registry";
import { applicationNavigation } from "@/lib/applications/navigation";
import { isModuleMaintenance, maintenanceOperation } from "@/lib/module-manager/maintenance";

async function ProtectedErp({ children }: { children: ReactNode }) {
  const user = await getCurrentAccessUser();
  const maintenance = await isModuleMaintenance();
  const operation = maintenance && user?.isAdmin ? await maintenanceOperation() : null;
  if (!user) redirect("/auth");
  const navigation = applications.forUser(user).flatMap(application => {
    const item = applicationNavigation(application, user);
    return item ? [item] : [];
  });
  return (
    <UserTheme initialDarkMode={user.darkMode}>
      <header className="relative z-40 grid min-h-14 shrink-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-2 rounded-md bg-base-100 px-3 py-2 lg:flex">
        <Link href="/erp" className="btn btn-ghost btn-sm font-semibold">
          Lite ERP
        </Link>
        <div className="col-span-2 row-start-2 flex min-w-0 items-center gap-2 lg:flex-1 lg:gap-3">
          <div className="min-w-0 flex-1"><Suspense fallback={null}><ApplicationNavigation applications={navigation} /></Suspense></div>
          <Clock />
          <ThemeToggle />
        </div>
        <UserMenu user={{ login: user.login, name: user.name, image: user.image, isAdmin: user.isAdmin }} />
      </header>
      {maintenance && <div role="status" className="rounded-md bg-warning/15 px-3 py-2 text-sm">El ERP está en mantenimiento de módulos. {user.isAdmin && <Link href={operation ? `/erp/modulos/${operation.module}/operaciones/${operation.id}` : "/erp/modulos"} className="link">Revisar operaciones y finalizar mantenimiento</Link>}</div>}
      <main className="rounded-md flex-1 flex flex-col min-h-0 min-w-0 bg-base-100">{children}</main>
    </UserTheme>
  );
}

export default function LayoutErp({ children }: { children: ReactNode }) {
  return (
    <Suspense
      fallback={
        <div role="status" className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-base-100 text-sm text-base-content/60">
          <span className="loading loading-spinner loading-sm" />
          Cargando…
        </div>
      }
    >
      <ProtectedErp>{children}</ProtectedErp>
    </Suspense>
  );
}
