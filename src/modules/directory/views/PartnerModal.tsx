"use client";

import ModelForm, { ModelExtensions } from "@/components/modules/ModelForm";
import FormGroup from "@/components/ui/form/FormGroup";
import Stack from "@/components/ui/form/Stack";
import FieldText from "@/components/ui/form/FieldText";
import FieldSelect from "@/components/ui/form/FieldSelect";
import FieldMany2One from "@/components/ui/form/FieldMany2One";
import type { ModelClientConfig } from "@/lib/modules/config";
import type { FormValues } from "@/lib/orm/model";
import type { Partner } from "../models/partner";

type Values = FormValues<typeof Partner>;

export default function PartnerModal({ config, id }: { config: ModelClientConfig; id?: string }) {
  return (
    <ModelForm config={config} id={id} density="compact">
      <FormGroup id="contact" legend="Datos del contacto" fullWidth>
        <FieldMany2One<Values> name="parentId" direction="inline" readOnly clearable={false} />

        <Stack>
          <FieldSelect<Values> name="type" />
          <FieldSelect<Values> name="partnerType" />
        </Stack>

        <FieldText<Values> name="name" direction="inline" />
        <FieldText<Values> name="emails" direction="inline" />
        <FieldText<Values> name="phones" direction="inline" widget="phone" />
      </FormGroup>

      <FormGroup id="address" legend="Dirección" fullWidth>
        <FieldText<Values> name="street" direction="inline" />

        <Stack>
          <FieldText<Values> name="streetNumber" />
          <FieldText<Values> name="unitNumber" />
          <FieldText<Values> name="zipNumber" label="C.P." />
        </Stack>

        <FieldText<Values> name="crossStreets" direction="inline" />

        <Stack>
          <FieldMany2One<Values> name="countryId" />
          <FieldMany2One<Values> name="provinceId" />
          <FieldMany2One<Values> name="countyId" />
          <FieldMany2One<Values> name="townId" />
        </Stack>
      </FormGroup>

      <ModelExtensions />
    </ModelForm>
  );
}
