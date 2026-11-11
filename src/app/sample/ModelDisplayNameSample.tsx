"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import FieldMany2One from "@/components/ui/form/FieldMany2One";
import FormLayout from "@/components/ui/form/FormLayout";
import { sampleVehicleLookup } from "./displayName.actions";

const schema = z.object({ vehicleId: z.string().min(1, "Selecciona un vehículo.").nullable().refine(Boolean, "Selecciona un vehículo.") });
type Values = z.infer<typeof schema>;

export default function ModelDisplayNameSample() {
  const methods = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { vehicleId: "demo-1" } });
  const [saved, setSaved] = useState<Values | null>(null);
  return <section id="model-display-name" className="card border border-base-300 bg-base-100 p-5">
    <h2 className="mb-3 text-xl font-semibold">Many2one · nombre definido en el modelo</h2>
    <p className="mb-4 text-sm">Datos ficticios sin persistencia. La etiqueta combina nombre y placas en el servidor; la vista sólo configura load. El ID inicial permite probar la resolución al abrir.</p>
    <FormLayout methods={methods} onSubmit={setSaved}>
      <FieldMany2One<Values> name="vehicleId" label="Vehículo" load={sampleVehicleLookup} required direction="inline" />
      <button type="submit" className="btn btn-primary">Validar</button>
      <button type="button" className="btn btn-ghost" onClick={() => methods.reset({ vehicleId: "demo-2" })}>Cargar segundo vehículo</button>
    </FormLayout>
    {saved && <pre className="mt-3">{JSON.stringify(saved)}</pre>}
  </section>;
}
