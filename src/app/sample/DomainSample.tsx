"use client";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import FieldMany2One from "@/components/ui/form/FieldMany2One";
import FieldRelationTag from "@/components/ui/form/FieldRelationTag";
import FormLayout from "@/components/ui/form/FormLayout";
import type { FormModel } from "@/components/ui/form/modelFields";
import { domainSampleFields as fields, domainSampleMany as many2many, recordDomainSampleFields } from "./domain.sample-contract";
import { sampleDomainLookup, sampleRecordDomainLookup } from "./domain.actions";
import { domainDependencies, domainUsesRecordId } from "@/lib/orm/domain-builder";

const schema = z.strictObject({ paisId: fields.paisId.schema, estadoId: fields.estadoId.schema, estados: many2many.estados.schema });
type Values = z.input<typeof schema>;
const model: FormModel = { fields, many2many,
  lookups: { paisId: request => sampleDomainLookup("pais", request), estadoId: request => sampleDomainLookup("estado", request), estados: request => sampleDomainLookup("estado", request) },
  domainLookups: Object.fromEntries(["estadoId", "estados"].map(field => [field, { dependencies: ["paisId"], load: (request, draft) => sampleDomainLookup("estado", request, draft) } satisfies NonNullable<FormModel["domainLookups"]>[string]])),
};
export default function DomainSample() {
  const methods = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { paisId: "mx", estadoId: "jal", estados: ["yuc"] } });
  const [saved, setSaved] = useState<unknown>(null);
  return <section id="domains" className="card min-w-0 space-y-4 border border-base-300 bg-base-100 p-5">
    <h2 className="text-xl font-semibold">Dominios de relaciones</h2>
    <p className="text-sm">Datos ficticios, sin persistencia. Cambia País: ambos buscadores ofrecen sólo sus estados. Las selecciones incompatibles se conservan y avisan; puedes corregirlas. Sin país no hay candidatos.</p>
    <FormLayout methods={methods} model={model} onSubmit={setSaved}>
      <FieldMany2One name="paisId" />
      <FieldMany2One name="estadoId" />
      <FieldRelationTag name="estados" />
      <button type="submit" className="btn btn-primary">Validar</button>
      <button type="button" className="btn btn-ghost" onClick={() => methods.reset({ paisId: "ca", estadoId: "jal", estados: ["yuc"] })}>Cargar selección incompatible</button>
    </FormLayout>
    {saved !== null && <pre className="overflow-auto text-xs">{JSON.stringify(saved, null, 2)}</pre>}
    <RecordDomainSample />
  </section>;
}

const recordSchema = z.strictObject({ id: z.string().optional(), parentId: recordDomainSampleFields.parentId.schema });
const recordDomain = recordDomainSampleFields.parentId.metadata;
const recordModel: FormModel = {
  fields: recordDomainSampleFields,
  domainLookups: {
    parentId: {
      dependencies: recordDomain.kind === "many2one" && recordDomain.domain ? domainDependencies(recordDomain.domain) : [],
      usesRecordId: recordDomain.kind === "many2one" && recordDomain.domain ? domainUsesRecordId(recordDomain.domain) : false,
      load: (request, _draft, record) => sampleRecordDomainLookup(request, record),
    },
  },
};

function RecordDomainSample() {
  const methods = useForm<z.input<typeof recordSchema>>({ resolver: zodResolver(recordSchema), defaultValues: { id: "contact-a", parentId: null } });
  const id = useWatch({ control: methods.control, name: "id" });
  const [saved, setSaved] = useState<unknown>(null);
  return <div id="record-domain" className="space-y-3 border-t border-base-300 pt-5">
    <h3 className="font-semibold">Excluir el registro actual · d.record.id</h3>
    <p className="text-sm">{id ? "Editando Contacto A: el buscador ofrece B y C." : "Nuevo contacto: el buscador ofrece A, B y C."} Identidad ficticia separada de los campos del dominio; sin persistencia.</p>
    <FormLayout methods={methods} model={recordModel} onSubmit={setSaved}>
      <FieldMany2One name="parentId" />
      <button type="submit" className="btn btn-primary btn-sm">Validar selección</button>
      <button type="button" className="btn btn-ghost btn-sm" onClick={() => { methods.reset(id ? { parentId: null } : { id: "contact-a", parentId: null }); setSaved(null); }}>{id ? "Probar nuevo contacto" : "Editar Contacto A"}</button>
    </FormLayout>
    {saved !== null && <pre className="overflow-auto text-xs">{JSON.stringify(saved, null, 2)}</pre>}
  </div>;
}
