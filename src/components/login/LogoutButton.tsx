"use client";

import { useState } from "react";
import { LogOut } from "lucide-react";
import { logoutAction } from "@/lib/auth/actions";
import { useAlerts } from "../ui/alerts/AlertProvider";
import { useRouter } from "next/navigation";
import { useFormNavigation } from "../ui/form/FormNavigationProvider";

export default function LogoutButton({ variant = "icon", onSelect }: { variant?: "icon" | "menu"; onSelect?: () => void }) {
  const [busy, setBusy] = useState(false);
  const alerts = useAlerts();
  const router = useRouter();
  const navigation = useFormNavigation();
  return <button type="button" aria-label="Cerrar sesión" title="Cerrar sesión" disabled={busy} className={variant === "menu" ? "flex w-full items-center gap-2 text-error" : "btn btn-square btn-ghost btn-sm"} onClick={async () => {
    onSelect?.();
    setBusy(true);
    try { await navigation.run(async () => { await logoutAction(); router.replace("/auth"); router.refresh(); }); }
    catch {
      await alerts.error({ title: "No se pudo cerrar la sesión", message: "Intenta nuevamente." });
    } finally { setBusy(false); }
  }}>{busy ? <span className="loading loading-spinner loading-xs" /> : <LogOut size={17} aria-hidden="true" />}{variant === "menu" && <span>{busy ? "Cerrando sesión…" : "Salir"}</span>}</button>;
}
