import FormLogin from "@/components/login/FormLogin";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/access";
import { safeErpRedirect } from "@/lib/auth/policy";

async function Login({ searchParams }: PageProps<"/auth">) {
  const params = await searchParams;
  const callbackUrl = safeErpRedirect(params.callbackUrl);
  if (await getCurrentUser()) redirect(callbackUrl);
  return <FormLogin callbackUrl={callbackUrl} />;
}
export default function Page(props: PageProps<"/auth">) {
  return (
    <main className="flex min-h-0 flex-1 overflow-y-auto rounded-xl bg-linear-to-br from-primary/5 via-base-200 to-base-200 p-4 sm:p-6">
      <div className="mx-auto mb-auto mt-4 w-full max-w-md py-4 sm:mt-8 sm:py-8">
        <Suspense fallback={<p role="status" className="p-6 text-center text-sm text-base-content/60">Cargando…</p>}><Login {...props} /></Suspense>
      </div>
    </main>
  );
}
