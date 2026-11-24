"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import FormView from "@/components/ui/form/FormView";
import FormGroup from "@/components/ui/form/FormGroup";
import FormMediaLayout from "@/components/ui/form/FormMediaLayout";
import Stack from "@/components/ui/form/Stack";
import Notebook from "@/components/ui/form/Notebook";
import NotebookPage from "@/components/ui/form/NotebookPage";
import FieldText from "@/components/ui/form/FieldText";
import FieldNumber from "@/components/ui/form/FieldNumber";
import FieldDate from "@/components/ui/form/FieldDate";
import FieldSelect from "@/components/ui/form/FieldSelect";
import FieldBoolean from "@/components/ui/form/FieldBoolean";
import FieldImage from "@/components/ui/form/FieldImage";
import FieldMany2One from "@/components/ui/form/FieldMany2One";
import FieldRelationTag from "@/components/ui/form/FieldRelationTag";
import type { FormDensity } from "@/components/ui/form/formDensity";
import type { Many2OneLoader } from "@/lib/many2one/model-lookup";
import { formDensitySchema, type FormDensityValues } from "./form-density.schema";

const options = ["México", "Colombia", "España"].map((label, index) => ({ value: `demo-${index}`, label, record: { id: `demo-${index}` } }));
const load: Many2OneLoader = async request => {
  const matches = options.filter(option => request.id ? option.value === request.id : request.ids ? request.ids.includes(option.value) : option.label.toLocaleLowerCase().includes((request.query ?? "").toLocaleLowerCase()));
  const page = request.page ?? 1, pageSize = request.pageSize ?? 5;
  return { ok: true, items: matches.slice((page - 1) * pageSize, page * pageSize), total: matches.length, page, pageSize };
};
const defaults: FormDensityValues = { name: "Contacto de ejemplo", email: "", type: "person", category: "customer", quantity: 1, date: null, active: true, countryId: null, tagIds: [], notes: "", image: null };

export default function FormDensitySample() {
  const [density, setDensity] = useState<FormDensity>("compact");
  const [saved, setSaved] = useState<FormDensityValues | null>(null);
  const methods = useForm<FormDensityValues>({ resolver: zodResolver(formDensitySchema), defaultValues: defaults });
  return <section id="form-density" className="card min-w-0 scroll-mt-6 space-y-4 border border-base-300 bg-base-100 p-4 sm:p-6">
    <h2 className="text-xl font-semibold">Densidad del formulario</h2>
    <p className="text-sm text-base-content/65">Compara normal y compact sin perder el borrador. Compact usa controles de 32px, separación de 8px y grupos con padding de 12px. Demo RHF/Zod sin persistencia ni subidas; la imagen se muestra sólo como referencia visual.</p>
    <label className="flex items-center gap-2 text-sm">Densidad
      <select aria-label="Densidad del formulario" autoComplete="off" className="select select-sm w-auto" value={density} onChange={event => setDensity(event.target.value as FormDensity)}>
        <option value="normal">Normal</option><option value="compact">Compacta</option>
      </select>
    </label>
    <FormView title="Ejemplo de densidad" methods={methods} density={density} mode="create" saveLabel="Validar ejemplo"
      onSubmit={values => { setSaved(values); return { ok: true, values, message: "Ejemplo validado sin persistencia." }; }}>
      <FormGroup legend="Datos personales">
        <FormMediaLayout media={<FieldImage<FormDensityValues> name="image" widget="avatar" label="" readOnly />}>
          <FieldSelect<FormDensityValues> name="type" label="" aria-label="Tipo de contacto" type="optional" options={[{ value: "person", label: "Persona" }, { value: "company", label: "Empresa" }]} />
          <FieldText<FormDensityValues> name="name" label="Nombre" direction="inline" required maxLength={120} />
          <FieldText<FormDensityValues> name="email" label="Correo" widget="email" direction="inline" />
        </FormMediaLayout>
        <FieldRelationTag<FormDensityValues> name="tagIds" label="Etiquetas" load={load} direction="inline" maxSelected={5} />
      </FormGroup>
      <FormGroup legend="Opciones">
        <FieldSelect<FormDensityValues> name="category" label="Categoría" direction="inline" options={[{ value: "customer", label: "Cliente" }, { value: "supplier", label: "Proveedor" }]} />
        <Stack>
          <FieldNumber<FormDensityValues> name="quantity" label="Cantidad" type="integer" />
          <FieldDate<FormDensityValues> name="date" label="Fecha" />
        </Stack>
        <FieldMany2One<FormDensityValues> name="countryId" label="País" load={load} direction="inline" />
        <FieldBoolean<FormDensityValues> name="active" label="Activo" direction="inline" />
      </FormGroup>
      <Notebook label="Información adicional">
        <NotebookPage name="notes" label="Notas">
          <FormGroup fullWidth><FieldText<FormDensityValues> name="notes" label="Notas" widget="long" maxLength={500} /></FormGroup>
        </NotebookPage>
      </Notebook>
    </FormView>
    {saved && <pre aria-live="polite" className="overflow-x-auto whitespace-pre-wrap break-all text-xs">{JSON.stringify(saved, null, 2)}</pre>}
  </section>;
}
