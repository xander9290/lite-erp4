"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import FormView from "@/components/ui/form/FormView";
import FormGroup from "@/components/ui/form/FormGroup";
import FieldText from "@/components/ui/form/FieldText";
import { FormDialogLock } from "@/components/ui/form/FormDialog";
import { useModelFormPresentation } from "@/components/modules/ModelFormPresentation";
import { dialogSampleSchema, type DialogSampleValues } from "./form-dialog.schema";
import { saveDialogSample } from "./form-dialog.actions";

/** Fictitious editor using the same presentation context and independent save guard. */
export default function FormOpenSampleEditor({ record }: { record?: DialogSampleValues }) {
  const modal = useModelFormPresentation("sample.dialog")!;
  const methods = useForm<DialogSampleValues>({ resolver: zodResolver(dialogSampleSchema), defaultValues: { name: "", note: "", ...(record ?? modal.defaults) } });
  return <FormView methods={methods} title="Apertura desde botón" mode={record ? "edit" : "create"}
    onSubmit={saveDialogSample} onSaved={values => modal.onSaved(values)}>
    <FormDialogLock />
    <FormGroup legend="Formulario abierto desde TSX">
      <FieldText name="name" label="Nombre" />
      <FieldText name="note" label="Nota" widget="long" />
      <p className="text-xs">Usa ERROR para rechazar el guardado y conservar el borrador.</p>
    </FormGroup>
  </FormView>;
}
