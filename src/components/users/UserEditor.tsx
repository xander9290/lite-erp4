"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ChevronLeft, ShieldCheck } from "lucide-react";
import FormView from "@/components/ui/form/FormView";
import FormViewLoader from "@/components/ui/form/FormViewLoader";
import FormGroup from "@/components/ui/form/FormGroup";
import FieldText from "@/components/ui/form/FieldText";
import FieldBoolean from "@/components/ui/form/FieldBoolean";
import FieldImage from "@/components/ui/form/FieldImage";
import { uploadPartnerAvatar } from "@/lib/uploads/partner-avatar";
import { newUserDefaults, userSchema, type UserValues } from "@/schemas/user.schema";
import { readUser, saveUser } from "@/lib/users/actions";

function UserForm({ record }: { record: UserValues }) {
  const router = useRouter();
  const methods = useForm<UserValues>({ resolver: zodResolver(userSchema), defaultValues: record });
  const [savedId, setSavedId] = useState(record.id);
  return <FormView title={savedId ? "Editar usuario" : "Nuevo usuario"} description="Datos de contacto y acceso al ERP." icon={<ShieldCheck size={22} />} methods={methods} mode={savedId ? "edit" : "create"} onSubmit={saveUser}
    onNew={savedId ? () => router.push("/erp/usuarios/nuevo") : undefined}
    onSaved={values => { setSavedId(values.id); if (!record.id && values.id) router.replace(`/erp/usuarios/${values.id}`); router.refresh(); }}
    footer={<p className="text-xs leading-relaxed text-base-content/55">{savedId ? "Deja la contraseña vacía para conservar la actual. Cambiar la contraseña, el usuario o los permisos cerrará sus sesiones anteriores." : "La contraseña debe tener al menos 8 caracteres."}</p>}>
    <FormGroup legend="Contacto">
      <div className="grid min-w-0 gap-4 sm:grid-cols-[7rem_minmax(0,1fr)]">
        <FieldImage<UserValues> name="avatarUrl" label="Avatar" widget="avatar" upload={uploadPartnerAvatar} />
        <div className="flex min-w-0 flex-col gap-4">
          <FieldText<UserValues> name="name" label="Nombre completo" maxLength={120} />
          <FieldText<UserValues> name="email" label="Correo electrónico" maxLength={254} />
          <FieldText<UserValues> name="phone" label="Teléfono" maxLength={40} />
        </div>
      </div>
    </FormGroup>
    <FormGroup legend="Acceso">
      <FieldText<UserValues> name="login" label="Usuario" maxLength={64} />
      <FieldText<UserValues> name="password" label={savedId ? "Nueva contraseña" : "Contraseña"} type="password" />
      <FieldBoolean<UserValues> name="active" label="Cuenta activa" direction="inline" />
      <FieldBoolean<UserValues> name="isAdmin" label="Administrador" direction="inline" />
    </FormGroup>
  </FormView>;
}

export default function UserEditor({ id }: { id?: string }) {
  const router = useRouter();
  const load = useCallback(() => readUser(id!), [id]);
  return <div className="min-h-0 min-w-0 flex-1 overflow-y-auto p-3 sm:p-6"><div className="mx-auto flex w-full min-w-0 max-w-5xl flex-col gap-4">
    <Link href="/erp/usuarios" className="inline-flex w-fit items-center gap-1 text-sm text-base-content/60 hover:text-primary"><ChevronLeft size={16} aria-hidden="true" />Usuarios</Link>
    {id ? <FormViewLoader key={router.bfcacheId} recordKey={id} load={load}>{record => <UserForm record={record} />}</FormViewLoader> : <UserForm key={router.bfcacheId} record={newUserDefaults} />}
  </div></div>;
}
