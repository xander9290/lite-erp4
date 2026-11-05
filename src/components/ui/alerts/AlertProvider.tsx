"use client";

import { createContext, useContext, useLayoutEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { flushSync } from "react-dom";
import { CircleAlert, CircleHelp, Info, ShieldAlert } from "lucide-react";
import Modal from "./Modal";
import { AlertQueue, type AlertsApi, type AlertEntry } from "./alertQueue";

const AlertsContext = createContext<AlertsApi | null>(null);
export function useAlerts() {
  const alerts = useContext(AlertsContext);
  if (!alerts) throw new Error("useAlerts requiere AlertProvider.");
  return alerts;
}

function AlertDialog({ entry, finish }: { entry: AlertEntry; finish: (accepted: boolean) => void }) {
  const cancel = useRef<HTMLButtonElement>(null);
  const loading = entry.kind === "loading";
  const confirm = entry.kind === "confirm";
  const error = entry.kind === "error" || entry.kind === "validation";
  const Icon = entry.kind === "validation" ? ShieldAlert : error ? CircleAlert : confirm ? CircleHelp : Info;
  return <Modal open title={entry.title} role={error || confirm ? "alertdialog" : "dialog"}
    tone={error ? "error" : confirm ? "warning" : "info"}
    icon={loading ? <span className="loading loading-spinner loading-sm" /> : <Icon size={23} />}
    onClose={loading ? undefined : () => finish(false)} closeOnBackdrop={!loading} closeOnEscape={!loading}
    initialFocusRef={confirm ? cancel : undefined}
    footer={loading ? undefined : <>
      {confirm && <button ref={cancel} type="button" className="btn btn-ghost btn-sm" onClick={() => finish(false)}>{entry.cancelLabel ?? "Cancelar"}</button>}
      <button type="button" className={`btn btn-sm ${confirm && entry.danger ? "btn-error" : "btn-primary"}`} onClick={() => finish(true)}>{entry.confirmLabel ?? (confirm ? "Confirmar" : "Entendido")}</button>
    </>}>
    {loading ? <p role="status" aria-live="polite">{entry.message ?? "Obteniendo los datos del registro. Un momento, por favor."}</p> : <>
      {entry.message && <p className="whitespace-pre-line wrap-anywhere">{entry.message}</p>}
      {Boolean(entry.details?.length) && <ul className="mt-3 space-y-2 rounded-xl bg-base-200/65 p-3">{entry.details!.map((detail, index) => <li key={index} className="flex gap-2"><span aria-hidden="true" className="text-error">•</span><span className="wrap-anywhere">{detail}</span></li>)}</ul>}
    </>}
  </Modal>;
}

export default function AlertProvider({ children }: { children: ReactNode }) {
  const [queue] = useState(() => new AlertQueue());
  const entries = useSyncExternalStore(queue.subscribe, queue.getSnapshot, queue.getServerSnapshot);
  useLayoutEffect(() => { queue.activate(); return () => queue.dispose(); }, [queue]);
  const entry = entries[0];
  return <AlertsContext.Provider value={queue}>
    {children}
    {entry && <AlertDialog key={entry.id} entry={entry} finish={accepted => {
      // Finish closing/restoring focus before callers continue an awaited confirmation.
      flushSync(() => queue.settle(entry.id, accepted));
    }} />}
  </AlertsContext.Provider>;
}
