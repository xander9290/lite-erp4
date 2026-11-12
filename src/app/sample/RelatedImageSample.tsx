"use client";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import FormLayout from "@/components/ui/form/FormLayout";
import FieldMany2One from "@/components/ui/form/FieldMany2One";
import FieldImage from "@/components/ui/form/FieldImage";
import type { ReactionRule } from "@/lib/orm/reactions.types";
import { relatedImageFields, relatedImageReadFields, relatedImageSchema, type RelatedImageInput, type RelatedImageValues } from "./related-image.contract";
import { lookupRelatedImage, reactRelatedImage } from "./related-image.actions";

export default function RelatedImageSample({rules}:{rules:readonly ReactionRule[]}) {
  const methods=useForm<RelatedImageInput,unknown,RelatedImageValues>({resolver:zodResolver(relatedImageSchema),defaultValues:{modelId:"with-photo"}});
  const [result,setResult]=useState("");
  const [model]=useState(()=>({fields:relatedImageFields,readFields:relatedImageReadFields,lookups:{modelId:lookupRelatedImage},reactions:{rules,load:reactRelatedImage}}));
  return <section id="related-image" className="card space-y-4 border border-base-300 bg-base-100 p-5">
    <h2 className="text-xl font-semibold">Imagen relacionada · sólo lectura</h2>
    <p>Datos ficticios sin persistencia. El servidor resuelve la imagen; el formulario sólo guarda el ID seleccionado. La imagen de demostración es pública de Cloudinary.</p>
    <FormLayout methods={methods} model={model} onSubmit={values=>setResult(JSON.stringify(values))}>
      <FieldMany2One<RelatedImageInput> name="modelId" direction="inline" />
      <FieldImage mode="display" name="photo" widget="avatar" shape="squared" direction="inline" />
      <button type="submit" className="btn btn-primary">Validar payload</button>
      <button type="button" className="btn btn-ghost" onClick={()=>methods.reset({modelId:"without-photo"})}>Cargar modelo sin imagen</button>
    </FormLayout>
    <output>{result}</output>
  </section>;
}
