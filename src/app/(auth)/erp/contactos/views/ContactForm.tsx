"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ChevronLeft, RefreshCw } from "lucide-react";
import FormView from "@/components/ui/form/FormView";
import FormViewLoader from "@/components/ui/form/FormViewLoader";
import FormGroup from "@/components/ui/form/FormGroup";
import FieldText from "@/components/ui/form/FieldText";
import FieldImage from "@/components/ui/form/FieldImage";
import PartnerAvatar from "@/components/ui/PartnerAvatar";
import { useFormNavigation } from "@/components/ui/form/FormNavigationProvider";
import { useAlerts } from "@/components/ui/alerts/AlertProvider";
import { uploadPartnerAvatar } from "@/lib/uploads/partner-avatar";
import { readContact, saveContact } from "../actions/contact.actions";
import { contactSchema, newContactDefaults, type ContactValues } from "../schemas/contact.schema";
import { contactsManifest } from "../manifest";

function ContactRecordForm({ record, canEdit, onReload }: { record: ContactValues; canEdit: boolean; onReload?: () => void }) {
  const router = useRouter();
  const methods = useForm<ContactValues>({ resolver: zodResolver(contactSchema), defaultValues: record });
  const [savedId, setSavedId] = useState(record.id);
  const Icon = contactsManifest.icon;

  return <FormView
    title={savedId ? canEdit ? "Editar contacto" : "Contacto" : "Nuevo contacto"}
    description="Nombre, imagen y medios de contacto."
    icon={<Icon size={22} />}
    methods={methods}
    mode={savedId ? "edit" : "create"}
    readOnly={!canEdit}
    onSubmit={saveContact}
    onNew={canEdit && savedId ? () => router.push("/erp/contactos/nuevo") : undefined}
    newLabel="Nuevo contacto"
    menuActions={onReload ? [{ id: "reload", label: "Recargar registro", icon: <RefreshCw size={16} />, onSelect: onReload }] : undefined}
    onSaved={values => {
      setSavedId(values.id);
      if (!record.id && values.id) router.replace(`/erp/contactos/${encodeURIComponent(values.id)}`);
      router.refresh();
    }}
    footer={<p className="text-xs leading-relaxed text-base-content/55">{canEdit
      ? "El nombre es obligatorio. Puedes completar los demás datos cuando los tengas."
      : "Puedes consultar este contacto. La edición está reservada a administradores."}</p>}
  >
    <FormGroup legend="Datos de contacto" fullWidth>
      <div className="grid min-w-0 gap-6 sm:grid-cols-[7rem_minmax(0,1fr)]">
        {canEdit ? <FieldImage<ContactValues> name="avatarUrl" label="Avatar" widget="avatar" upload={uploadPartnerAvatar} /> :
          <div className="space-y-3"><span className="text-sm font-medium text-base-content/70">Avatar</span><div role="img" aria-label={`Avatar de ${record.name}`}><PartnerAvatar name={record.name} avatarUrl={record.avatarUrl} size="lg" /></div></div>}
        <div className="flex min-w-0 flex-col gap-5">
          <FieldText<ContactValues> name="name" label="Nombre o razón social" maxLength={120} autoFocus={canEdit && !savedId} />
          <div className="grid min-w-0 gap-5 md:grid-cols-2">
            <FieldText<ContactValues> name="email" label="Correo electrónico" inputMode="email" autoCapitalize="none" spellCheck={false} maxLength={254} />
            <FieldText<ContactValues> name="phone" label="Teléfono" inputMode="tel" maxLength={40} />
          </div>
        </div>
      </div>
    </FormGroup>
  </FormView>;
}

export default function ContactForm({ id, canEdit }: { id?: string; canEdit: boolean }) {
  const router = useRouter();
  const navigation = useFormNavigation();
  const alerts = useAlerts();
  const [reloadKey, setReloadKey] = useState(0);
  const load = useCallback(() => readContact(id!), [id]);
  const reload = () => {
    void navigation.run(() => setReloadKey(key => key + 1)).catch(() => {
      void alerts.error({ title: "No se pudo recargar el contacto", message: "Intenta nuevamente. Tus cambios siguen en el formulario." });
    });
  };
  return <div className="min-h-0 min-w-0 flex-1 overflow-y-auto p-3 sm:p-6"><div className="mx-auto flex w-full min-w-0 max-w-5xl flex-col gap-4">
    <Link href="/erp/contactos" className="inline-flex w-fit items-center gap-1 rounded-sm text-sm text-base-content/60 hover:text-primary focus-visible:outline-2 focus-visible:outline-primary"><ChevronLeft size={16} aria-hidden="true" />{contactsManifest.name}</Link>
    {id ? <FormViewLoader key={`${router.bfcacheId}:${reloadKey}`} recordKey={id} load={load}>{record => <ContactRecordForm record={record} canEdit={canEdit} onReload={reload} />}</FormViewLoader>
      : <ContactRecordForm key={router.bfcacheId} record={{ ...newContactDefaults }} canEdit={canEdit} />}
  </div></div>;
}
