"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import FieldImage from "@/components/ui/form/FieldImage";
import FormLayout from "@/components/ui/form/FormLayout";
import FormGroup from "@/components/ui/form/FormGroup";
import { createCloudinaryImageUploader } from "@/lib/uploads/cloudinary";
import { imageSampleSchema, type ImageSampleInput, type ImageSampleValues } from "./sample.schema";

const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ?? "";
const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET ?? "";
const upload = createCloudinaryImageUploader({ cloudName, uploadPreset, folder: "lite-erp/samples" });

export default function ImageSample({ widget = "image" }: { widget?: "image" | "avatar" }) {
  const isAvatar = widget === "avatar";
  const sampleId = isAvatar ? "field-image-avatar" : "field-image";
  const methods = useForm<ImageSampleInput, unknown, ImageSampleValues>({ resolver: zodResolver(imageSampleSchema), defaultValues: { image: null } });
  const [submitted, setSubmitted] = useState<ImageSampleValues | null>(null);
  const [url, setUrl] = useState<string | null>();
  return (
    <section id={sampleId} aria-labelledby={`${sampleId}-title`} className="card min-w-0 scroll-mt-6 border border-base-300 bg-base-100 shadow-sm">
      <div className="card-body min-w-0 gap-5 p-4 sm:p-6">
        <header className="space-y-1">
          <h2 id={`${sampleId}-title`} className="text-xl font-semibold">{isAvatar ? "FieldImage · Avatar" : "FieldImage"}</h2>
          <p className="text-sm text-base-content/65">{isAvatar ? "widget=\"avatar\": haz clic en el avatar para seleccionar o cambiar la imagen; usa la papelera para quitarlo. El editor se abre en un modal con recorte cuadrado por defecto. Cancelar o pulsar Escape conserva el avatar anterior." : "widget=\"image\" (por defecto): selecciona o arrastra una imagen, recórtala y ajusta sus dimensiones dentro del Field."} Al confirmar, se sube a Cloudinary y onChange recibe la URL pública HTTPS.</p>
        </header>
        {!cloudName || !uploadPreset ? (
          <div role="note" className="rounded-box border border-info/30 bg-info/10 p-3 text-sm">Para subir imágenes, configura NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME y NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET (unsigned) en .env.local y reinicia el servidor. Puedes probar el editor sin subir.</div>
        ) : <p className="text-xs text-base-content/60">Cloudinary configurado. La imagen se sube únicamente al pulsar «Aplicar y subir imagen».</p>}
        <FormLayout methods={methods} onSubmit={data => setSubmitted(data)} onInvalid={() => setSubmitted(null)} aria-labelledby={`${sampleId}-title`}>
          <FormGroup legend={isAvatar ? "Avatar" : "Imagen"}>
            <FieldImage<ImageSampleInput> name="image" label={isAvatar ? "Avatar de ejemplo" : "Imagen de ejemplo"} widget={widget} upload={upload} maxSizeMB={10} onChange={setUrl} required />
          </FormGroup>
          <FormGroup legend="Validación y resultado">
            <p className="text-sm text-base-content/70">Zod exige una URL HTTPS. Un recorte pendiente o una subida en curso impiden validar el formulario. Si la subida falla, puedes reintentar y se conserva la URL anterior.</p>
            <p className="text-xs text-base-content/60">Quitar imagen limpia el formulario; no elimina el archivo de Cloudinary.</p>
            <div className="min-w-0 space-y-2" aria-live="polite">
              {url !== undefined && <p className="text-sm wrap-anywhere">Último onChange: <code className="font-mono text-xs">{JSON.stringify(url)}</code></p>}
              {submitted && <div className="min-w-0 rounded-box border border-success/25 bg-success/5 p-3"><p className="mb-2 text-sm font-semibold">Datos validados</p><pre className="overflow-x-auto whitespace-pre-wrap break-all text-xs">{JSON.stringify(submitted, null, 2)}</pre></div>}
            </div>
          </FormGroup>
          <div className="col-span-full flex flex-wrap gap-2 border-t border-base-300 pt-4">
            <button type="submit" className="btn btn-primary">Validar ejemplo</button>
            <button type="button" className="btn btn-ghost" onClick={() => { methods.reset({ image: null }); setUrl(undefined); setSubmitted(null); }}>Restablecer</button>
          </div>
        </FormLayout>
      </div>
    </section>
  );
}
