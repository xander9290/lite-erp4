import { ChartColumnBig } from "lucide-react";
import { Suspense } from "react";
import { getCurrentUser } from "@/lib/auth/access";
import AppContainer from "@/components/ui/AppContainer";
import AppGrid from "@/components/ui/AppGrid";
import { applications } from "@/lib/applications/registry";
import { applicationHref } from "@/lib/applications/manifest";

async function Applications() {
  const user = await getCurrentUser();
  return (
    <AppGrid>
      <AppContainer name="Ventas" icon={<ChartColumnBig size={26} strokeWidth={1.8} />} />
      {applications.forUser(user).map(application => {
        const Icon = application.icon;
        return <AppContainer key={application.id} name={application.name} href={applicationHref(application)} icon={<Icon size={26} strokeWidth={1.8} />} />;
      })}
    </AppGrid>
  );
}

export default function PageErp() { return <Suspense fallback={<p role="status" className="p-6 text-sm text-base-content/60">Cargando aplicaciones…</p>}><Applications /></Suspense>; }
