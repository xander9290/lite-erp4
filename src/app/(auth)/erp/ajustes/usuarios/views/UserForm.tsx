"use client";

import ModelForm, { ModelExtensions } from "@/components/modules/ModelForm";
import FormGroup from "@/components/ui/form/FormGroup";
import FieldText from "@/components/ui/form/FieldText";
import FieldImage from "@/components/ui/form/FieldImage";
import FieldBoolean from "@/components/ui/form/FieldBoolean";
import FieldDate from "@/components/ui/form/FieldDate";
import type { ModelClientConfig } from "@/lib/modules/config";
import type { FormValues } from "@/lib/orm/model";
import type { User } from "@/lib/core/models/user";
import Notebook from "@/components/ui/form/Notebook";
import NotebookPage from "@/components/ui/form/NotebookPage";
import FormHeader from "@/components/ui/form/FormHeader";

type Values = FormValues<typeof User>;
const contactFields = ["name", "email", "phone", "avatarUrl"] as const;

/** Editable layout; ModelForm and core.user retain all account and persistence rules. */
export default function UserForm({
  config,
  id,
}: {
  config: ModelClientConfig;
  id?: string;
}) {
  return (
    <ModelForm config={config} id={id} density="compact">
      <FormGroup legend="Datos de contacto">
        <FieldImage<Values> name="avatarUrl" widget="avatar" label="" />
        <FieldText<Values> name="name" />
        <FieldText<Values> name="email" widget="email" />
        <FieldText<Values> name="phone" inputMode="tel" />
      </FormGroup>
      <FormGroup legend="Cuenta de usuario">
        <FieldText<Values> name="login" direction="inline" />
        <FieldText<Values>
          name="password"
          widget="password"
          direction="inline"
        />
        <p className="text-xs text-base-content/60">
          {id
            ? "Deja la contraseña vacía para conservar la actual."
            : "La contraseña es obligatoria al crear la cuenta."}
        </p>
        <FieldBoolean<Values> name="active" direction="inline" />
        <FieldBoolean<Values> name="isAdmin" direction="inline" />
      </FormGroup>
      <Notebook id="userNotebook">
        <NotebookPage label="Otra información" name="otherInfo" className="p-1">
          <FormGroup id="otherInfoGroup">
            <FieldDate<Values>
              name="lastLogin"
              type="datetime"
              direction="inline"
              readOnly
            />
          </FormGroup>
        </NotebookPage>
      </Notebook>
      <ModelExtensions excludeFields={contactFields} />
    </ModelForm>
  );
}
