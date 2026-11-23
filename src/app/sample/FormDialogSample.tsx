"use client";

import { useCallback, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import FormView from "@/components/ui/form/FormView";
import FormGroup from "@/components/ui/form/FormGroup";
import FieldText from "@/components/ui/form/FieldText";
import FormDialog, { FormDialogLock } from "@/components/ui/form/FormDialog";
import Notebook from "@/components/ui/form/Notebook";
import NotebookPage from "@/components/ui/form/NotebookPage";
import ListView from "@/components/ui/list/ListView";
import type { ListResult, ListState } from "@/lib/list/types";
import { dialogSampleSchema, type DialogSampleValues } from "./form-dialog.schema";
import { saveDialogSample } from "./form-dialog.actions";

function Child({ record, onClose, onSaved }: { record: DialogSampleValues; onClose: () => void; onSaved: (record: DialogSampleValues) => void }) {
  const methods = useForm<DialogSampleValues>({ resolver: zodResolver(dialogSampleSchema), defaultValues: { note: "", ...record } });
  return <FormDialog title="Subcontacto de ejemplo" onClose={onClose}>
    <FormView methods={methods} title="Subcontacto de ejemplo" mode={record.id ? "edit" : "create"}
      onSubmit={saveDialogSample} onSaved={values => { onSaved(values); onClose(); }}>
      <FormDialogLock />
      <FormGroup legend="Edición rápida en modal"><FieldText name="name" label="Nombre del subcontacto" />
        <FieldText name="note" label="Nota" widget="long" />
        <p className="text-xs">Usa ERROR para probar un rechazo del servidor.</p>
      </FormGroup>
    </FormView>
  </FormDialog>;
}

/** Same record and schema, with a distinct page layout; no persistence in this sample. */
function PagePreview({ record }: { record: DialogSampleValues }) {
  const methods = useForm<DialogSampleValues>({ resolver: zodResolver(dialogSampleSchema), defaultValues: { note: "", ...record } });
  return <FormView methods={methods} title="Vista de página del subcontacto" mode="edit" readOnly onSubmit={saveDialogSample}>
    <Notebook label="Vista de página del subcontacto">
      <NotebookPage name="general" label="Ficha completa"><FormGroup legend="Datos del subcontacto"><FieldText name="name" label="Nombre" /></FormGroup></NotebookPage>
      <NotebookPage name="notes" label="Notas"><FormGroup legend="Información adicional"><FieldText name="note" label="Nota" widget="long" /></FormGroup></NotebookPage>
    </Notebook>
  </FormView>;
}

export default function FormDialogSample() {
  const methods = useForm<DialogSampleValues>({ resolver: zodResolver(dialogSampleSchema), defaultValues: { name: "Contacto principal" } });
  const [records, setRecords] = useState<DialogSampleValues[]>([{ id: "dialog-demo", revision: "1", name: "Sucursal demo" }]);
  const [editing, setEditing] = useState<DialogSampleValues | null>(null);
  const [parentSaves, setParentSaves] = useState(0);
  const [showPage, setShowPage] = useState(false);
  const load = useCallback(async (state: ListState): Promise<ListResult> => {
    const rows = records.filter(record => record.name.toLowerCase().includes(state.query.toLowerCase()));
    return { ok: true, data: { rows: rows.map(record => ({ ...record, id: record.id! })), total: rows.length, page: 1, pageSize: state.pageSize } };
  }, [records]);
  return <section id="form-dialog" className="scroll-mt-6 space-y-3">
    <h2 className="text-xl font-semibold">Formularios en modal</h2>
    <p className="text-sm">Cambia el principal y abre un subcontacto: cerrar o guardar el modal conserva el borrador principal. El modal usa un grupo compacto; la página del mismo registro usa pestañas. Comparten esquema y reglas. Demo sin persistencia.</p>
    <FormView methods={methods} title="Principal de ejemplo" onSubmit={async values => ({ ok: true, values })} onSaved={() => setParentSaves(value => value + 1)}
      footer={<p data-testid="dialog-parent-saves">Guardados del principal: {parentSaves}</p>}>
      <FormGroup legend="Principal"><FieldText name="name" label="Nombre del principal" /></FormGroup>
      <FormGroup fullWidth legend="Subcontactos de ejemplo">
        <ListView model="sample.dialog" title="Subcontactos de ejemplo" paramPrefix="dialogSample" columns={[{ field: "name", label: "Nombre", type: "text" }]} searchFields={["name"]}
          load={load} delete={false} onCreate={() => setEditing({ name: "" })} onOpen={row => setEditing(records.find(record => record.id === row.id)!)} />
      </FormGroup>
      {editing && <Child record={editing} onClose={() => setEditing(null)} onSaved={record => setRecords(current => [...current.filter(item => item.id !== record.id), record])} />}
    </FormView>
    <button type="button" className="btn btn-sm btn-outline" onClick={() => setShowPage(value => !value)}>{showPage ? "Ocultar" : "Comparar con"} vista de página</button>
    {showPage && <PagePreview key={records[0].revision ?? records[0].id} record={records[0]} />}
  </section>;
}
