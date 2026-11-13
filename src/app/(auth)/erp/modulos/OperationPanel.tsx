"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import FormViewLoader from "@/components/ui/form/FormViewLoader";
import Breadcrumbs from "@/components/ui/Breadcrumbs";
import { useAlerts } from "@/components/ui/alerts/AlertProvider";
import type { ManagedModule } from "@/lib/module-manager/types";
import type { DataPolicy, ModuleOperation, ModuleOperationPlan } from "@/lib/module-manager/operation.types";
import { moduleOperation } from "./actions";

const labels = { install: "Instalar", update: "Actualizar", uninstall: "Desinstalar" };
const route = (module: string, job: string) => `/erp/modulos/${encodeURIComponent(module)}/operaciones/${job}`;

export default function OperationPanel({ record }: { record: ManagedModule }) {
  const [operation, setOperation] = useState<ModuleOperation>(record.status === "retained" ? "install" : record.managed ? "update" : "install");
  const [policy, setPolicy] = useState<DataPolicy>("keep");
  const [busy, setBusy] = useState(false);
  const alerts = useAlerts(), router = useRouter();
  const review = async () => {
    setBusy(true);
    try {
      const result = await moduleOperation({ command: "review", input: { module: record.id, operation, policy: operation === "uninstall" ? policy : "keep" } });
      if (result.ok) router.push(route(record.id, result.plan.id));
      else await alerts.error({ title: "No se pudo preparar el plan", message: result.error });
    } catch { await alerts.error({ title: "No se pudo confirmar el plan", message: "Comprueba la conexión e intenta nuevamente." }); }
    finally { setBusy(false); }
  };
  return <section className="space-y-3 rounded-box border border-base-300 p-3 text-sm" aria-label="Operaciones">
    <h2 className="font-semibold">Operaciones</h2>
    <p>Revisa el alcance antes de aplicar cambios. La desinstalación conserva los datos por defecto.</p>
    {process.env.NODE_ENV === "production" ? <p>En este despliegue las operaciones de esquema se realizan mediante el flujo de desarrollo y despliegue revisado.</p> : <div className="flex flex-wrap items-end gap-3">
      <label className="flex flex-col gap-1">Operación<select className="select select-sm" autoComplete="off" value={operation} disabled={busy} onChange={event => setOperation(event.target.value as ModuleOperation)}>{Object.entries(labels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      {operation === "uninstall" && <label className="flex flex-col gap-1">Datos<select className="select select-sm" autoComplete="off" value={policy} disabled={busy} onChange={event => setPolicy(event.target.value as DataPolicy)}><option value="keep">Conservar datos</option><option value="drop">Eliminar datos</option></select></label>}
      <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => { void review(); }}>{busy ? "Preparando…" : "Revisar plan"}</button>
    </div>}
  </section>;
}

function PlanConsole({ initial }: { initial: ModuleOperationPlan }) {
  const [plan, setPlan] = useState(initial);
  const [confirmation, setConfirmation] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [busy, setBusy] = useState(false);
  const alerts = useAlerts();
  const execute = async (command: "apply" | "finish" | "status") => {
    if (command === "apply" && !await alerts.confirm({ title: `${labels[plan.operation]} ${plan.name}`, message: plan.policy === "drop" && plan.operation === "uninstall" ? "Se eliminarán los datos indicados. El servidor verificará un respaldo restaurado antes de aplicar el SQL mostrado." : "Se aplicará el plan mostrado y el ERP entrará en mantenimiento. Conserva esta página para comprobar el resultado.", confirmLabel: "Aplicar plan", danger: plan.operation === "uninstall" && plan.policy === "drop" })) return;
    setBusy(true);
    try {
      const result = await moduleOperation(command === "status" ? { command, id: plan.id } : command === "finish" ? { command, id: plan.id, maintenanceConfirmed: true } : { command, id: plan.id, fingerprint: plan.fingerprint, confirmedModule: plan.policy === "drop" && plan.operation === "uninstall" ? confirmation : plan.module, maintenanceConfirmed: true });
      if (result.ok) { setPlan(result.plan); setAcknowledged(false); }
      else { await alerts.error({ title: "Operación no completada", message: result.error }); const current = await moduleOperation({ command: "status", id: plan.id }); if (current.ok) setPlan(current.plan); }
    } catch { await alerts.error({ title: "Resultado no confirmado", message: "Consulta esta operación antes de reintentar. El ejecutor puede haber completado algunos pasos." }); }
    finally { setBusy(false); }
  };
  const destructive = plan.operation === "uninstall" && plan.policy === "drop";
  return <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-2 sm:p-3">
    <Breadcrumbs items={[{ label: "Aplicaciones", href: "/erp" }, { label: "Módulos", href: "/erp/modulos" }, { label: plan.name, href: `/erp/modulos/${encodeURIComponent(plan.module)}` }, { label: "Revisar operación" }]} />
    <h1 className="sr-only">{labels[plan.operation]} {plan.name}</h1>
    <section className="space-y-3 rounded-box border border-base-300 p-3 text-sm">
      <h2 className="font-semibold">{labels[plan.operation]} {plan.name}</h2>
      <p>{plan.operation === "uninstall" ? destructive ? "Eliminar datos e identidad instalada" : "Retirar la aplicación conservando sus datos" : "Sincronizar esquema y acceso a datos conservando las vistas personalizadas"}</p>
      <p role="status">{busy ? "Ejecutando. Puedes consultar esta operación después de un reinicio." : plan.message}</p>
      {plan.blockers.length > 0 && <div className="rounded-box bg-warning/10 p-3"><p className="mb-2 font-medium">Antes de continuar:</p><ul className="list-inside list-disc">{plan.blockers.map(blocker => <li key={blocker}>{blocker}</li>)}</ul></div>}
      <ul className="list-inside list-disc text-base-content/70">{plan.warnings.map(warning => <li key={warning}>{warning}</li>)}</ul>
      {plan.recordCounts && <ul>{plan.recordCounts.map(row => <li key={row.table}>{row.table}: {row.count} registros</li>)}</ul>}
    </section>
    <section className="space-y-3 rounded-box border border-base-300 p-3 text-sm">
      <h2 className="font-semibold">SQL para revisar</h2>
      {plan.sql.trim() ? <pre tabIndex={0} className="max-h-80 overflow-auto rounded-box bg-base-200 p-3 text-xs">{plan.sql}</pre> : <p>Esta operación no propone cambios SQL.</p>}
      <details><summary className="cursor-pointer">Archivos afectados ({plan.changes.length})</summary><ul className="mt-2 space-y-1">{plan.changes.map(change => <li key={change.path} className="break-all"><span className="font-medium">{change.action === "delete" ? "Retirar" : change.action === "create" ? "Crear" : "Actualizar"}</span> · {change.path}</li>)}</ul></details>
    </section>
    <section className="space-y-3 rounded-box border border-base-300 p-3 text-sm">
      {plan.phase === "review" && !plan.blockers.length && <>
        <label className="flex items-start gap-2"><input type="checkbox" className="checkbox checkbox-sm" autoComplete="off" checked={acknowledged} disabled={busy} onChange={event => setAcknowledged(event.target.checked)} /><span>Revisé el plan y cerré otras instancias y tareas que puedan escribir en esta base. Aplicaré la operación en desarrollo y reiniciaré el servidor al terminar.</span></label>
        {destructive && <label className="flex flex-col gap-1">Escribe «{plan.module}» para confirmar la eliminación<input className="input input-sm" autoComplete="off" value={confirmation} disabled={busy} onChange={event => setConfirmation(event.target.value)} /></label>}
        <button type="button" className={`btn btn-sm ${destructive ? "btn-error" : "btn-primary"}`} disabled={busy || !acknowledged || (destructive && confirmation !== plan.module)} onClick={() => { void execute("apply"); }}>Aplicar plan</button>
      </>}
      {plan.canFinish && <>
        <label className="flex items-start gap-2"><input type="checkbox" className="checkbox checkbox-sm" autoComplete="off" checked={acknowledged} disabled={busy} onChange={event => setAcknowledged(event.target.checked)} /><span>{plan.phase === "failed" ? "Revisé el resultado: el fallo ocurrió antes de preparar cambios. Quiero cerrar este mantenimiento." : "Reinicié el servidor y comprobé que ninguna instancia anterior sigue sirviendo la aplicación."}</span></label>
        <button type="button" className="btn btn-primary btn-sm" disabled={busy || !acknowledged} onClick={() => { void execute("finish"); }}>Finalizar mantenimiento</button>
      </>}
      {plan.phase === "failed" && <p>Los pasos completados pueden conservarse. Revisa las migraciones y el estado del proyecto antes de preparar otra operación; no retires locks ni hashes sin comprobar qué proceso sigue activo.</p>}
      <div className="flex flex-wrap gap-2"><button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => { void execute("status"); }}>Consultar resultado</button><Link href="/erp/modulos" className="btn btn-ghost btn-sm">Volver a módulos</Link></div>
    </section>
  </div>;
}

export function OperationRecord({ id, module }: { id: string; module: string }) {
  const load = useCallback(async () => {
    const result = await moduleOperation({ command: "status", id });
    return result.ok && result.plan.module === module ? { ok: true as const, values: result.plan } : { ok: false as const, error: result.ok ? "Operación no disponible." : result.error };
  }, [id, module]);
  return <FormViewLoader recordKey={id} load={load}>{plan => <PlanConsole initial={plan} />}</FormViewLoader>;
}
