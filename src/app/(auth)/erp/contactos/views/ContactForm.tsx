"use client";

import ModelForm, { ModelExtensions } from "@/components/modules/ModelForm";
import FormGroup from "@/components/ui/form/FormGroup";
import FieldText from "@/components/ui/form/FieldText";
import FieldImage from "@/components/ui/form/FieldImage";
import type { ModelClientConfig } from "@/lib/modules/config";
import type { FormValues } from "@/lib/orm/model";
import type { Partner } from "@/lib/core/models/partner";

type Values = FormValues<typeof Partner>;

/** Presentation only: permissions, validation, history, revision and navigation belong to ModelForm. */
export default function ContactForm({ config, id }: { config: ModelClientConfig; id?: string }) {
  return <ModelForm config={config} id={id}>
    <FormGroup legend="Datos de contacto" fullWidth>
      <div className="grid min-w-0 gap-6 sm:grid-cols-[7rem_minmax(0,1fr)]">
        <FieldImage<Values> name="avatarUrl" widget="avatar" />
        <div className="flex min-w-0 flex-col gap-4">
          <FieldText<Values> name="name" label="Nombre o razón social" />
          <FieldText<Values> name="email" widget="email" />
          <FieldText<Values> name="phone" inputMode="tel" />
        </div>
      </div>
    </FormGroup>
    <ModelExtensions />
  </ModelForm>;
}
