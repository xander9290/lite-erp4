"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Settings } from "lucide-react";

export type FormViewMenuAction = {
  id: string;
  label: string;
  icon?: ReactNode;
  disabled?: boolean;
  danger?: boolean;
  onSelect: () => void;
};

export default function FormViewActionMenu({ actions, disabled }: { actions: readonly FormViewMenuAction[]; disabled: boolean }) {
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  if (disabled && open) setOpen(false);

  useEffect(() => {
    if (!open) return;
    const dismiss = (event: Event) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("focusin", dismiss);
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      document.removeEventListener("focusin", dismiss);
    };
  }, [open]);

  return <div ref={root} className="dropdown dropdown-end ml-auto" onKeyDown={event => {
    if (event.key === "Escape" && open) {
      event.preventDefault(); event.stopPropagation(); setOpen(false); trigger.current?.focus();
    }
  }}>
    <button ref={trigger} type="button" disabled={disabled} aria-label="Acciones del formulario" title="Acciones del formulario"
      aria-expanded={open} aria-controls={id} className={`btn btn-square btn-ghost btn-sm ${open ? "bg-base-200 text-primary" : "text-base-content/60"}`}
      onClick={() => setOpen(value => !value)}>
      <Settings size={18} aria-hidden="true" />
    </button>
    {open && <ul id={id} aria-label="Acciones adicionales" className="menu dropdown-content z-40 mt-2 w-52 max-w-[calc(100vw-2rem)] rounded-xl border border-base-300 bg-base-100 p-1.5 shadow-lg">
      {actions.map(action => <li key={action.id}>
        <button type="button" disabled={disabled || action.disabled} className={`gap-3 rounded-lg py-2.5 text-sm disabled:pointer-events-none disabled:opacity-40 ${action.danger ? "text-error" : ""}`} onClick={() => {
          setOpen(false);
          trigger.current?.focus();
          action.onSelect();
        }}>
          {action.icon && <span aria-hidden="true" className={action.danger ? "text-error" : "text-base-content/55"}>{action.icon}</span>}{action.label}
        </button>
      </li>)}
    </ul>}
  </div>;
}
