"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { RefreshCw } from "lucide-react";
import FormView from "@/components/ui/form/FormView";
import FormViewLoader from "@/components/ui/form/FormViewLoader";
import { recordUI } from "../schemas/vehicle.ui";
import FormGroup from "@/components/ui/form/FormGroup";
import FieldMany2One from "@/components/ui/form/FieldMany2One";
import FieldBoolean from "@/components/ui/form/FieldBoolean";

import { useFormNavigation } from "@/components/ui/form/FormNavigationProvider";
import { useAlerts } from "@/components/ui/alerts/AlertProvider";
import {
  readRecord,
  saveRecord,
  deleteRecords,
  loadActivity,
  addNote,
} from "../actions/vehicle.actions";
import {
  recordSchema,
  createRecordDefaults,
  type RecordInput,
  type RecordValues,
} from "../schemas/vehicle.schema";
import FieldText from "@/components/ui/form/FieldText";

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
        { label: "Vehículos", href: "/erp/flota/vehicle" },
        { label: savedId ? savedDisplayName || "Vehículo" : "Nuevo registro" },
      ]}
      title={savedId ? "Editar registro" : "Nuevo registro"}
      methods={methods}
      model={recordUI}
      activity={{ recordId: savedId, load: loadActivity, addNote }}
      mode={savedId ? "edit" : "create"}
      onSubmit={saveRecord} deletion={{ action: deleteRecords, returnHref: "/erp/flota/vehicle" }}
      onNew={
        savedId ? () => router.push("/erp/flota/vehicle/nuevo") : undefined
      }
      onSaved={(values, _audit, name) => {
        setSavedId(values.id);
        setSavedDisplayName(name);
        if (!record.id && values.id)
          router.replace("/erp/flota/vehicle/" + encodeURIComponent(values.id));
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
        <FieldMany2One<RecordInput> name="name" direction="inline" />
        <FieldText<RecordInput> name="plate" direction="inline" />
        <FieldBoolean<RecordInput> name="active" direction="inline" />
      </FormGroup>
    </FormView>
  );
}

export default function VehicleForm({ id }: { id?: string }) {
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
