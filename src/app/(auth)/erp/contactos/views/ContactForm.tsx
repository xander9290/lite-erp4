"use client";

import ModelForm, { ModelExtensions } from "@/components/modules/ModelForm";
import FormGroup from "@/components/ui/form/FormGroup";
import FieldText from "@/components/ui/form/FieldText";
import FieldImage from "@/components/ui/form/FieldImage";
import type { ModelClientConfig } from "@/lib/modules/config";
import type { FormValues } from "@/lib/orm/model";
import type { Partner } from "@/lib/core/models/partner";
import Stack from "@/components/ui/form/Stack";

type Values = FormValues<typeof Partner>;

/** Presentation only: permissions, validation, history, revision and navigation belong to ModelForm. */
export default function ContactForm({
  config,
  id,
}: {
  config: ModelClientConfig;
  id?: string;
}) {
  return (
    <ModelForm config={config} id={id}>
      <FormGroup legend="Datos de contacto">
        <Stack>
          <FieldImage<Values> name="avatarUrl" widget="avatar" label="" />
          <FieldText<Values> name="name" label="Nombre" />
        </Stack>
        <Stack>
          <FieldText<Values> name="phone" inputMode="tel" />
          <FieldText<Values> name="email" widget="email" />
        </Stack>
      </FormGroup>
      <ModelExtensions />
    </ModelForm>
  );
}
