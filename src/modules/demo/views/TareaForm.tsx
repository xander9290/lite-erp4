"use client";

import ModelForm from "@/components/modules/ModelForm";
import FormGroup from "@/components/ui/form/FormGroup";
import FieldDate from "@/components/ui/form/FieldDate";
import FieldMany2One from "@/components/ui/form/FieldMany2One";
import FieldNumber from "@/components/ui/form/FieldNumber";
import FieldSelect from "@/components/ui/form/FieldSelect";
import FieldText from "@/components/ui/form/FieldText";
import type { ModelClientConfig } from "@/lib/modules/config";
import type { FormValues } from "@/lib/orm/model";
import type { Tarea } from "../models/tarea";

type Values = FormValues<typeof Tarea>;

/**
 * Vista expulsada con eject:view: edita libremente la maquetación.
 * ModelForm aporta carga, guardado, recarga, breadcrumbs, historial y eliminación.
 */
export default function TareaForm({ config, id }: { config: ModelClientConfig; id?: string }) {
  return (
    <ModelForm config={config} id={id}>
      <FormGroup legend="Tarea">
        <FieldText<Values> name="name" direction="inline" />
        <FieldMany2One<Values> name="categoria" direction="inline" />
      </FormGroup>
      <FormGroup legend="Planificación">
        <FieldSelect<Values> name="estado" direction="inline" />
        <FieldNumber<Values> name="prioridad" type="integer" direction="inline" />
        <FieldDate<Values> name="vence" type="datetime" direction="inline" />
      </FormGroup>
    </ModelForm>
  );
}
