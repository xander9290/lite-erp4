"use client";

import { useId, useLayoutEffect, useRef, useSyncExternalStore, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

export type ModalProps = {
  open: boolean;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  icon?: ReactNode;
  tone?: "primary" | "info" | "error" | "warning";
  role?: "dialog" | "alertdialog";
  onClose?: () => void;
  closeOnBackdrop?: boolean;
  closeOnEscape?: boolean;
  initialFocusRef?: RefObject<HTMLElement | null>;
  size?: "sm" | "md" | "lg";
};

const tones = { primary: "bg-primary/10 text-primary", info: "bg-info/10 text-info", error: "bg-error/10 text-error", warning: "bg-warning/10 text-warning" };
const subscribeHydration = () => () => {};
const clientReady = () => true;
const serverReady = () => false;

export default function Modal({ open, title, children, footer, icon, tone = "primary", role = "dialog", onClose,
  closeOnBackdrop = true, closeOnEscape = true, initialFocusRef, size = "md" }: ModalProps) {
  const id = useId();
  const ready = useSyncExternalStore(subscribeHydration, clientReady, serverReady);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || !open) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog.showModal();
    (initialFocusRef?.current ?? heading.current)?.focus({ preventScroll: true });
    return () => {
      dialog.close();
      if (previous?.isConnected && !previous.matches(":disabled") && !previous.closest("[inert], [hidden]")) previous.focus({ preventScroll: true });
    };
  }, [open, initialFocusRef, ready]);

  return ready && open ? createPortal(<dialog ref={dialogRef} role={role} aria-labelledby={`${id}-title`} aria-describedby={`${id}-content`}
    className="modal modal-middle p-3 backdrop:bg-black/35 backdrop:backdrop-blur-xs sm:p-5"
    onCancel={event => { event.preventDefault(); if (closeOnEscape) onClose?.(); }}
    onClick={event => { if (event.target === event.currentTarget && closeOnBackdrop) onClose?.(); }}>
    <div className={`modal-box flex max-h-[calc(100dvh-2rem)] w-full min-w-0 flex-col gap-5 rounded-2xl border border-base-300 bg-base-100 p-5 shadow-2xl sm:p-6 ${size === "sm" ? "max-w-sm" : size === "lg" ? "max-w-3xl" : "max-w-md"}`}>
      <header className="flex min-w-0 items-start gap-3">
        {icon && <span aria-hidden="true" className={`flex size-11 shrink-0 items-center justify-center rounded-2xl ${tones[tone]}`}>{icon}</span>}
        <h2 ref={heading} id={`${id}-title`} tabIndex={-1} className="min-w-0 flex-1 self-center text-lg font-semibold tracking-tight wrap-anywhere outline-none">{title}</h2>
        {onClose && <button type="button" aria-label="Cerrar diálogo" className="btn btn-circle btn-ghost btn-sm -mr-1 -mt-1 shrink-0 text-base-content/45" onClick={onClose}><X size={17} aria-hidden="true" /></button>}
      </header>
      <div id={`${id}-content`} className="min-h-0 min-w-0 overflow-y-auto text-sm leading-relaxed text-base-content/70">{children}</div>
      {footer && <footer className="flex shrink-0 flex-wrap justify-end gap-2 border-t border-base-300 pt-4">{footer}</footer>}
    </div>
  </dialog>, document.body) : null;
}
