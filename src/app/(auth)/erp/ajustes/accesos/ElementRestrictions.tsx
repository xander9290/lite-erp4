import type { groupDetail } from "@/lib/access/admin";
import { fieldRestrictionKeys } from "@/lib/access/element-policy";
import ActionForm from "./ActionForm";
import { saveFieldRestrictions, saveActionRestrictions } from "./actions";

type Detail = NonNullable<Awaited<ReturnType<typeof groupDetail>>>;
const labels = { noRead: "No leer", noWrite: "No escribir", invisible: "Invisible", readOnly: "Sólo lectura" };

export function FieldRestrictions({ group, fields }: { group: string; fields: Detail["fields"] }) {
  return <section className="col-span-full space-y-3 p-3" aria-label="Restricciones de campos">
    <p className="text-sm text-base-content/70">Sin marcar conserva el comportamiento normal. No leer impide entregar el valor e implica no escribir. Invisible y sólo lectura son presentación.</p>
    <ActionForm action={saveFieldRestrictions} label="Guardar campos">
      <input type="hidden" name="group" value={group} />
      <div className="overflow-x-auto"><table className="table table-sm">
        <thead><tr><th>Modelo</th><th>Campo</th>{fieldRestrictionKeys.map(key => <th key={key}>{labels[key]}</th>)}</tr></thead>
        <tbody>{fields.map(field => {
          const identity = `${field.model}|${field.field}`;
          return <tr key={identity}><td>{field.modelLabel}<input type="hidden" name="field" value={identity} /></td><td>{field.label}</td>
            {fieldRestrictionKeys.map(key => <td key={key}><input type="checkbox" className="checkbox checkbox-sm" name={`${identity}|${key}`} defaultChecked={field.policy[key]} aria-label={`${labels[key]} ${field.modelLabel}: ${field.label}`} /></td>)}
          </tr>;
        })}</tbody>
      </table></div>
    </ActionForm>
  </section>;
}

export function ActionRestrictions({ group, actions }: { group: string; actions: Detail["actions"] }) {
  return <section className="col-span-full space-y-3 p-3" aria-label="Restricciones de acciones">
    <p className="text-sm text-base-content/70">Bloquear oculta el botón e impide ejecutar la acción en el servidor. Sin marcar conserva sus permisos y condiciones habituales.</p>
    {actions.length ? <ActionForm action={saveActionRestrictions} label="Guardar acciones">
      <input type="hidden" name="group" value={group} />
      <div className="overflow-x-auto"><table className="table table-sm"><thead><tr><th>Modelo</th><th>Acción</th><th>Bloquear</th></tr></thead>
        <tbody>{actions.map(action => {
          const identity = `${action.model}|${action.name}`;
          return <tr key={identity}><td>{action.modelLabel}<input type="hidden" name="action" value={identity} /></td><td>{action.label}</td><td><input type="checkbox" className="checkbox checkbox-sm" name={`${identity}|blocked`} defaultChecked={action.blocked} aria-label={`Bloquear ${action.modelLabel}: ${action.label}`} /></td></tr>;
        })}</tbody>
      </table></div>
    </ActionForm> : <p className="text-sm text-base-content/60">Este módulo no declara acciones de modelo.</p>}
  </section>;
}
