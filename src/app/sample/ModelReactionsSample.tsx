"use client";
import { useContext,useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { ReactionRule } from "@/lib/orm/reactions.types";
import FormLayout from "@/components/ui/form/FormLayout";
import FieldText from "@/components/ui/form/FieldText";
import FieldNumber from "@/components/ui/form/FieldNumber";
import { FormModelContext } from "@/components/ui/form/modelFields";
import { ModelReactionStatus } from "@/components/ui/form/ModelPreviewImage";
import { sampleReactionFields,sampleReactionSchema,type SampleReactionInput,type SampleReactionValues } from "./reaction-contract";
import { sampleOnchange,validateReactionExample } from "./reactions.actions";
function Total(){const model=useContext(FormModelContext);return <output>Total calculado: {model?.reactionState?.preview.total??"…"}</output>;}
export default function ModelReactionsSample({rules}:{rules:readonly ReactionRule[]}){
  const methods=useForm<SampleReactionInput,unknown,SampleReactionValues>({resolver:zodResolver(sampleReactionSchema),defaultValues:{name:null,quantity:1,unitPrice:10}});
  const [message,setMessage]=useState("");
  // Stable configuration is intentional: don't recreate the reaction engine on every render.
  const [model]=useState(()=>({fields:sampleReactionFields,reactions:{rules,load:sampleOnchange}}));
  return <section id="model-reactions" className="card space-y-4 border border-base-300 bg-base-100 p-5">
    <h2 className="text-xl font-semibold">Onchange, cálculos y restricciones</h2>
    <p className="text-sm">Datos ficticios sin persistencia ni acceso a BD. Código se transforma a mayúsculas mediante registro explícito; @depends calcula el total. @constraint valida el total al pulsar Validar. Ninguna reacción guarda datos.</p>
    <FormLayout methods={methods} model={model} onSubmit={async values=>{const result=await validateReactionExample(values);setMessage(result.ok?"Validado sin guardar.":result.error);}}>
      <FieldText<SampleReactionInput> name="name" direction="inline" />
      <FieldNumber<SampleReactionInput> name="quantity" type="integer" direction="inline" />
      <FieldNumber<SampleReactionInput> name="unitPrice" type="integer" direction="inline" />
      <Total /><ModelReactionStatus />
      <button type="submit" className="btn btn-primary">Validar</button>
      <button type="button" className="btn btn-ghost" onClick={()=>methods.reset({name:null,quantity:1,unitPrice:10})}>Revertir</button>
    </FormLayout>
    <p role="status">{message}</p>
  </section>;
}
