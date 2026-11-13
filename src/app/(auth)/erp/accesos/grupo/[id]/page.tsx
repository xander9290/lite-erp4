import { Suspense } from "react";
import { notFound } from "next/navigation";
import Breadcrumbs from "@/components/ui/Breadcrumbs";
import { requireAdmin } from "@/lib/auth/access";
import { prisma } from "@/lib/prisma";
import { groupDetail } from "@/lib/access/admin";
import { accessOperations } from "@/lib/access/declare";
import ActionForm from "../../ActionForm";
import { saveMembers, saveModelAccess, saveRules } from "../../actions";
import { accessManifest } from "../../manifest";

type Props = { params: Promise<{ id: string }> };
const operationLabels = { read: "Leer", create: "Crear", write: "Editar", unlink: "Eliminar" } as const;

async function Group({ params }: Props) {
  const { id } = await params;
  const detail = await groupDetail(prisma, await requireAdmin(), decodeURIComponent(id));
  if (!detail) notFound();
  const { group, users, models, rules } = detail;
  return <>
    <Breadcrumbs items={[{ label: "Aplicaciones", href: "/erp" }, { label: accessManifest.name, href: "/erp/accesos" }, { label: group.label }]} />
    <header className="space-y-1">
      <h1 className="text-lg font-semibold">{group.label} <code className="text-xs font-normal text-base-content/50">{group.id}</code></h1>
      {group.implies.length > 0 && <p className="text-sm text-base-content/70">Incluye los permisos de: {group.implies.join(", ")}.</p>}
    </header>

    <section aria-labelledby="miembros" className="space-y-2 rounded-box border border-base-300 p-3">
      <h2 id="miembros" className="font-semibold">Miembros</h2>
      <ActionForm action={saveMembers} label="Guardar miembros">
        <input type="hidden" name="group" value={group.id} />
        <ul className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
          {users.map(user => <li key={user.id}>
            <label className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 hover:bg-base-200">
              <input type="checkbox" className="checkbox checkbox-sm" name="user" value={user.id} defaultChecked={user.member} />
              <span className="min-w-0 wrap-anywhere">{user.name} <span className="text-xs text-base-content/50">({user.login})</span></span>
              {user.isAdmin && <span className="badge badge-ghost badge-sm">admin</span>}
              {!user.active && <span className="badge badge-ghost badge-sm">inactivo</span>}
            </label>
          </li>)}
        </ul>
      </ActionForm>
    </section>

    <section aria-labelledby="permisos" className="space-y-2 rounded-box border border-base-300 p-3">
      <h2 id="permisos" className="font-semibold">Permisos por modelo</h2>
      <p className="text-xs text-base-content/60">Marcados según el manifest; un cambio se guarda como ajuste y, si vuelve a coincidir con el manifest, el ajuste se elimina.</p>
      <ActionForm action={saveModelAccess} label="Guardar permisos">
        <input type="hidden" name="group" value={group.id} />
        <div className="overflow-x-auto">
          <table className="table table-sm">
            <thead><tr><th>Modelo</th>{accessOperations.map(operation => <th key={operation} className="text-center">{operationLabels[operation]}</th>)}<th /></tr></thead>
            <tbody>
              {models.map(model => <tr key={model.id}>
                <td className="wrap-anywhere">{model.label}<input type="hidden" name="model" value={model.id} /></td>
                {accessOperations.map(operation => <td key={operation} className="text-center">
                  <input type="checkbox" className="checkbox checkbox-sm" name={`${model.id}|${operation}`} defaultChecked={model.perms[operation]} aria-label={`${operationLabels[operation]} ${model.label}`} />
                </td>)}
                <td>{model.overridden && <span className="badge badge-warning badge-sm">ajustado</span>}</td>
              </tr>)}
            </tbody>
          </table>
        </div>
      </ActionForm>
    </section>

    <section aria-labelledby="reglas" className="space-y-2 rounded-box border border-base-300 p-3">
      <h2 id="reglas" className="font-semibold">Reglas de registro</h2>
      {rules.length ? <ActionForm action={saveRules} label="Guardar reglas">
        <ul className="space-y-1">
          {rules.map(rule => <li key={rule.id}>
            <input type="hidden" name="rule" value={rule.id} />
            <label className="flex cursor-pointer flex-wrap items-center gap-2 rounded px-1 py-1 hover:bg-base-200">
              <input type="checkbox" className="toggle toggle-sm" name={`active|${rule.id}`} defaultChecked={rule.active} />
              <span>{rule.label}</span>
              <span className="badge badge-ghost badge-sm">{rule.scope === "global" ? "global" : "de grupo"}</span>
              <code className="text-xs text-base-content/50">{rule.id}</code>
            </label>
          </li>)}
        </ul>
      </ActionForm> : <p className="text-sm text-base-content/60">Sin reglas para este grupo.</p>}
    </section>
  </>;
}

export default function GroupPage(props: Props) {
  return <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-2 sm:p-3">
    <Suspense fallback={<p role="status" className="text-sm text-base-content/60">Cargando grupo…</p>}><Group {...props} /></Suspense>
  </div>;
}
