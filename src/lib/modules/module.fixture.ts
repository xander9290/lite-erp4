import "server-only";
import { Fields, Model, ModelValidationError } from "@/lib/orm";
import { defineModule } from "./define";

export class Categoria extends Model {
  name = Fields.Text({ label: "Nombre", required: true, maxLength: 80, tracking: true });
  active = Fields.Boolean({ label: "Activa", default: true });
}

export class Tarea extends Model {
  name = Fields.Text({ label: "Título", required: true, maxLength: 120, tracking: true, searchable: true });
  categoria = Fields.Many2one("UnitCategoria", { label: "Categoría", required: true, tracking: true });
  estado = Fields.Selection([
    { value: "pendiente", label: "Pendiente" },
    { value: "curso", label: "En curso" },
    { value: "hecha", label: "Hecha" },
  ], { label: "Estado", required: true, default: "pendiente", tracking: true });
  // Presentation options: the list policy (search, order, filters, groups) is declared on each Field.
  prioridad = Fields.Integer({ label: "Prioridad", min: 1, max: 5, default: 3, groupable: true });
  vence = Fields.DateTime({ label: "Vence" });

  // Business rules stay in the model and run on the server.
  normalize(values: Readonly<Record<string, unknown>>) {
    return { ...values, name: typeof values.name === "string" ? values.name.replace(/\s+/g, " ") : values.name };
  }
  beforeSave(values: Record<string, unknown>) {
    if (values.estado === "hecha" && values.prioridad === 5) throw new ModelValidationError("Revisa la tarea.", { prioridad: "Una tarea urgente no puede cerrarse sin revisión." });
    return values;
  }
}

/** Independent unit fixture; never installed and never imports a tutorial module. */
export default defineModule({
  id: "unit", name: "Unit módulos", icon: "flask-conical",
  models: { tarea: { model: Tarea, kanban: "estado" }, categoria: Categoria },
  menu: {
    Tareas: "tarea",
    Configuración: { Categorías: "categoria" },
  },

  // Control de accesos (como res.groups, ir.model.access e ir.rule de Odoo).
  groups: {
    usuario: "Usuario",
    responsable: { label: "Responsable", implies: ["usuario"] },
  },
  access: [
    { group: "usuario", models: "tarea", perms: "cru" },
    { group: "usuario", models: "categoria", perms: "r" },
    { group: "responsable", models: ["tarea", "categoria"], perms: "crud" },
  ],
  rules: [
    // Un usuario sólo ve y edita sus propias tareas; el responsable, todas (reglas de grupo con OR).
    { id: "tareas-propias", label: "Sólo mis tareas", models: "tarea", groups: ["usuario"], domain: ({ actor }) => [{ field: "createBy", operator: "eq", value: actor.id }] },
    { id: "tareas-todas", label: "Todas las tareas", models: "tarea", groups: ["responsable"], domain: [] },
  ],
});
