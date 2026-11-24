"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import FormLayout from "@/components/ui/form/FormLayout";
import FormGroup from "@/components/ui/form/FormGroup";
import FormMediaLayout from "@/components/ui/form/FormMediaLayout";
import FieldImage from "@/components/ui/form/FieldImage";
import FieldText from "@/components/ui/form/FieldText";
import { InsertionProvider, Inserter } from "@/components/ui/form/insertions/Insertions";
import { createSignedCloudinaryImageUploader } from "@/lib/uploads/cloudinary";
import { signSampleImage } from "./image.actions";
import { formMediaSchema, type FormMediaValues } from "./form-media.schema";

const upload = createSignedCloudinaryImageUploader(signSampleImage);
const defaults: FormMediaValues = { name: "", email: "", phone: "", notes: "", image: null };
const modules = [{ module: "sample-media", depends: [] }];

export default function FormMediaSample() {
  const methods = useForm<FormMediaValues>({ resolver: zodResolver(formMediaSchema), defaultValues: defaults });
  const [position, setPosition] = useState<"left" | "right">("left");
  const [width, setWidth] = useState<"auto" | "10rem">("auto");
  const [submitted, setSubmitted] = useState<FormMediaValues | null>(null);
  const [inserted, setInserted] = useState(false);

  return (
    <section id="form-media-layout" aria-labelledby="form-media-title" className="card min-w-0 scroll-mt-6 border border-base-300 bg-base-100 shadow-sm">
      <div className="card-body min-w-0 gap-5 p-4 sm:p-6">
        <header className="space-y-1">
          <h2 id="form-media-title" className="text-xl font-semibold">FormMediaLayout</h2>
          <p className="text-sm text-base-content/65">Imagen junto a los campos desde 32rem de ancho del componente; debajo se apila arriba. Comparte RHF y validación Zod. No guarda registros; subir la imagen usa la configuración y sesión de administrador de la demo FieldImage.</p>
        </header>
        <div className="flex flex-wrap gap-4">
          <label className="flex items-center gap-2 text-sm">Posición
            <select autoComplete="off" className="select select-sm w-auto" value={position} onChange={event => setPosition(event.target.value as "left" | "right")}>
              <option value="left">Izquierda</option><option value="right">Derecha</option>
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm">Ancho de columna
            <select autoComplete="off" className="select select-sm w-auto" value={width} onChange={event => setWidth(event.target.value as "auto" | "10rem")}>
              <option value="auto">Contenido</option><option value="10rem">10rem</option>
            </select>
          </label>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" autoComplete="off" className="checkbox checkbox-sm" checked={inserted} onChange={event => setInserted(event.target.checked)} />
          Mostrar campo insertado
        </label>
        <FormLayout methods={methods} onSubmit={setSubmitted} onInvalid={() => setSubmitted(null)} aria-labelledby="form-media-title">
          <InsertionProvider modules={modules} collectors={inserted ? { "sample-media":
            <Inserter target="media:form-media" position="inside">
              <FieldText<FormMediaValues> name="notes" label="Notas insertadas" direction="inline" maxLength={200} />
            </Inserter>
          } : {}}>
          <FormGroup legend="Datos de ejemplo" fullWidth>
            <FormMediaLayout id="form-media" position={position} mediaWidth={width} media={
              <FieldImage<FormMediaValues> name="image" widget="avatar" shape="squared" label="" aria-label="Imagen de ejemplo" upload={upload} />
            }>
              <FieldText<FormMediaValues> name="name" label="Nombre" direction="inline" required maxLength={120} />
              <FieldText<FormMediaValues> name="email" label="Correo" widget="email" direction="inline" />
              <FieldText<FormMediaValues> name="phone" label="Teléfono" widget="phone" direction="inline" maxLength={30} />
            </FormMediaLayout>
          </FormGroup>
          </InsertionProvider>
          <div className="col-span-full flex flex-wrap gap-2">
            <button type="submit" className="btn btn-primary">Validar ejemplo</button>
            <button type="button" className="btn btn-ghost" onClick={() => { methods.reset(defaults); setSubmitted(null); }}>Restablecer</button>
          </div>
          {submitted && <pre aria-live="polite" className="col-span-full overflow-x-auto whitespace-pre-wrap break-all text-xs">{JSON.stringify(submitted, null, 2)}</pre>}
        </FormLayout>
      </div>
    </section>
  );
}
