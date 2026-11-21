"use client";

import { useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { ClientModelAction } from "@/lib/orm/action-parameters";
import { fieldFromMetadata } from "@/lib/modules/fields";
import { modelLookup, modelParameterLookup } from "@/lib/modules/actions";
import type { ModelLookupRequest } from "@/lib/many2one/model-lookup";
import Modal from "../alerts/Modal";
import FormLayout from "./FormLayout";
import FormGroup from "./FormGroup";
import FieldText from "./FieldText";
import FieldNumber from "./FieldNumber";
import FieldBoolean from "./FieldBoolean";
import FieldSelect from "./FieldSelect";
import FieldDate from "./FieldDate";
import FieldMany2One from "./FieldMany2One";

/** Ephemeral inputs, with their own RHF. Render as FormView's sibling, never inside its form. */
export default function ActionParametersDialog({ action, initialValues, errors, onConfirm, onCancel }: {
  action: ClientModelAction;
  initialValues?: Record<string, unknown>;
  errors?: Record<string, string>;
  onConfirm: (values: Record<string, unknown>) => void;
  onCancel: () => void;
}) {
  const fields = useMemo(() => Object.fromEntries(Object.entries(action.params ?? {}).map(([name, metadata]) => [name, fieldFromMetadata(metadata)])), [action.params]);
  const schema = useMemo(() => z.strictObject(Object.fromEntries(Object.entries(fields).map(([name, field]) => [name, field.schema]))), [fields]);
  const methods = useForm<Record<string, unknown>>({ resolver: zodResolver(schema), defaultValues: initialValues ?? Object.fromEntries(Object.entries(fields).map(([name, field]) => [name, field.createDefault()])) });
  const lookups = useMemo(() => Object.fromEntries(Object.entries(action.lookups ?? {}).map(([name, target]) => [name, (request: ModelLookupRequest) => action.sourceModel ? modelParameterLookup(action.sourceModel, action.name, name, request) : modelLookup(target, request)])), [action.lookups, action.sourceModel, action.name]);
  useEffect(() => { for (const [name, message] of Object.entries(errors ?? {})) methods.setError(Object.hasOwn(fields, name) ? name : "root.server", { type: "server", message }); }, [errors, methods, fields]);
  return <Modal open title={action.label} onClose={onCancel}>
    <FormLayout methods={methods} model={{ fields, lookups }} onSubmit={onConfirm} contentClassName="flex flex-col gap-4">
      <FormGroup fullWidth>
        {Object.entries(action.params ?? {}).map(([name, field]) => {
          switch (field.kind) {
            case "text": return <FieldText key={name} name={name} widget={(field.maxLength ?? 0) > 250 ? "long" : "text"} />;
            case "integer": return <FieldNumber key={name} name={name} type="integer" />;
            case "boolean": return <FieldBoolean key={name} name={name} />;
            case "selection": return <FieldSelect key={name} name={name} />;
            case "datetime": return <FieldDate key={name} name={name} type="datetime" />;
            case "many2one": return <FieldMany2One key={name} name={name} />;
            default: return null;
          }
        })}
      </FormGroup>
      {methods.formState.errors.root?.server && <p role="alert" className="text-error">{methods.formState.errors.root.server.message}</p>}
      <div className="flex flex-wrap justify-end gap-2 border-t border-base-300 pt-4">
        <button type="button" className="btn btn-ghost" onClick={onCancel}>Cancelar</button>
        <button type="submit" className="btn btn-primary">Continuar</button>
      </div>
    </FormLayout>
  </Modal>;
}
