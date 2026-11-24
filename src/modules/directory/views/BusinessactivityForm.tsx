"use client";

import ModelForm, { ModelExtensions } from "@/components/modules/ModelForm";
import FormGroup from "@/components/ui/form/FormGroup";
import FieldBoolean from "@/components/ui/form/FieldBoolean";
import FieldMany2One from "@/components/ui/form/FieldMany2One";
import FieldText from "@/components/ui/form/FieldText";
import type { ModelClientConfig } from "@/lib/modules/config";
import type { FormValues } from "@/lib/orm/model";
import type { BusinessActivity } from "../models/businessactivity";

type Values = FormValues<typeof BusinessActivity>;

/**
 * Vista expulsada con eject:view: edita libremente la maquetación.
 * ModelForm aporta carga, guardado, recarga, breadcrumbs, historial y eliminación.
 */
export default function BusinessactivityForm({
  config,
  id,
}: {
  config: ModelClientConfig;
  id?: string;
}) {
  return (
    <ModelForm config={config} id={id} density="compact">
      <div className="col-span-full">
        <FieldText<Values> name="name" widget="header" />
      </div>
      <FormGroup legend="Datos generales">
        <FieldText<Values> name="name" direction="inline" />
        <FieldText<Values> name="description" direction="inline" />
        <FieldText<Values> name="code" direction="inline" />
        <FieldMany2One<Values> name="parentId" direction="inline" />
        <FieldBoolean<Values> name="active" direction="inline" />
      </FormGroup>
      {/* Campos que otros módulos añaden a este modelo (extensiones). */}
      <ModelExtensions />
    </ModelForm>
  );
}
