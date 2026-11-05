"use client";

import { useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import FieldText from "@/components/ui/form/FieldText";
import FieldNumber from "@/components/ui/form/FieldNumber";
import FieldSelect from "@/components/ui/form/FieldSelect";
import FieldDate from "@/components/ui/form/FieldDate";
import FieldBoolean from "@/components/ui/form/FieldBoolean";
import FormLayout from "@/components/ui/form/FormLayout";
import FormGroup from "@/components/ui/form/FormGroup";
import {
  textSampleSchema, textSampleDefaults, textSampleExample, type TextSampleValues,
  longTextSampleSchema, longTextSampleDefaults, longTextSampleExample, type LongTextSampleValues,
  numberSampleSchema, numberSampleDefaults, numberSampleExample, type NumberSampleInput, type NumberSampleValues,
  selectSampleSchema, selectSampleDefaults, selectSampleExample, type SelectSampleInput, type SelectSampleValues,
  dateSampleSchema, dateSampleDefaults, dateSampleExample, type DateSampleInput, type DateSampleValues,
  booleanSampleSchema, booleanSampleDefaults, booleanSampleExample, type BooleanSampleInput, type BooleanSampleValues,
} from "./sample.schema";

function SampleCard({ id, title, description, children }: {
  id: string; title: string; description: string; children: ReactNode;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="card min-w-0 scroll-mt-6 border border-base-300 bg-base-100 shadow-sm">
      <div className="card-body min-w-0 gap-5 p-4 sm:p-6">
        <header className="space-y-1">
          <h2 id={`${id}-title`} className="text-xl font-semibold">{title}</h2>
          <p className="text-sm text-base-content/65">{description}</p>
        </header>
        {children}
      </div>
    </section>
  );
}

function SampleActions({ onReset, onExample }: { onReset: () => void; onExample: () => void }) {
  return (
    <div className="col-span-full flex min-w-0 flex-wrap gap-2 border-t border-base-300 pt-4">
      <button type="submit" className="btn btn-primary">Validar ejemplo</button>
      <button type="button" className="btn btn-soft" onClick={onExample}>Cargar ejemplo válido</button>
      <button type="button" className="btn btn-ghost" onClick={onReset}>Restablecer</button>
    </div>
  );
}

function SampleResult({ value, change }: { value: unknown; change?: unknown }) {
  return (
    <div className="min-w-0 space-y-3" aria-live="polite">
      {change !== undefined && (
        <p className="text-sm wrap-anywhere text-base-content/70">
          Último onChange: <code className="font-mono">{JSON.stringify(change)}</code>
        </p>
      )}
      {value !== null && (
        <div className="min-w-0 rounded-box border border-success/25 bg-success/5 p-4">
          <p className="mb-2 text-sm font-semibold">Datos validados</p>
          <pre className="overflow-x-auto text-xs leading-relaxed">{JSON.stringify(value, (key, item) => key === "password" ? "[oculta]" : item, 2)}</pre>
        </div>
      )}
    </div>
  );
}

function TextSample() {
  const methods = useForm<TextSampleValues>({ resolver: zodResolver(textSampleSchema), defaultValues: textSampleDefaults });
  const [submitted, setSubmitted] = useState<TextSampleValues | null>(null);
  const [change, setChange] = useState<string>();
  function reset(values: TextSampleValues) {
    methods.reset(values); setSubmitted(null); setChange(undefined);
  }
  return (
    <SampleCard id="field-text" title="FieldText" description="Texto y contraseña; label horizontal, vertical y un campo sin label. Usuario: mínimo 3 caracteres. Contraseña: mínimo 8.">
      <FormLayout methods={methods} onSubmit={(data) => setSubmitted(data)} onInvalid={() => setSubmitted(null)} aria-labelledby="field-text-title">
        <FormGroup legend="Texto y contraseña">
          <FieldText<TextSampleValues> name="username" label="Usuario de ejemplo" direction="inline" onChange={setChange} />
          <FieldText<TextSampleValues> name="password" label="Contraseña de ejemplo" type="password" />
        </FormGroup>
        <FormGroup legend="Sin label">
          <FieldText<TextSampleValues> name="alias" direction="inline" aria-label="Alias opcional" placeholder="Alias opcional" />
          <p className="text-xs text-base-content/60">Sin label, el input ocupa todo el ancho disponible. La contraseña se oculta en el resultado.</p>
        </FormGroup>
        <SampleActions onReset={() => reset(textSampleDefaults)} onExample={() => reset(textSampleExample)} />
      </FormLayout>
      <SampleResult value={submitted} change={change} />
    </SampleCard>
  );
}

function LongTextSample() {
  const methods = useForm<LongTextSampleValues>({ resolver: zodResolver(longTextSampleSchema), defaultValues: longTextSampleDefaults });
  const [submitted, setSubmitted] = useState<LongTextSampleValues | null>(null);
  const [change, setChange] = useState<string>();
  function reset(values: LongTextSampleValues) {
    methods.reset(values); setSubmitted(null); setChange(undefined);
  }
  return (
    <SampleCard id="field-text-long" title="FieldText · Long" description="widget=&quot;long&quot;: texto multilínea con fondo tenue, esquinas superiores redondeadas y la misma línea inferior de los Fields. Descripción: entre 20 y 500 caracteres; notas opcionales hasta 240.">
      <FormLayout methods={methods} onSubmit={data => setSubmitted(data)} onInvalid={() => setSubmitted(null)} aria-labelledby="field-text-long-title">
        <FormGroup legend="Descripción">
          <FieldText<LongTextSampleValues> name="description" label="Descripción del pedido" widget="long" rows={5} maxLength={500} placeholder="Escribe los detalles del pedido…" onChange={setChange} />
        </FormGroup>
        <FormGroup legend="Notas opcionales">
          <FieldText<LongTextSampleValues> name="notes" widget="long" direction="inline" aria-label="Notas opcionales" rows={4} maxLength={240} placeholder="Agrega indicaciones adicionales…" />
          <p className="text-xs text-base-content/60">Sin label, el área ocupa todo el ancho del grupo. Enter agrega un salto de línea y onChange devuelve el texto completo.</p>
        </FormGroup>
        <SampleActions onReset={() => reset(longTextSampleDefaults)} onExample={() => reset(longTextSampleExample)} />
      </FormLayout>
      <SampleResult value={submitted} change={change} />
    </SampleCard>
  );
}

function NumberSample() {
  const methods = useForm<NumberSampleInput, unknown, NumberSampleValues>({ resolver: zodResolver(numberSampleSchema), defaultValues: numberSampleDefaults });
  const [submitted, setSubmitted] = useState<NumberSampleValues | null>(null);
  const [change, setChange] = useState<number | null>();
  function reset(values: NumberSampleInput) {
    methods.reset(values); setSubmitted(null); setChange(undefined);
  }
  return (
    <SampleCard id="field-number" title="FieldNumber" description="Enteros, decimales y moneda MXN. Cantidad: entero desde 1. Medida: desde 0. Precio: mayor que cero.">
      <FormLayout methods={methods} onSubmit={(data) => setSubmitted(data)} onInvalid={() => setSubmitted(null)} aria-labelledby="field-number-title">
        <FormGroup legend="Enteros y decimales">
          <FieldNumber<NumberSampleInput> name="quantity" label="Cantidad" type="integer" direction="inline" />
          <FieldNumber<NumberSampleInput> name="measurement" label="Medida" type="float" decimals={3} />
        </FormGroup>
        <FormGroup legend="Moneda">
          <FieldNumber<NumberSampleInput> name="price" label="Precio" type="monetary" decimals={2} currency="MXN" onChange={setChange} />
          <p className="text-xs text-base-content/60">El cero inicial se oculta al editar; los valores enviados son números. Un campo vacío devuelve null.</p>
        </FormGroup>
        <SampleActions onReset={() => reset(numberSampleDefaults)} onExample={() => reset(numberSampleExample)} />
      </FormLayout>
      <SampleResult value={submitted} change={change} />
    </SampleCard>
  );
}

function SelectSample() {
  const methods = useForm<SelectSampleInput, unknown, SelectSampleValues>({ resolver: zodResolver(selectSampleSchema), defaultValues: selectSampleDefaults });
  const [submitted, setSubmitted] = useState<SelectSampleValues | null>(null);
  const [change, setChange] = useState<string | null>();
  function reset(values: SelectSampleInput) {
    methods.reset(values); setSubmitted(null); setChange(undefined);
  }
  return (
    <SampleCard id="field-select" title="FieldSelect" description="Dropdown con valores de texto y radios horizontales con valores numéricos. Ambas selecciones son requeridas.">
      <FormLayout methods={methods} onSubmit={(data) => setSubmitted(data)} onInvalid={() => setSubmitted(null)} aria-labelledby="field-select-title">
        <FormGroup legend="Dropdown">
          <FieldSelect<SelectSampleInput, string>
            name="role" label="Rol" type="dropdown" direction="inline" onChange={setChange}
            options={[{ label: "Usuario", value: "user" }, { label: "Administrador", value: "admin" }, { label: "Público", value: "public" }]}
          />
        </FormGroup>
        <FormGroup legend="Opciones">
          <FieldSelect<SelectSampleInput, number>
            name="day" label="Día" type="optional"
            options={[{ label: "Lunes", value: 1 }, { label: "Martes", value: 2 }, { label: "Miércoles", value: 3 }]}
          />
        </FormGroup>
        <SampleActions onReset={() => reset(selectSampleDefaults)} onExample={() => reset(selectSampleExample)} />
      </FormLayout>
      <SampleResult value={submitted} change={change} />
    </SampleCard>
  );
}

function DateSample() {
  const methods = useForm<DateSampleInput, unknown, DateSampleValues>({ resolver: zodResolver(dateSampleSchema), defaultValues: dateSampleDefaults });
  const [submitted, setSubmitted] = useState<DateSampleValues | null>(null);
  const [change, setChange] = useState<string | null>();
  function reset(values: DateSampleInput) {
    methods.reset(values); setSubmitted(null); setChange(undefined);
  }
  return (
    <SampleCard id="field-date" title="FieldDate" description="Fecha, fecha con hora y rangos. Todos son requeridos; el final de cada rango debe ser igual o posterior al inicio.">
      <FormLayout methods={methods} onSubmit={(data) => setSubmitted(data)} onInvalid={() => setSubmitted(null)} aria-labelledby="field-date-title">
        <FormGroup legend="Fechas individuales">
          <FieldDate<DateSampleInput> name="date" label="Fecha" type="date" direction="inline" />
          <FieldDate<DateSampleInput> name="datetime" label="Fecha y hora" type="datetime" onChange={setChange} />
          <FieldDate<DateSampleInput> name="isoDate" label="Fecha como ISO" type="date" valueFormat="iso" />
          <p className="text-xs text-base-content/60">Date devuelve YYYY-MM-DD. Datetime muestra la hora del navegador y devuelve UTC con Z. <code>valueFormat=&quot;iso&quot;</code> devuelve la fecha a medianoche UTC.</p>
        </FormGroup>
        <FormGroup legend="Rangos">
          <FieldDate<DateSampleInput> name="dateRange" label="Periodo" type="date" range startLabel="Fecha inicial" endLabel="Fecha final" />
          <FieldDate<DateSampleInput> name="datetimeRange" label="Horario" type="datetime" range startLabel="Inicio con hora" endLabel="Fin con hora" />
          <p className="text-xs text-base-content/60">Cada rango devuelve un objeto con start y end. Al salir del campo se muestra la fecha abreviada; al editar aparece el año completo.</p>
        </FormGroup>
        <SampleActions onReset={() => reset(dateSampleDefaults)} onExample={() => reset(dateSampleExample)} />
      </FormLayout>
      <SampleResult value={submitted} change={change} />
    </SampleCard>
  );
}

function BooleanSample() {
  const methods = useForm<BooleanSampleInput, unknown, BooleanSampleValues>({ resolver: zodResolver(booleanSampleSchema), defaultValues: booleanSampleDefaults });
  const [submitted, setSubmitted] = useState<BooleanSampleValues | null>(null);
  const [change, setChange] = useState<boolean>();
  function reset(values: BooleanSampleInput) {
    methods.reset(values); setSubmitted(null); setChange(undefined);
  }
  return (
    <SampleCard id="field-boolean" title="FieldBoolean" description="Switch de DaisyUI. onChange devuelve true o false. Zod acepta ambos valores; el campo de confirmación exige estar activado.">
      <FormLayout methods={methods} onSubmit={data => setSubmitted(data)} onInvalid={() => setSubmitted(null)} aria-labelledby="field-boolean-title">
        <FormGroup legend="Preferencias">
          <FieldBoolean<BooleanSampleInput> name="notifications" label="Notificaciones" type="switch" direction="inline" onChange={setChange} />
          <FieldBoolean<BooleanSampleInput> name="confirmation" label="Confirmar configuración" />
          <p className="text-xs text-base-content/60">Un booleano en false es válido. Para exigir que el switch esté activo, el esquema usa refine.</p>
        </FormGroup>
        <FormGroup legend="Sin label y estados">
          <FieldBoolean<BooleanSampleInput> name="quietMode" direction="inline" aria-label="Modo silencioso" />
          <FieldBoolean<BooleanSampleInput> name="locked" label="Solo lectura" direction="inline" readOnly />
          <FieldBoolean<BooleanSampleInput> name="unavailable" label="Deshabilitado" direction="inline" disabled />
          <p className="text-xs text-base-content/60">El switch sin label tiene nombre accesible «Modo silencioso». Los campos deshabilitados se omiten del envío.</p>
        </FormGroup>
        <SampleActions onReset={() => reset(booleanSampleDefaults)} onExample={() => reset(booleanSampleExample)} />
      </FormLayout>
      <SampleResult value={submitted} change={change} />
    </SampleCard>
  );
}

export default function SampleForms() {
  return <><TextSample /><LongTextSample /><NumberSample /><SelectSample /><DateSample /><BooleanSample /></>;
}
