"use client";

import ModelForm, { ModelExtensions, ModelChildCollections } from "@/components/modules/ModelForm";
import FormGroup from "@/components/ui/form/FormGroup";
import FieldImage from "@/components/ui/form/FieldImage";
import FieldMany2One from "@/components/ui/form/FieldMany2One";
import FieldRelationTag from "@/components/ui/form/FieldRelationTag";
import FieldSelect from "@/components/ui/form/FieldSelect";
import FieldText from "@/components/ui/form/FieldText";
import type { ModelClientConfig } from "@/lib/modules/config";


type Values = Record<string, unknown>;

/**
 * Vista expulsada con eject:view: edita libremente la maquetación.
 * Vista modal independiente: ModelForm conserva carga, guardado, permisos y cierre protegido.
 */
export default function CorePartnerModal({ config, id }: { config: ModelClientConfig; id?: string }) {
  return (
    <ModelForm config={config} id={id}>
      <FormGroup id="general" legend="Datos generales">
        <FieldText<Values> name="name" direction="inline" />
        <FieldText<Values> name="email" direction="inline" />
        <FieldText<Values> name="phone" direction="inline" />
        <FieldImage<Values> name="avatarUrl" widget="avatar" />
        <FieldText<Values> name="street" direction="inline" />
        <FieldText<Values> name="exteriorNumber" direction="inline" />
        <FieldText<Values> name="interiorNumber" direction="inline" />
        <FieldText<Values> name="zip" direction="inline" />
        <FieldText<Values> name="vat" direction="inline" />
        <FieldText<Values> name="curp" direction="inline" />
        <FieldMany2One<Values> name="paisId" direction="inline" />
        <FieldMany2One<Values> name="estadoId" direction="inline" />
        <FieldMany2One<Values> name="municipioId" direction="inline" />
        <FieldMany2One<Values> name="localidadId" direction="inline" />
        <FieldMany2One<Values> name="saleUserId" direction="inline" />
        <FieldMany2One<Values> name="purchaseUserId" direction="inline" />
        <FieldSelect<Values> name="partnerType" direction="inline" />
        <FieldMany2One<Values> name="parentId" direction="inline" />
        <FieldRelationTag<Values> name="tagIds" direction="inline" />
      </FormGroup>
      {/* Campos que otros módulos añaden a este modelo (extensiones). */}
      <ModelExtensions excludeFields={["name","email","phone","avatarUrl","street","exteriorNumber","interiorNumber","zip","vat","curp","paisId","estadoId","municipioId","localidadId","saleUserId","purchaseUserId","partnerType","parentId","tagIds"]} />
      <ModelChildCollections name="childIds" openIn="modal" />

    </ModelForm>
  );
}
