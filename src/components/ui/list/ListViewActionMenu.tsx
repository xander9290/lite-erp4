"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown, Settings, Trash2 } from "lucide-react";

export default function ListViewActionMenu({ disabled, deleteDisabled, deleteUnavailable, onDelete }: {
  disabled: boolean;
  deleteDisabled: boolean;
  deleteUnavailable: boolean;
  onDelete: () => void;
}) {
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  if (disabled && open) setOpen(false);

  useEffect(() => {
    if (!open) return;
    const dismiss = (event: Event) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("focusin", dismiss);
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      document.removeEventListener("focusin", dismiss);
    };
  }, [open]);

  return <div ref={root} className="dropdown dropdown-end" onKeyDown={event => {
    if (event.key === "Escape" && open) {
      event.preventDefault(); event.stopPropagation(); setOpen(false); trigger.current?.focus();
    }
  }}>
    <button ref={trigger} type="button" disabled={disabled} aria-label="Acciones de la lista" aria-expanded={open} aria-controls={id}
      className={`btn btn-ghost btn-sm gap-2 ${open ? "bg-base-200 text-primary" : ""}`} onClick={() => setOpen(value => !value)}>
      <Settings size={17} aria-hidden="true" />Acciones<ChevronDown size={13} aria-hidden="true" />
    </button>
    {open && <ul id={id} aria-label="Acciones de los registros seleccionados" className="menu dropdown-content z-40 mt-2 w-48 max-w-[calc(100vw-2rem)] rounded-xl border border-base-300 bg-base-100 p-1.5 shadow-lg">
      <li><button type="button" disabled={disabled || deleteDisabled} title={deleteUnavailable ? "Esta vista no permite eliminar registros." : undefined}
        className="gap-3 rounded-lg py-2.5 text-sm text-error disabled:pointer-events-none disabled:opacity-40" onClick={() => {
          setOpen(false); trigger.current?.focus(); onDelete();
        }}><Trash2 size={15} aria-hidden="true" />Eliminar</button></li>
    </ul>}
  </div>;
}
