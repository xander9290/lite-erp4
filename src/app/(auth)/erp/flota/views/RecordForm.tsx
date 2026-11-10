"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { RefreshCw } from "lucide-react";
import FormView from "@/components/ui/form/FormView";
import FormViewLoader from "@/components/ui/form/FormViewLoader";
import FormGroup from "@/components/ui/form/FormGroup";
import FieldText from "@/components/ui/form/FieldText";
import FieldBoolean from "@/components/ui/form/FieldBoolean";
import type { RecordAudit } from "@/lib/orm/audit";
import { useFormNavigation } from "@/components/ui/form/FormNavigationProvider";
import { useAlerts } from "@/components/ui/alerts/AlertProvider";
import {
  readRecord,
  saveRecord,
  loadActivity,
  addNote,
} from "../actions/record.actions";
import {
  recordSchema,
  createRecordDefaults,
  type RecordInput,
  type RecordValues,
} from "../schemas/record.schema";

function Editor({
  record,
  initialAudit,
  onReload,
}: {
  record: RecordInput;
  initialAudit?: RecordAudit;
  onReload?: () => void;
}) {
  const router = useRouter();
  const [savedId, setSavedId] = useState(record.id);
  const [audit, setAudit] = useState(initialAudit);
  const methods = useForm<RecordInput, unknown, RecordValues>({
    resolver: zodResolver(recordSchema),
    defaultValues: record,
  });
  return (
    <FormView
      title={savedId ? "Editar registro" : "Nuevo registro"}
      layout="page"
      breadcrumbs={[
        { label: "Aplicaciones", href: "/erp" },
        { label: "Flota", href: "/erp/flota" },
        { label: savedId ? record.name || "Registro" : "Nuevo registro" },
      ]}
      audit={audit ?? null}
      activity={{ recordId: savedId, load: loadActivity, addNote }}
      methods={methods}
      mode={savedId ? "edit" : "create"}
      onSubmit={saveRecord}
      onNew={savedId ? () => router.push("/erp/flota/nuevo") : undefined}
      onSaved={(values, nextAudit) => {
        setSavedId(values.id);
        setAudit(nextAudit);
        if (!record.id && values.id)
          router.replace("/erp/flota/" + encodeURIComponent(values.id));
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
        <FieldText<RecordInput>
          name="name"
          label="Nombre"
          required
          maxLength={120}
          autoFocus={!savedId}
          direction="inline"
        />
        <FieldText<RecordInput>
          name="plate"
          label="Placas"
          required
          maxLength={20}
          direction="inline"
        />
        <FieldText<RecordInput>
          name="brand"
          label="Marca"
          maxLength={80}
          direction="inline"
        />
        <FieldBoolean<RecordInput>
          name="active"
          label="Activo"
          direction="inline"
        />
      </FormGroup>
    </FormView>
  );
}

export default function RecordForm({ id }: { id?: string }) {
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
          key={router.bfcacheId + ":" + attempt}
          recordKey={id}
          load={load}
        >
          {(record, audit) => (
            <Editor record={record} initialAudit={audit} onReload={reload} />
          )}
        </FormViewLoader>
      ) : (
        <Editor key={router.bfcacheId} record={createRecordDefaults()} />
      )}
    </>
  );
}
