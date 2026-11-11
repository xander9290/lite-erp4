"use client";

import { loginSchema, loginSchemaDefault, type LoginSchemaType } from "@/schemas/login.schema";
import { zodResolver } from "@hookform/resolvers/zod";
import { SubmitHandler, useForm } from "react-hook-form";
import FormLayout from "../ui/form/FormLayout";
import FormGroup from "../ui/form/FormGroup";
import FieldText from "../ui/form/FieldText";
import { ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { loginAction } from "@/lib/auth/actions";
import { safeErpRedirect } from "@/lib/auth/policy";
import { useAlerts } from "../ui/alerts/AlertProvider";

export default function FormLogin({ callbackUrl = "/erp" }: { callbackUrl?: string }) {
  const router = useRouter();
  const alerts = useAlerts();
  const methods = useForm<LoginSchemaType>({
    resolver: zodResolver(loginSchema),
    defaultValues: loginSchemaDefault,
  });

  const onSubmit: SubmitHandler<LoginSchemaType> = async values => {
    try {
      const result = await alerts.withLoading(() => loginAction(values), { title: "Ingresando…", message: "Verificando tus datos de acceso." });
      if (!result.ok) { await alerts.error({ title: "No se pudo iniciar sesión", message: result.error }); return; }
      router.replace(safeErpRedirect(callbackUrl)); router.refresh();
    } catch { await alerts.error({ title: "No se pudo iniciar sesión", message: "Revisa tu conexión e intenta nuevamente." }); }
  };

  return (
    <section aria-labelledby="login-title" className="card w-full overflow-hidden rounded-3xl border border-base-300 bg-base-100 shadow-xl shadow-base-content/5">
      <div className="card-body gap-0 p-6 sm:p-8">
        <h1 id="login-title" className="text-2xl font-semibold tracking-tight text-base-content">
          Inicio de sesión
        </h1>

        <FormLayout methods={methods} onSubmit={onSubmit} aria-labelledby="login-title" className="mt-6">
          <FormGroup disabled={methods.formState.isSubmitting} legend={<span className="sr-only">Datos de acceso</span>} className="gap-5 border-0! bg-transparent! p-0! shadow-none!">
            <FieldText<LoginSchemaType> name="login" autoFocus label="Usuario" />
            <FieldText<LoginSchemaType> name="password" label="Contraseña" widget="password" />
            <button
              type="submit"
              disabled={methods.formState.isSubmitting}
              className="btn btn-primary mt-1 h-11 w-full gap-2 rounded-xl font-semibold shadow-sm transition-transform active:scale-[0.98] motion-reduce:transform-none"
            >
              {methods.formState.isSubmitting ? "Ingresando…" : "Entrar"}
              {methods.formState.isSubmitting ? <span className="loading loading-spinner loading-xs" aria-hidden="true" /> : <ArrowRight size={17} aria-hidden="true" />}
            </button>
          </FormGroup>
        </FormLayout>
      </div>
    </section>
  );
}
