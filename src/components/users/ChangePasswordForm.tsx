"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { KeyRound } from "lucide-react";
import FormView from "../ui/form/FormView";
import FormGroup from "../ui/form/FormGroup";
import FieldText from "../ui/form/FieldText";
import { changeMyPassword } from "@/lib/auth/profile-actions";
import { changePasswordSchema, emptyPasswordValues, type ChangePasswordValues } from "@/schemas/profile.schema";

export default function ChangePasswordForm() {
  const router = useRouter();
  const methods = useForm<ChangePasswordValues>({ resolver: zodResolver(changePasswordSchema), defaultValues: emptyPasswordValues });
  return <FormView layout="page" breadcrumbs={[{ label: "Aplicaciones", href: "/erp" }, { label: "Mi perfil", href: "/erp/perfil" }, { label: "Cambiar contraseña" }]} title="Cambiar contraseña" description="Confirma tu contraseña actual para elegir una nueva." icon={<KeyRound size={22} />} methods={methods} onSubmit={changeMyPassword} saveLabel="Actualizar contraseña"
      onSaved={() => { router.replace("/auth"); router.refresh(); }}
      footer={<p className="text-xs leading-relaxed text-base-content/55">Usa al menos 8 caracteres. Al actualizarla, tus sesiones se cerrarán y tendrás que iniciar sesión con la nueva contraseña.</p>}>
      <FormGroup legend="Seguridad" fullWidth>
        <FieldText<ChangePasswordValues> name="currentPassword" label="Contraseña actual" type="password" />
        <FieldText<ChangePasswordValues> name="newPassword" label="Nueva contraseña" type="password" />
        <FieldText<ChangePasswordValues> name="confirmPassword" label="Confirmar nueva contraseña" type="password" />
      </FormGroup>
    </FormView>;
}
