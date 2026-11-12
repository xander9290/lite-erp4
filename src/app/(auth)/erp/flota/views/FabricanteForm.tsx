"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { RefreshCw } from "lucide-react";
import FormView from "@/components/ui/form/FormView";
import FormViewLoader from "@/components/ui/form/FormViewLoader";
import { recordUI } from "../schemas/fabricante.ui";
import FormGroup from "@/components/ui/form/FormGroup";
import FieldText from "@/components/ui/form/FieldText";
import FieldBoolean from "@/components/ui/form/FieldBoolean";

import { useFormNavigation } from "@/components/ui/form/FormNavigationProvider";
import { useAlerts } from "@/components/ui/alerts/AlertProvider";
import {
  readRecord,
  saveRecord,
  deleteRecords,
  loadActivity,
  addNote,
} from "../actions/fabricante.actions";
import {
  recordSchema,
  createRecordDefaults,
  type RecordInput,
  type RecordValues,
} from "../schemas/fabricante.schema";
import FieldImage from "@/components/ui/form/FieldImage";

function Editor({
  record,
  displayName,
  onReload,
}: {
  record: RecordInput;
  displayName?: string;
  onReload?: () => void;
}) {
  const router = useRouter();
  const [savedId, setSavedId] = useState(record.id);
  const [savedDisplayName, setSavedDisplayName] = useState(displayName);
  const methods = useForm<RecordInput, unknown, RecordValues>({
    resolver: zodResolver(recordSchema),
    defaultValues: record,
  });
  return (
    <FormView
      layout="page"
      breadcrumbs={[
        { label: "Aplicaciones", href: "/erp" },
        { label: "Fabricantes", href: "/erp/flota/fabricante" },
        {
          label: savedId
            ? savedDisplayName || String(record.name ?? "Registro")
            : "Nuevo registro",
        },
      ]}
      title={savedId ? "Editar registro" : "Nuevo registro"}
      methods={methods}
      model={recordUI}
      activity={{ recordId: savedId, load: loadActivity, addNote }}
      mode={savedId ? "edit" : "create"}
      onSubmit={saveRecord} deletion={{ action: deleteRecords, returnHref: "/erp/flota/fabricante" }}
      onNew={
        savedId ? () => router.push("/erp/flota/fabricante/nuevo") : undefined
      }
      onSaved={(values, _audit, name) => {
        setSavedId(values.id);
        setSavedDisplayName(name);
        if (!record.id && values.id)
          router.replace(
            "/erp/flota/fabricante/" + encodeURIComponent(values.id),
          );
        router.refresh();
      }}
      menuActions={
        onReload
          ? [
              {
                id: "reload",
                label: "Recargar registro",
                icon: <RefreshCw size={16} />,
                onSelect: onReload,
              },
            ]
          : undefined
      }
      footer={
        <p className="text-xs text-base-content/55">
          Los cambios se guardan al presionar Guardar.
        </p>
      }
    >
      <FormGroup legend="Datos generales">
        <FieldImage<RecordInput>
          name="logo"
          shape="squared"
          widget="avatar"
          direction="inline"
          label=""
        />
        <FieldText<RecordInput> name="name" direction="inline" />
        <FieldBoolean<RecordInput> name="active" direction="inline" />
      </FormGroup>
    </FormView>
  );
}

export default function FabricanteForm({ id }: { id?: string }) {
  const router = useRouter();
  const navigation = useFormNavigation();
  const alerts = useAlerts();
  const [attempt, setAttempt] = useState(0);
  const load = useCallback(() => readRecord(id!), [id]);
  const reload = () => {
    void navigation
      .run(() => setAttempt((value) => value + 1))
      .catch(() => {
        void alerts.error({
          title: "No se pudo recargar el registro",
          message: "Intenta nuevamente. Tus cambios siguen en el formulario.",
        });
      });
  };
  return (
    <>
      {id ? (
        <FormViewLoader
          key={router.bfcacheId + ":" + id + ":" + attempt}
          recordKey={id}
          load={load}
        >
          {(record, _audit, displayName) => (
            <Editor
              record={record}
              displayName={displayName}
              onReload={reload}
            />
          )}
        </FormViewLoader>
      ) : (
        <Editor key={router.bfcacheId} record={createRecordDefaults()} />
      )}
    </>
  );
}
