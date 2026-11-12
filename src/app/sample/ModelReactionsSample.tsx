"use client";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { ReactionRule } from "@/lib/orm/reactions.types";
import FormLayout from "@/components/ui/form/FormLayout";
import FieldText from "@/components/ui/form/FieldText";
import FieldNumber from "@/components/ui/form/FieldNumber";
import { sampleReactionFields,sampleReactionSchema,type SampleReactionInput,type SampleReactionValues } from "./reaction-contract";
import { sampleOnchange,validateReactionExample } from "./reactions.actions";
import { Fields } from "@/lib/orm/fields";
const readFields={total:Fields.Integer({label:"Total calculado",required:true}),description:Fields.Text({label:"Resumen"})};
export default function ModelReactionsSample({rules}:{rules:readonly ReactionRule[]}){
  const methods=useForm<SampleReactionInput,unknown,SampleReactionValues>({resolver:zodResolver(sampleReactionSchema),defaultValues:{name:null,quantity:1,unitPrice:10}});
  const [message,setMessage]=useState("");
  // Stable configuration is intentional: don't recreate the reaction engine on every render.
  const [model]=useState(()=>({fields:sampleReactionFields,readFields,reactions:{rules,load:sampleOnchange}}));
  return <section id="model-reactions" className="card space-y-4 border border-base-300 bg-base-100 p-5">
    <h2 className="text-xl font-semibold">Onchange, cálculos y restricciones</h2>
    <p className="text-sm">Datos ficticios sin persistencia ni acceso a BD. Código se transforma a mayúsculas; dos métodos @depends calculan total y resumen en el servidor. Sus Fields display no se incluyen en el payload. @constraint valida el total al pulsar Validar.</p>
    <FormLayout methods={methods} model={model} onSubmit={async values=>{const result=await validateReactionExample(values);setMessage(result.ok?`Validado sin guardar. Payload: ${JSON.stringify(values)}`:result.error);}}>
      <FieldText<SampleReactionInput> name="name" direction="inline" />
      <FieldNumber<SampleReactionInput> name="quantity" type="integer" direction="inline" />
      <FieldNumber<SampleReactionInput> name="unitPrice" type="integer" direction="inline" />
      <FieldNumber mode="display" name="total" type="integer" direction="inline" />
      <FieldText mode="display" name="description" direction="inline" />
      <button type="submit" className="btn btn-primary">Validar</button>
      <button type="button" className="btn btn-ghost" onClick={()=>methods.reset({name:null,quantity:1,unitPrice:10})}>Revertir</button>
    </FormLayout>
    <p role="status">{message}</p>
    <p className="text-xs">Campos editables: {Object.keys(methods.getValues()).join(", ")}</p>
  </section>;
}
