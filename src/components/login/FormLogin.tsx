"use client";

import { loginSchema, loginSchemaDefault, LoginSchemaType } from "@/schemas/login.schema";
import { zodResolver } from "@hookform/resolvers/zod";
import { SubmitHandler, useForm } from "react-hook-form";
import FormLayout from "../ui/form/FormLayout";
import FormGroup from "../ui/form/FormGroup";
import FieldText from "../ui/form/FieldText";
import { redirect } from "next/navigation";
import { ArrowRight } from "lucide-react";

export default function FormLogin() {
  const methods = useForm<LoginSchemaType>({
    resolver: zodResolver(loginSchema),
    defaultValues: loginSchemaDefault,
  });

  const onSubmit: SubmitHandler<LoginSchemaType> = () => {
    redirect("/erp");
  };

  const handleOnchange = (value: string) => {
    console.log(value);
  };

  return (
    <section aria-labelledby="login-title" className="card w-full overflow-hidden rounded-3xl border border-base-300 bg-base-100 shadow-xl shadow-base-content/5">
      <div className="card-body gap-0 p-6 sm:p-8">
        <h1 id="login-title" className="text-2xl font-semibold tracking-tight text-base-content">Inicio de sesión</h1>

        <FormLayout methods={methods} onSubmit={onSubmit} aria-labelledby="login-title" className="mt-6">
          <FormGroup legend={<span className="sr-only">Datos de acceso</span>} className="gap-5 border-0! bg-transparent! p-0! shadow-none!">
            <FieldText<LoginSchemaType> name="login" label="Usuario" onChange={handleOnchange} />
            <FieldText<LoginSchemaType> name="password" label="Contraseña" type="password" />
            <button
              type="submit"
              disabled={methods.formState.isSubmitting}
              className="btn btn-primary mt-1 h-11 w-full gap-2 rounded-xl font-semibold shadow-sm transition-transform active:scale-[0.98] motion-reduce:transform-none"
            >
              Entrar
              {methods.formState.isSubmitting
                ? <span className="loading loading-spinner loading-xs" aria-hidden="true" />
                : <ArrowRight size={17} aria-hidden="true" />}
            </button>
          </FormGroup>
        </FormLayout>
      </div>
    </section>
  );
}
