"use client";

import ModelForm, { ModelExtensions } from "@/components/modules/ModelForm";
import FormGroup from "@/components/ui/form/FormGroup";
import FieldBoolean from "@/components/ui/form/FieldBoolean";
import FieldImage from "@/components/ui/form/FieldImage";
import FieldSelect from "@/components/ui/form/FieldSelect";
import FieldText from "@/components/ui/form/FieldText";
import type { ModelClientConfig } from "@/lib/modules/config";
import type { FormValues } from "@/lib/orm/model";
import type { Partner } from "../models/partner";
import Stack from "@/components/ui/form/Stack";
import Notebook from "@/components/ui/form/Notebook";
import NotebookPage from "@/components/ui/form/NotebookPage";
import FieldMany2One from "@/components/ui/form/FieldMany2One";

type Values = FormValues<typeof Partner>;

/**
 * Vista expulsada con eject:view: edita libremente la maquetación.
 * ModelForm aporta carga, guardado, recarga, breadcrumbs, historial y eliminación.
 */
export default function PartnerForm({ config, id }: { config: ModelClientConfig; id?: string }) {
  return (
    <ModelForm config={config} id={id}>
      <div className="col-span-full">
        <FieldText name="name" widget="header" />
      </div>
      <FormGroup legend="Datos personales" id="contact">
        <FieldImage<Values> name="image" widget="avatar" shape="squared" label="" />
        <FieldSelect<Values> name="partnerType" direction="inline" type="optional" label="" />
        <FieldText<Values> name="name" direction="inline" />
        <FieldText<Values> name="emails" direction="inline" />
        <FieldText<Values> name="phones" direction="inline" widget="phone" />
        <Stack id="fiscalData">
          <FieldText<Values> name="vat" direction="inline" />
          <FieldText<Values> name="curp" direction="inline" />
        </Stack>
      </FormGroup>
      <FormGroup legend="Dirección" id="address">
        <FieldText<Values> name="street" direction="inline" />
        <Stack>
          <FieldText<Values> name="streetNumber" direction="inline" className="text-end" />
          <FieldText<Values> name="unitNumber" direction="inline" className="text-end" />
          <FieldText<Values> name="zipNumber" direction="inline" label="C.P." className="text-center" />
        </Stack>
        <FieldText<Values> name="crossStreets" direction="inline" />
        <Stack>
          <FieldMany2One name="countryId" />
          <FieldMany2One name="provinceId" />
          <FieldMany2One name="countyId" />
          <FieldMany2One name="townId" />
        </Stack>
      </FormGroup>
      <Notebook>
        <NotebookPage name="otherInfo" label="Otra información" className="p-2">
          <FormGroup>
            <Stack>
              <FieldSelect<Values> name="type" direction="inline" />
              <FieldBoolean<Values> name="active" direction="inline" />
            </Stack>
          </FormGroup>
        </NotebookPage>
      </Notebook>
      {/* Campos que otros módulos añaden a este modelo (extensiones). */}
      <ModelExtensions />
    </ModelForm>
  );
}
