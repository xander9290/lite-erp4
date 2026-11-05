"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ChevronLeft, KeyRound } from "lucide-react";
import FormView from "../ui/form/FormView";
import FormGroup from "../ui/form/FormGroup";
import FieldText from "../ui/form/FieldText";
import { changeMyPassword } from "@/lib/auth/profile-actions";
import { changePasswordSchema, emptyPasswordValues, type ChangePasswordValues } from "@/schemas/profile.schema";

export default function ChangePasswordForm() {
  const router = useRouter();
  const methods = useForm<ChangePasswordValues>({ resolver: zodResolver(changePasswordSchema), defaultValues: emptyPasswordValues });
  return <div className="min-h-0 min-w-0 flex-1 overflow-y-auto p-3 sm:p-6"><div className="mx-auto flex w-full min-w-0 max-w-xl flex-col gap-4">
    <Link href="/erp/perfil" className="inline-flex w-fit items-center gap-1 text-sm text-base-content/60 hover:text-primary"><ChevronLeft size={16} aria-hidden="true" />Mi perfil</Link>
    <FormView title="Cambiar contraseña" description="Confirma tu contraseña actual para elegir una nueva." icon={<KeyRound size={22} />} methods={methods} onSubmit={changeMyPassword} saveLabel="Actualizar contraseña"
      onSaved={() => { router.replace("/auth"); router.refresh(); }}
      footer={<p className="text-xs leading-relaxed text-base-content/55">Usa al menos 8 caracteres. Al actualizarla, tus sesiones se cerrarán y tendrás que iniciar sesión con la nueva contraseña.</p>}>
      <FormGroup legend="Seguridad" fullWidth>
        <FieldText<ChangePasswordValues> name="currentPassword" label="Contraseña actual" type="password" />
        <FieldText<ChangePasswordValues> name="newPassword" label="Nueva contraseña" type="password" />
        <FieldText<ChangePasswordValues> name="confirmPassword" label="Confirmar nueva contraseña" type="password" />
      </FormGroup>
    </FormView>
  </div></div>;
}
