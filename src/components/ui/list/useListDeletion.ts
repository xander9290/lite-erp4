"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { useAlerts } from "../alerts/AlertProvider";
import type { ListDeleteResult, ListDeleteTarget } from "@/lib/list/selection";

export function useListDeletion(snapshot: object | null) {
  const alerts = useAlerts();
  const mounted = useRef(true);
  const inFlight = useRef(false);
  const [busy, setBusy] = useState(false);
  const currentSnapshot = useRef(snapshot);
  useLayoutEffect(() => { currentSnapshot.current = snapshot; }, [snapshot]);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  async function run(targets: readonly ListDeleteTarget[], action: (targets: readonly ListDeleteTarget[]) => Promise<ListDeleteResult>, refresh: () => void) {
    if (inFlight.current || !targets.length) return;
    inFlight.current = true; setBusy(true);
    const selectedSnapshot = currentSnapshot.current;
    let attempted = false;
    let close = () => {};
    try {
      const confirmed = await alerts.confirm({ title: targets.length === 1 ? "Eliminar registro" : "Eliminar registros",
        message: `Se eliminará${targets.length === 1 ? "" : "n"} ${targets.length} registro${targets.length === 1 ? "" : "s"} seleccionado${targets.length === 1 ? "" : "s"}. Esta acción no se puede deshacer.`,
        confirmLabel: "Eliminar", cancelLabel: "Cancelar", danger: true });
      if (!confirmed || !mounted.current) return;
      if (currentSnapshot.current !== selectedSnapshot) {
        await alerts.info({ title: "La lista cambió", message: "Vuelve a seleccionar los registros que deseas eliminar." });
        return;
      }
      attempted = true;
      close = alerts.loading({ title: "Eliminando…", message: "Espera mientras se elimina la selección." });
      const result = await action(targets);
      close();
      if (!mounted.current) return;
      if (result?.ok && result.deleted === targets.length) toast.success(`${result.deleted} registro${result.deleted === 1 ? " eliminado" : "s eliminados"}.`);
      else if (result && !result.ok) await (result.kind === "validation" ? alerts.validation : alerts.error)({ title: "No se pudo eliminar", message: result.error });
      else await alerts.error({ title: "No se pudo confirmar la eliminación", message: "Comprueba la lista antes de volver a intentarlo." });
    } catch {
      close();
      if (mounted.current) await alerts.error({ title: "No se pudo confirmar la eliminación", message: "Revisa tu conexión y comprueba la lista antes de volver a intentarlo." });
    } finally {
      close(); inFlight.current = false;
      if (mounted.current) setBusy(false);
      // An expanded group can close while the request is in flight. Its parent
      // still needs fresh counts, including when the network outcome is unknown.
      if (attempted) refresh();
    }
  }
  return { busy, run };
}
