"use client";

import ModelForm, { ModelExtensions } from "@/components/modules/ModelForm";
import FormGroup from "@/components/ui/form/FormGroup";
import FieldBoolean from "@/components/ui/form/FieldBoolean";
import FieldImage from "@/components/ui/form/FieldImage";
import FieldMany2One from "@/components/ui/form/FieldMany2One";
import FieldText from "@/components/ui/form/FieldText";
import type { ModelClientConfig } from "@/lib/modules/config";
import type { FormValues } from "@/lib/orm/model";
import type { Company } from "../models/company";
import FormMediaLayout from "@/components/ui/form/FormMediaLayout";
import Notebook from "@/components/ui/form/Notebook";
import NotebookPage from "@/components/ui/form/NotebookPage";
import Stack from "@/components/ui/form/Stack";

type Values = FormValues<typeof Company>;

/**
 * Vista expulsada con eject:view: edita libremente la maquetación.
 * ModelForm aporta carga, guardado, recarga, breadcrumbs, historial y eliminación.
 */
export default function CompanyForm({
  config,
  id,
}: {
  config: ModelClientConfig;
  id?: string;
}) {
  return (
    <ModelForm config={config} id={id}>
      <FormGroup id="companyName" fullWidth>
        <FormMediaLayout
          media={
            <FieldImage<Values>
              name="image"
              widget="avatar"
              shape="squared"
              label=""
            />
          }
          id="formMedia"
        >
          <FieldText<Values> name="name" direction="inline" />
          <FieldText<Values> name="code" direction="inline" />
        </FormMediaLayout>
      </FormGroup>

      <Notebook defaultPage="generalInfo">
        <NotebookPage
          label="Información general"
          name="generalInfoPage"
          className="p-1"
        >
          <FormGroup id="groupLocation">
            <FieldText<Values> name="street" direction="inline" />
            <Stack id="streetNumbers">
              <FieldText<Values> name="streetNumber" direction="inline" />
              <FieldText<Values> name="unitNumber" direction="inline" />
              <FieldText<Values> name="zipNumber" direction="inline" />
            </Stack>
            <Stack id="stackLocation">
              <FieldMany2One<Values> name="countryId" direction="inline" />
              <FieldMany2One<Values> name="provinceId" direction="inline" />
              <FieldMany2One<Values> name="countyId" direction="inline" />
              <FieldMany2One<Values> name="townId" direction="inline" />
            </Stack>
          </FormGroup>
          <FormGroup id="generalInfoGroup1">
            <FieldText<Values> name="email" direction="inline" />
            <FieldText<Values> name="phone" direction="inline" />
            <FieldText<Values> name="vat" direction="inline" />
            <FieldMany2One<Values> name="parentId" direction="inline" />
            <FieldBoolean<Values> name="active" direction="inline" />
          </FormGroup>
        </NotebookPage>
      </Notebook>
      {/* Campos que otros módulos añaden a este modelo (extensiones). */}
      <ModelExtensions />
    </ModelForm>
  );
}
