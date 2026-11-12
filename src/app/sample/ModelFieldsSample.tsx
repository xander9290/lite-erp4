"use client";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Fields } from "@/lib/orm/fields";
import FormLayout from "@/components/ui/form/FormLayout";
import FieldText from "@/components/ui/form/FieldText";
import FieldSelect from "@/components/ui/form/FieldSelect";
import FieldMany2One from "@/components/ui/form/FieldMany2One";
import ListView from "@/components/ui/list/ListView";
import { sampleVehicleLookup } from "./displayName.actions";
import type { ListResult } from "@/lib/list/types";

const fields = {
  name: Fields.Text({ label: "Nombre heredado", required: true, maxLength: 12 }),
  state: Fields.Selection([{value:"draft",label:"Borrador"},{value:"done",label:"Hecho"}], { label:"Estado heredado", required:true }),
  vehicleId: Fields.Many2one("SampleVehicle", { label:"Vehículo heredado", required:true }),
};
const schema = z.object({ name:fields.name.schema, state:fields.state.schema, vehicleId:fields.vehicleId.schema });
type Input = z.input<typeof schema>;
type Values = z.output<typeof schema>;
const model = { fields, lookups: { vehicleId: sampleVehicleLookup } };
const load = async (): Promise<ListResult> => ({ ok:true, data:{ rows:[{id:"sample",name:"Ejemplo",state:"draft"}],total:1,page:1,pageSize:25 } });
export default function ModelFieldsSample() {
  const methods = useForm<Input, unknown, Values>({ resolver:zodResolver(schema), defaultValues:{name:"",state:"draft",vehicleId:null} });
  const [saved,setSaved] = useState<Values|null>(null);
  return <section id="model-fields" className="card space-y-4 border border-base-300 bg-base-100 p-5">
    <h2 className="text-xl font-semibold">Metadatos del modelo y columnas JSX</h2>
    <p className="text-sm">Ejemplo ficticio sin persistencia. Los controles heredan etiqueta, obligatoriedad, longitud, opciones y lookup. La etiqueta personalizada conserva prioridad; Zod sigue validando los datos.</p>
    <FormLayout methods={methods} model={model} onSubmit={setSaved}>
      <FieldText<Input> name="name" direction="inline" />
      <FieldSelect<Input> name="state" label="Estado personalizado" direction="inline" />
      <FieldMany2One<Input> name="vehicleId" direction="inline" />
      <button type="submit" className="btn btn-primary">Validar</button>
    </FormLayout>
    {saved && <pre>{JSON.stringify(saved,null,2)}</pre>}
    <div className="h-80"><ListView model="SampleContract" title="Columnas desde Fields" fields={fields} load={load} create={false} delete={false} paramPrefix="metadata">
      <ListView.Field name="name" label="Nombre en la lista" />
      <ListView.Field name="state" />
    </ListView></div>
  </section>;
}
