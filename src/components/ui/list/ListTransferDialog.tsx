"use client";
import { useEffect, useId, useRef, useState } from "react";
import type { ListTransfer, TransferFormat, TransferPlan } from "@/lib/list/transfer-types";

const labels = { create: "Crear", update: "Actualizar", unchanged: "Sin cambios", error: "Error" };

/** Mounted exclusively by ListView. Native modal keeps focus and blocks the list underneath. */
export default function ListTransferDialog({ mode, transfer, state, selected, onClose, onApplied }: {
  mode: "import" | "export"; transfer: ListTransfer; state: unknown; selected: readonly string[]; onClose: () => void; onApplied: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null), titleId = useId();
  const fileInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [message, setMessage] = useState("");
  const [file, setFile] = useState<File | null>(null), [plan, setPlan] = useState<TransferPlan | null>(null);
  const [scope, setScope] = useState<"filtered" | "selected">(selected.length ? "selected" : "filtered");
  useEffect(() => { const element = dialog.current!; element.showModal(); return () => element.close(); }, []);
  async function run(action: () => Promise<void>) {
    if (busy) return;
    setBusy(true); setError(""); setMessage("");
    try { await action(); } catch (error) { setError(error instanceof Error ? error.message : "No se pudo completar la operación."); }
    finally { setBusy(false); }
  }
  async function download(format: TransferFormat, template: boolean) {
    await run(async () => {
      const result = await transfer.download(format, state, template || scope === "filtered" ? [] : selected, template);
      if (!result.ok) throw new Error(result.error);
      const bytes = Uint8Array.from(atob(result.data.base64), char => char.charCodeAt(0));
      const url = URL.createObjectURL(new Blob([bytes], { type: result.data.mime }));
      const link = document.createElement("a"); link.href = url; link.download = result.data.name;
      document.body.appendChild(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMessage(template ? "Plantilla descargada." : "Archivo exportado.");
    });
  }
  async function review() {
    await run(async () => {
      setPlan(null);
      if (!file) throw new Error("Selecciona un archivo.");
      const form = new FormData(); form.set("file", file);
      const result = await transfer.review(form);
      if (!result.ok) throw new Error(result.error);
      setPlan(result.data);
    });
  }
  async function apply() {
    const token = plan?.token;
    if (!token) return;
    // Consume the local confirmation before the request; never repeat an unknown commit.
    setPlan(current => current ? { ...current, token: undefined } : null);
    await run(async () => {
      try {
        const result = await transfer.apply(token);
        if (!result.ok) throw new Error(result.error);
        setPlan(null); setFile(null);
        if (fileInput.current) fileInput.current.value = "";
        setMessage(`Importación completada: ${result.data.created} creados, ${result.data.updated} actualizados, ${result.data.unchanged} sin cambios.`);
      } finally { onApplied(); }
    });
  }
  return <dialog ref={dialog} aria-labelledby={titleId} className="modal" onCancel={event => { event.preventDefault(); if (!busy) onClose(); }}>
    <div className="modal-box max-h-[85vh] w-11/12 max-w-5xl space-y-4 overflow-auto" aria-busy={busy}>
      <h2 id={titleId} className="text-lg font-semibold">{mode === "import" ? "Importar" : "Exportar"} Excel/CSV</h2>
      {mode === "export" ? <>
        <label className="flex flex-col gap-1">Registros<select autoComplete="off" className="select w-full" value={scope} disabled={busy} onChange={event => setScope(event.target.value as typeof scope)}><option value="filtered">Todos los que coinciden con los filtros</option><option value="selected" disabled={!selected.length}>Seleccionados ({selected.length})</option></select></label>
        <p className="text-sm">Campos: {transfer.fields.join(", ")}. Máximo 2.000 registros filtrados.</p>
        <div className="flex gap-2"><button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => void download("xlsx", false)}>Exportar Excel</button><button type="button" className="btn btn-sm" disabled={busy} onClick={() => void download("csv", false)}>Exportar CSV</button></div>
      </> : <>
        <p className="text-sm">Una hoja, encabezados técnicos y hasta 200 filas; máximo 512 KB. Las columnas omitidas conservan su valor al actualizar; una celda vacía solicita vaciar el campo. Booleanos: true/false. No se admiten fórmulas.</p>
        <div className="flex flex-wrap gap-2"><button type="button" className="btn btn-sm" disabled={busy} onClick={() => void download("xlsx", true)}>Plantilla Excel</button><button type="button" className="btn btn-sm" disabled={busy} onClick={() => void download("csv", true)}>Plantilla CSV</button></div>
        <label className="flex flex-col gap-1">Archivo<input ref={fileInput} type="file" autoComplete="off" accept=".xlsx,.csv" className="file-input w-full" disabled={busy} onChange={event => { setFile(event.target.files?.[0] ?? null); setPlan(null); setError(""); setMessage(""); }} /></label>
        <button type="button" className="btn btn-sm" disabled={busy || !file} onClick={() => void review()}>Revisar archivo</button>
        {plan && <>
          <p role="status" className="text-sm">{Object.entries(labels).map(([operation, label]) => `${label}: ${plan.rows.filter(row => row.operation === operation).length}`).join(" · ")}</p>
          <div className="max-h-72 overflow-auto"><table className="table table-sm"><thead><tr><th>Fila</th><th>Clave</th><th>Operación</th><th>Valores / errores</th></tr></thead><tbody>{plan.rows.map(row => <tr key={row.row}><td>{row.row}</td><td>{row.key}</td><td>{labels[row.operation]}</td><td className={`whitespace-pre-wrap wrap-anywhere ${row.errors ? "text-error" : ""}`}>{row.errors ? Object.entries(row.errors).map(([field, error]) => `${field ? `${field}: ` : ""}${error}`).join("\n") : JSON.stringify(row.values)}</td></tr>)}</tbody></table></div>
          <p className="text-sm">Confirmar aplica el lote completo. Si cambia un registro o falla una fila, se rechaza todo el lote. El plan vence en 15 minutos.</p>
          <button type="button" className="btn btn-primary btn-sm" disabled={busy || !plan.token} onClick={() => void apply()}>Confirmar importación</button>
        </>}
      </>}
      {busy && <p role="status" className="text-sm">Procesando…</p>}
      {error && <p role="alert" className="text-sm text-error">{error}</p>}
      {message && <p role="status" className="text-sm text-success">{message}</p>}
      <div className="modal-action"><button type="button" className="btn btn-sm" disabled={busy} onClick={onClose}>Cerrar</button></div>
    </div>
  </dialog>;
}
