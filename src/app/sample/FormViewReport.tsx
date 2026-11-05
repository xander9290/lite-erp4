"use client";

import { useEffect, useRef, useState } from "react";
import { Printer, X } from "lucide-react";

export default function FormViewReport({ html, onClose }: { html: string; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const modal = dialog.current;
    modal?.showModal();
    return () => modal?.close();
  }, []);
  return <dialog ref={dialog} className="modal" aria-labelledby="form-report-title" onCancel={event => { event.preventDefault(); onClose(); }}>
    <div className="modal-box flex max-h-[90dvh] w-[calc(100%-2rem)] max-w-3xl flex-col gap-4 p-4 sm:p-6">
      <header className="flex items-center justify-between gap-3"><h2 id="form-report-title" className="text-lg font-semibold">Vista de impresión</h2><button type="button" className="btn btn-circle btn-ghost btn-sm" aria-label="Cerrar reporte" onClick={onClose}><X size={18} /></button></header>
      <iframe ref={frame} title="Reporte del documento" srcDoc={html} sandbox="allow-same-origin allow-modals" onLoad={() => setReady(true)} className="h-[55dvh] min-h-40 w-full rounded-xl border border-base-300 bg-white" />
      <footer className="flex flex-wrap justify-end gap-2"><button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>Cerrar</button><button type="button" className="btn btn-primary btn-sm" disabled={!ready} onClick={() => { frame.current?.contentWindow?.focus(); frame.current?.contentWindow?.print(); }}><Printer size={15} />Imprimir</button></footer>
    </div>
  </dialog>;
}
