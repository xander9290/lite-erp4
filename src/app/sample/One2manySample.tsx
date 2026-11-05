"use client";

import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ReceiptText, StickyNote } from "lucide-react";
import FieldOne2many, { type One2manyColumn } from "@/components/ui/form/FieldOne2many";
import FieldText from "@/components/ui/form/FieldText";
import FieldNumber from "@/components/ui/form/FieldNumber";
import FieldSelect from "@/components/ui/form/FieldSelect";
import FormView from "@/components/ui/form/FormView";
import FormGroup from "@/components/ui/form/FormGroup";
import Notebook from "@/components/ui/form/Notebook";
import NotebookPage from "@/components/ui/form/NotebookPage";
import { createOrderLine, lineProducts, lineSubtotal, one2manyDefaults, one2manySchema, orderTotal, type One2manyInput, type One2manyValues, type OrderLineInput } from "./one2many.schema";
import { saveOne2manyExample, type OrderSaveResult } from "./one2many.actions";

const money = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" });

export default function One2manySample() {
  const methods = useForm<One2manyInput, unknown, One2manyValues>({ resolver: zodResolver(one2manySchema), defaultValues: one2manyDefaults });
  const [change, setChange] = useState<OrderLineInput[]>();
  const [summary, setSummary] = useState<OrderSaveResult["summary"]>();
  const [readOnly, setReadOnly] = useState(false);
  const columns = useMemo<One2manyColumn<One2manyInput, "lines">[]>(() => [
    { key: "product", label: "Producto y descripción", width: "36%", render: ({ fieldName, index }) => <div className="min-w-0 space-y-1">
      <FieldSelect<One2manyInput, string> name={fieldName("productId")} aria-label={`Producto, línea ${index + 1}`} required
        options={lineProducts.map(product => ({ value: product.id, label: product.name }))}
        onChange={value => {
          const product = lineProducts.find(product => product.id === value);
          if (product) {
            methods.setValue(fieldName("description"), product.name, { shouldDirty: true });
            methods.setValue(fieldName("unitPrice"), product.price, { shouldDirty: true });
          }
        }} />
      <FieldText<One2manyInput> name={fieldName("description")} aria-label={`Descripción, línea ${index + 1}`} placeholder="Descripción de la línea" className="h-8 text-xs" maxLength={200} />
    </div> },
    { key: "quantity", label: "Cantidad", width: "15%", align: "right", render: ({ fieldName, index }) => <FieldNumber<One2manyInput> name={fieldName("quantity")} aria-label={`Cantidad, línea ${index + 1}`} type="float" decimals={2} /> },
    { key: "price", label: "Precio unitario", width: "22%", align: "right", render: ({ fieldName, index }) => <FieldNumber<One2manyInput> name={fieldName("unitPrice")} aria-label={`Precio unitario, línea ${index + 1}`} type="monetary" currency="MXN" decimals={2} /> },
    { key: "subtotal", label: "Subtotal", align: "right", render: ({ row, index }) => <output aria-label={`Subtotal, línea ${index + 1}`} className="inline-block rounded-lg bg-primary/5 px-2 py-2 text-sm font-semibold whitespace-nowrap text-base-content/75 tabular-nums">{money.format(lineSubtotal(row))}</output> },
  ], [methods]);

  return <section id="field-one2many" aria-labelledby="one2many-sample-title" className="min-w-0 scroll-mt-6 space-y-3">
    <header className="flex flex-wrap items-center justify-between gap-3 px-1"><div><h2 id="one2many-sample-title" className="text-xl font-semibold">FieldOne2many</h2><p className="mt-1 text-sm text-base-content/60">Líneas editables dentro de la misma tabla. Los cambios se envían junto con el pedido.</p></div><button type="button" className="btn btn-ghost btn-sm" onClick={() => setReadOnly(value => !value)}>{readOnly ? "Volver a editar líneas" : "Ver solo lectura"}</button></header>
    <FormView methods={methods} width="wide" title="Pedido de ejemplo" description="Edición de líneas · React Hook Form + Zod" icon={<ReceiptText size={22} />} readOnly={readOnly} saveLabel="Validar guardado"
      onSubmit={async values => { setSummary(undefined); const result = await saveOne2manyExample(values); if (result.ok) setSummary(result.summary); return result; }}
      onRevert={() => { setChange(undefined); setSummary(undefined); }}
      footer={<div className="space-y-3">
        <p className="text-xs leading-relaxed text-base-content/55">Demo sin persistencia: el servidor valida las líneas, calcula el total y prepara las altas, actualizaciones y eliminaciones. No escribe en base de datos ni asigna IDs a las líneas nuevas. Escribe BLOQUEADO en una descripción para probar un rechazo del servidor.</p>
        {summary && <p role="status" className="text-sm text-success">Última validación en servidor · Altas: {summary.create} · Líneas existentes: {summary.update} · Bajas: {summary.delete} · Total: {money.format(summary.total)}</p>}
        <details className="min-w-0 rounded-xl bg-base-200/50 p-3"><summary className="cursor-pointer text-xs font-medium text-base-content/65">Consultar último onChange</summary><pre className="mt-3 max-w-full overflow-x-auto text-xs leading-relaxed">{change ? JSON.stringify(change, null, 2) : "Edita, agrega, quita o mueve una línea para ver el arreglo completo. Revertir no dispara onChange."}</pre></details>
      </div>}>
      <FormGroup legend="Datos del pedido"><FieldText<One2manyInput> name="reference" label="Referencia del pedido" /></FormGroup>
      <Notebook label="Contenido del pedido" defaultPage="lines">
        <NotebookPage name="lines" label="Líneas del pedido" icon={<ReceiptText size={16} />}>
          <FieldOne2many<One2manyInput, "lines"> name="lines" label="Detalle del pedido" columns={columns} createRow={createOrderLine} maxRows={20} reorderable readOnly={readOnly} onChange={setChange}
            footer={rows => <div className="flex flex-wrap items-center justify-between gap-3"><span className="text-xs text-base-content/50">Importes en MXN · Sin impuestos</span><p className="flex items-baseline gap-3 text-sm"><span className="text-base-content/60">Total del pedido</span><output aria-label="Total del pedido" className="text-lg font-semibold text-primary tabular-nums">{money.format(orderTotal(rows))}</output></p></div>} />
        </NotebookPage>
        <NotebookPage name="notes" label="Notas del pedido" icon={<StickyNote size={16} />}><FormGroup legend="Notas"><FieldText<One2manyInput> name="notes" label="Notas adicionales del pedido" widget="long" rows={4} maxLength={500} /></FormGroup></NotebookPage>
      </Notebook>
    </FormView>
  </section>;
}
