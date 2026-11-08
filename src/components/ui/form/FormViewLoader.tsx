"use client";

import { useEffect, useState, type ReactNode } from "react";
import { CircleAlert, RotateCcw } from "lucide-react";
import { useAlerts } from "../alerts/AlertProvider";
import type { RecordAudit } from "@/lib/orm/audit";

export type FormViewLoadResult<T> = { ok: true; values: T; audit?: RecordAudit } | { ok: false; error: string; kind?: "validation" | "server" };
export type FormViewLoaderProps<T> = {
  recordKey: string | number;
  load: () => Promise<FormViewLoadResult<T>>;
  timeoutMs?: number;
  children: (record: T, audit?: RecordAudit) => ReactNode;
};

export default function FormViewLoader<T>({ recordKey, load, children, timeoutMs = 30_000 }: FormViewLoaderProps<T>) {
  const alerts = useAlerts();
  const [attempt, setAttempt] = useState(0);
  const key = JSON.stringify([recordKey, attempt, timeoutMs]);
  const [response, setResponse] = useState<{ key: string; load: typeof load; result: FormViewLoadResult<T> } | null>(null);
  useEffect(() => {
    let current = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const close = alerts.loading({ title: "Cargando…", message: "Abriendo el registro. Un momento, por favor." });
    async function run() {
      let result: FormViewLoadResult<T>;
      try {
        result = await Promise.race([load(), new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error("Record load timed out")), Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 30_000);
        })]);
        if (!result || typeof result.ok !== "boolean" || (result.ok && !("values" in result))) throw new Error("Invalid record load response");
      }
      catch { result = { ok: false, error: "No se pudo cargar el registro. Revisa tu conexión e intenta nuevamente.", kind: "server" }; }
      finally { clearTimeout(timer); close(); }
      if (!current) return;
      setResponse({ key, load, result });
      if (!result.ok) void (result.kind === "validation" ? alerts.validation : alerts.error)({ title: result.kind === "validation" ? "Error de validación" : "No se pudo abrir el registro", message: result.error });
    }
    void run();
    return () => { current = false; clearTimeout(timer); close(); };
  }, [key, load, alerts, timeoutMs]);
  const result = response?.key === key && response.load === load ? response.result : null;
  if (result?.ok) return <div key={key} className="flex min-h-0 min-w-0 flex-1 flex-col">{children(result.values, result.audit)}</div>;
  return <div aria-busy={!result} className="card min-h-0 min-w-0 flex-1 items-center justify-center gap-4 overflow-y-auto border border-base-300 bg-base-100 p-8 text-center shadow-sm">
    {result ? <>
      <CircleAlert size={28} aria-hidden="true" className="text-error" />
      <p role="alert" className="max-w-md text-sm text-base-content/65">{result.error}</p>
      <button type="button" className="btn btn-soft btn-sm" onClick={() => setAttempt(value => value + 1)}><RotateCcw size={15} aria-hidden="true" />Reintentar</button>
    </> : <><span aria-hidden="true" className="loading loading-spinner text-primary" /><p role="status" className="text-sm text-base-content/60">Cargando…</p></>}
  </div>;
}
