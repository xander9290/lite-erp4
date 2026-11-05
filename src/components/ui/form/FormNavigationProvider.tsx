"use client";

import { createContext, useContext, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { NavigationGuardProvider, useNavigationGuard } from "nextjs-nav-guard";
import { useAlerts } from "../alerts/AlertProvider";
import { UnsavedChanges } from "./unsavedChanges";

const Context = createContext<UnsavedChanges | null>(null);

export function useFormNavigation() {
  const guard = useContext(Context);
  if (!guard) throw new Error("FormView requiere FormNavigationProvider.");
  return guard;
}

function FormNavigation({ children }: { children: ReactNode }) {
  const alerts = useAlerts();
  const [guard] = useState(() => new UnsavedChanges(() => alerts.confirm({
    title: "Cambios sin guardar",
    message: "Tienes cambios que aún no se han guardado. Si sales ahora, se perderán.",
    confirmLabel: "Salir sin guardar",
    cancelLabel: "Seguir editando",
    danger: true,
  })));
  useNavigationGuard({ enabled: guard.blocked, confirm: guard.leave });
  return <Context.Provider value={guard}>{children}</Context.Provider>;
}

/** Mount before async layouts so history navigation is intercepted in time. */
export default function FormNavigationProvider({ children }: { children: ReactNode }) {
  return <NavigationGuardProvider><FormNavigation>{children}</FormNavigation></NavigationGuardProvider>;
}

export function useFormLeaveGuard(blocked: boolean, reset: () => void) {
  const guard = useFormNavigation();
  const dirty = useRef(false);
  useLayoutEffect(() => { dirty.current = blocked; }, [blocked]);
  useLayoutEffect(() => guard.register(() => dirty.current, () => { reset(); dirty.current = false; }), [guard, reset]);
  // reset() updates RHF immediately, before React necessarily commits a render.
  return () => { dirty.current = false; };
}
