import { ChartColumnBig, ShieldCheck, UsersRound } from "lucide-react";
import { Suspense } from "react";
import { getCurrentUser } from "@/lib/auth/access";
import AppContainer from "@/components/ui/AppContainer";
import AppGrid from "@/components/ui/AppGrid";

async function Applications() {
  const user = await getCurrentUser();
  return (
    <AppGrid>
      <AppContainer name="Ventas" icon={<ChartColumnBig size={26} strokeWidth={1.8} />} />
      <AppContainer name="Contactos" href="/erp/contactos" icon={<UsersRound size={26} strokeWidth={1.8} />} />
      {user?.isAdmin && <AppContainer name="Usuarios" href="/erp/usuarios" icon={<ShieldCheck size={26} strokeWidth={1.8} />} />}
    </AppGrid>
  );
}

export default function PageErp() { return <Suspense fallback={<p role="status" className="p-6 text-sm text-base-content/60">Cargando aplicaciones…</p>}><Applications /></Suspense>; }
