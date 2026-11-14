"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useFieldInvisible } from "./FieldVisibility";

type ImageEditorModalProps = {
  id: string; children: ReactNode; onCancel: () => void; onAfterClose: () => void;
};

export default function ImageEditorModal(props: ImageEditorModalProps) {
  const invisible = useFieldInvisible();
  return invisible ? null : <VisibleImageEditorModal {...props} />;
}

function VisibleImageEditorModal({ id, children, onCancel, onAfterClose }: ImageEditorModalProps) {
  const titleId = useId();
  const hintId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    dialog.showModal();
    headingRef.current?.focus();
    const trapTab = (event: KeyboardEvent) => {
      if (event.key !== "Tab" || !dialog.open) return;
      const controls = Array.from(dialog.querySelectorAll<HTMLElement>("button, input, select, textarea, a[href], [tabindex]"))
        .filter(element => element.tabIndex >= 0 && !element.matches(":disabled") && element.getClientRects().length > 0);
      const first = controls[0], last = controls.at(-1);
      const active = document.activeElement;
      const outsideSequence = !controls.some(element => element === active);
      if (event.shiftKey ? active === first || outsideSequence : active === last || outsideSequence) {
        event.preventDefault();
        (event.shiftKey ? last : first)?.focus();
      }
    };
    document.addEventListener("keydown", trapTab, true);
    return () => { document.removeEventListener("keydown", trapTab, true); dialog.close(); onAfterClose(); };
  }, [onAfterClose]);

  // Only mounted after a user selects an image, so the portal is client-only.
  return createPortal(
    <dialog
      ref={dialogRef} id={id} className="modal modal-middle p-2 sm:p-4"
      aria-labelledby={titleId} aria-describedby={hintId}
      onCancel={event => { event.preventDefault(); onCancel(); }}
      onClick={event => { if (event.target === event.currentTarget) onCancel(); }}
      onFocus={event => event.stopPropagation()}
      onBlur={event => event.stopPropagation()}
    >
      <div className="modal-box @container/form relative max-h-[calc(100dvh-2rem)] w-full max-w-3xl space-y-4 p-4 sm:p-6">
        <header className="space-y-1 pr-10">
          <h2 ref={headingRef} id={titleId} tabIndex={-1} className="text-xl font-semibold outline-none">Editar avatar</h2>
          <p id={hintId} className="text-sm text-base-content/65">Ajusta el recorte y las dimensiones. Al confirmar, se subirá el avatar.</p>
        </header>
        <button type="button" className="btn btn-circle btn-ghost btn-sm absolute top-3 right-3" aria-label="Cerrar editor de avatar" onClick={onCancel}><X size={18} aria-hidden="true" /></button>
        {children}
      </div>
    </dialog>,
    document.body,
  );
}
