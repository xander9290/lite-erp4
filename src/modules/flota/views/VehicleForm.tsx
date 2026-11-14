"use client";

import ModelForm from "@/components/modules/ModelForm";
import FormGroup from "@/components/ui/form/FormGroup";
import FieldBoolean from "@/components/ui/form/FieldBoolean";
import FieldImage from "@/components/ui/form/FieldImage";
import FieldMany2One from "@/components/ui/form/FieldMany2One";
import FieldText from "@/components/ui/form/FieldText";
import type { ModelClientConfig } from "@/lib/modules/config";
import type { FormValues } from "@/lib/orm/model";
import type { Vehicle } from "../models/vehicle";
import Stack from "@/components/ui/form/Stack";

type Values = FormValues<typeof Vehicle>;

/**
 * Vista expulsada con eject:view: edita libremente la maquetación.
 * ModelForm aporta carga, guardado, recarga, breadcrumbs, historial y eliminación.
 */
export default function VehicleForm({ config, id }: { config: ModelClientConfig; id?: string }) {
  return (
    <ModelForm config={config} id={id}>
      <div className="col-span-full flex flex-wrap items-center gap-4">
        <FieldImage mode="display" name="fabricanteLogo" widget="avatar" shape="squared" label="" />
        <div className="min-w-0 flex-1">
          <FieldText<Values> name="name" widget="header" />
        </div>
      </div>
      <FormGroup legend="Datos generales">
        <Stack>
          <FieldText<Values> name="plate" />
          <FieldMany2One<Values> name="modeloId" />
        </Stack>
        <FieldBoolean<Values> name="active" direction="inline" />
      </FormGroup>
    </ModelForm>
  );
}
