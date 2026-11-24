"use client";

import ModelForm, { ModelExtensions } from "@/components/modules/ModelForm";
import FormGroup from "@/components/ui/form/FormGroup";
import FormMediaLayout from "@/components/ui/form/FormMediaLayout";
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
import FieldRelationTag from "@/components/ui/form/FieldRelationTag";

type Values = FormValues<typeof Partner>;

/**
 * Vista expulsada con eject:view: edita libremente la maquetación.
 * ModelForm aporta carga, guardado, recarga, breadcrumbs, historial y eliminación.
 */
export default function PartnerForm({
  config,
  id,
}: {
  config: ModelClientConfig;
  id?: string;
}) {
  return (
    <ModelForm config={config} id={id} density="compact">
      {/* <div className="col-span-full">
        <FieldText name="name" widget="header" />
      </div> */}
      <FormGroup legend="Datos personales" id="contact">
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
          <FieldSelect<Values>
            name="partnerType"
            direction="inline"
            type="optional"
            label=""
          />
          <FieldText<Values> name="name" direction="inline" />
          <FieldText<Values> name="emails" direction="inline" />
          <FieldText<Values> name="phones" direction="inline" widget="phone" />
        </FormMediaLayout>
        <Stack id="fiscalData">
          <FieldText<Values> name="vat" direction="inline" />
          <FieldText<Values> name="curp" direction="inline" />
        </Stack>
        <FieldRelationTag<Values> name="activityIds" direction="inline" />
        <FieldRelationTag<Values> name="tagIds" direction="inline" />
      </FormGroup>
      <FormGroup legend="Dirección" id="address">
        <FieldText<Values> name="street" direction="inline" />
        <Stack>
          <FieldText<Values>
            name="streetNumber"
            direction="inline"
            className="text-end"
          />
          <FieldText<Values>
            name="unitNumber"
            direction="inline"
            className="text-end"
          />
          <FieldText<Values>
            name="zipNumber"
            direction="inline"
            label="C.P."
            className="text-center"
          />
        </Stack>
        <FieldText<Values> name="crossStreets" direction="inline" />
        <Stack>
          <FieldMany2One<Values> name="countryId" />
          <FieldMany2One<Values> name="provinceId" />
          <FieldMany2One<Values> name="countyId" />
          <FieldMany2One<Values> name="townId" />
        </Stack>
      </FormGroup>
      <Notebook defaultPage="otherAddresses" id="additionalInfo">
        <NotebookPage
          label="Otras direcciones"
          name="otherAddresses"
          className="p-2"
        >
          <FormGroup>
            <h2>En construcción</h2>
          </FormGroup>
        </NotebookPage>
        <NotebookPage label="Ventas" name="sales" className="p-2">
          <FormGroup id="saleInfo">
            <FieldMany2One<Values> name="saleUserId" direction="inline" />
          </FormGroup>
        </NotebookPage>
        <NotebookPage label="Compras" name="purchase" className="p-2">
          <FormGroup id="purchaseInfo">
            <FieldMany2One<Values> name="purchaseUserId" direction="inline" />
          </FormGroup>
        </NotebookPage>
        <NotebookPage name="otherInfo" label="Otra información" className="p-2">
          <FormGroup id="ohterInfoGeneral">
            <Stack>
              <FieldSelect<Values> name="type" direction="inline" />
              <FieldMany2One<Values> name="parentId" />
              <FieldBoolean<Values>
                name="active"
                direction="inline"
                invisible
              />
            </Stack>
          </FormGroup>
        </NotebookPage>
      </Notebook>
      {/* Campos que otros módulos añaden a este modelo (extensiones). */}
      <ModelExtensions />
    </ModelForm>
  );
}
