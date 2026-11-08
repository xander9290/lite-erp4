"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { UserRound } from "lucide-react";
import FormView from "../ui/form/FormView";
import FormViewLoader from "../ui/form/FormViewLoader";
import FormGroup from "../ui/form/FormGroup";
import FieldText from "../ui/form/FieldText";
import FieldImage from "../ui/form/FieldImage";
import { readMyProfile, saveMyProfile } from "@/lib/auth/profile-actions";
import { uploadPartnerAvatar } from "@/lib/uploads/partner-avatar";
import { profileSchema, type ProfileRecord, type ProfileValues } from "@/schemas/profile.schema";

function ProfileForm({ record }: { record: ProfileRecord }) {
  const router = useRouter();
  const methods = useForm<ProfileValues>({ resolver: zodResolver(profileSchema), defaultValues: record.values });
  return <FormView layout="page" breadcrumbs={[{ label: "Aplicaciones", href: "/erp" }, { label: "Mi perfil" }]} title="Mi perfil" description="Tus datos de contacto y tu cuenta de acceso." icon={<UserRound size={22} />} methods={methods} onSubmit={saveMyProfile} onSaved={() => router.refresh()}>
    <FormGroup legend="Contacto">
      <div className="grid min-w-0 gap-4 sm:grid-cols-[7rem_minmax(0,1fr)]">
        <FieldImage<ProfileValues> name="avatarUrl" label="Avatar" widget="avatar" upload={uploadPartnerAvatar} />
        <div className="flex min-w-0 flex-col gap-4">
          <FieldText<ProfileValues> name="name" label="Nombre completo" maxLength={120} />
          <FieldText<ProfileValues> name="email" label="Correo electrónico" maxLength={254} />
          <FieldText<ProfileValues> name="phone" label="Teléfono" maxLength={40} />
        </div>
      </div>
    </FormGroup>
    <FormGroup legend="Cuenta">
      <dl className="space-y-4 text-sm"><div><dt className="text-xs text-base-content/55">Usuario</dt><dd className="mt-1 font-medium wrap-anywhere">{record.account.login}</dd></div><div><dt className="text-xs text-base-content/55">Acceso</dt><dd className="badge badge-soft mt-2">{record.account.isAdmin ? "Administrador" : "Usuario"}</dd></div></dl>
      <Link href="/erp/perfil/contrasena" className="btn btn-soft btn-sm mt-2 w-fit">Cambiar contraseña</Link>
    </FormGroup>
  </FormView>;
}

export default function MyProfile() {
  const router = useRouter();
  return (
    <FormViewLoader key={router.bfcacheId} recordKey="my-profile" load={readMyProfile}>{record => <ProfileForm record={record} />}</FormViewLoader>
  );
}
