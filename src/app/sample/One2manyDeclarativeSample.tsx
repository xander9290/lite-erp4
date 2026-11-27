"use client";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import FormView from "@/components/ui/form/FormView";
import FormGroup from "@/components/ui/form/FormGroup";
import FieldText from "@/components/ui/form/FieldText";
import FieldOne2many from "@/components/ui/form/FieldOne2many";
import { declarativeLinesModel, declarativeLinesSchema, type DeclarativeLinesInput } from "./one2many-declarative.schema";

export default function One2manyDeclarativeSample() {
  const methods=useForm<DeclarativeLinesInput>({resolver:zodResolver(declarativeLinesSchema),defaultValues:{name:"DOC-DEMO",lineas:[{id:"demo-linea-1",revision:"2026-11-15T18:00:00.000Z",name:"Cambio de aceite",fecha:"2026-11-15T18:00:00.000Z",kilometraje:20000}]}});
  return <section id="one2many-model" className="min-w-0 scroll-mt-6 space-y-3" aria-labelledby="one2many-model-title">
    <div className="px-1"><h2 id="one2many-model-title" className="text-xl font-semibold">Líneas con columnas declaradas</h2><p className="mt-1 text-sm text-base-content/60">Los controles heredan labels, tipos y validación del contrato del hijo.</p></div>
    <FormView methods={methods} model={declarativeLinesModel} title="Documento de demostración" width="wide" saveLabel="Validar ejemplo" onSubmit={async values=>({ok:true,values,message:"Ejemplo validado. No se guardó en base de datos."})} footer={<p className="text-xs text-base-content/60">Demo local con RHF y Zod, sin persistencia. Agregar, quitar y revertir actúan sobre el borrador. Los módulos declarativos guardan el documento y sus líneas en la transacción del servidor.</p>}>
      <FormGroup legend="Documento" fullWidth><FieldText name="name" /></FormGroup>
      <FormGroup legend="Líneas" fullWidth><FieldOne2many name="lineas">
        <FieldOne2many.Column name="name" widget="long" />
        <FieldOne2many.Column name="fecha" readOnly={row=>Boolean(row.id)} />
        <FieldOne2many.Column name="kilometraje" align="right" />
      </FieldOne2many></FormGroup>
      <p className="col-span-full px-1 text-xs text-base-content/60">La fecha es de sólo lectura en líneas ya guardadas (con ID) mediante <code>readOnly</code> por fila; en las líneas nuevas se edita. <code>invisible</code> retira una columna sin borrar su valor del borrador.</p>
    </FormView>
  </section>;
}
