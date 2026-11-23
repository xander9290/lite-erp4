"use client";

import { createContext, useCallback, useContext, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Modal from "../alerts/Modal";
import { FormNavigationScope, useFormNavigation } from "./FormNavigationProvider";
import { FormActionsContext } from "./formActions";

const Context = createContext<{ setBusy: (busy: boolean) => void } | null>(null);

/** Publish FormView's lock to its enclosing dialog, including save → action cycles. */
export function FormDialogLock() {
  const dialog = useContext(Context);
  const form = useContext(FormActionsContext);
  const locked = form?.locked ?? false;
  useLayoutEffect(() => { dialog?.setBusy(locked); }, [dialog, locked]);
  useLayoutEffect(() => () => { dialog?.setBusy(false); }, [dialog]);
  return null;
}

function Dialog({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  const navigation = useFormNavigation();
  const [busy, setBusyState] = useState(false);
  const locked = useRef(false);
  const closing = useRef(false);
  const setBusy = useCallback((value: boolean) => { locked.current = value; setBusyState(value); }, []);
  const context = useMemo(() => ({ setBusy }), [setBusy]);
  const close = () => {
    if (locked.current || closing.current) return;
    closing.current = true;
    void navigation.confirm().then(accepted => {
      if (accepted && !locked.current) { navigation.discard(); onClose(); }
    }).finally(() => { closing.current = false; });
  };
  return <Context.Provider value={context}><Modal open title={title} size="xl" onClose={close} closeDisabled={busy}
    footer={<button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={close}>Cerrar</button>}>
    {children}
  </Modal></Context.Provider>;
}

/** Mount conditionally. Native dialog/portal keeps forms separate and restores trigger focus. */
export default function FormDialog(props: { title: string; children: ReactNode; onClose: () => void }) {
  return <FormNavigationScope><Dialog {...props} /></FormNavigationScope>;
}
