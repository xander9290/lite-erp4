# Plan: módulos declarativos y Control de accesos

Acordado con el usuario el 2026-11-12. Ejecución prevista desde el 2026-11-13.
Estado: **plan aprobado en lo general, sin implementación**. Cada fase requiere
aprobación del usuario antes de iniciar la siguiente.

## Objetivo

Desarrollar módulos con mucho menos código, al estilo Odoo/Django, conservando
TS/Prisma, TSX explícito cuando se personaliza, autorización de servidor,
transacciones, revisión/concurrencia y auditoría.

Meta de experiencia: un módulo se compone de `manifest.ts` y clases de modelo;
lista, formulario, búsqueda, lookup, historial, eliminación, rutas y menú salen
por convención. Sólo se escribe TSX para lo que se personaliza.

```ts
// src/modules/flota/models/fabricante.ts (forma orientativa, no contrato)
export class Fabricante extends Model {
  name   = Fields.Text({ required: true, maxLength: 120, searchable: true, tracking: true });
  logo   = Fields.Image({ folder: "flota-fabricantes" });
  active = Fields.Boolean({ default: true });
}
```

## Decisiones acordadas

- Avance por fases con aprobación entre cada una; empezar por medición y diseño.
- Trabajo en una rama propia; antes, commit del trabajo pendiente **sólo con
  autorización del usuario** (hoy hay app Flota, 6 migraciones y artefactos sin versionar).
- No tocar Flota hasta la fase final; entonces se adapta como **módulo de
  referencia** del nuevo enfoque (autorizado por el usuario). Al llegar ahí,
  actualizar la regla de tutoría en AGENTS.md.
- Incluir desde el diseño una app nativa **Control de accesos** (tipo Odoo),
  aplicada en el despachador único, en lugar de `requireAdmin` disperso.
- El ejercicio pendiente de la tutoría (related del logo del fabricante en
  Vehicle) se hace **después** de migrar Flota, ya con el nuevo enfoque.
- Ningún SQL ni cambio de esquema físico sin mostrarlo y obtener aprobación.

## Piezas técnicas

1. **Ruta comodín** `/erp/[module]/[[...path]]` que resuelve modelo/vista desde el
   registro (elimina `page.tsx`, `nuevo/`, `[id]/` por modelo). Leer antes la guía
   de rutas de `node_modules/next/dist/docs/` (Next 16).
2. **Despachador único de Server Actions** `modelAction(model, op, payload)`:
   operaciones fijas (read, save, list, lookup, delete, move, react, activity);
   sólo modelos del registro; revalida sesión, permisos y revisión en la
   transacción. Reutiliza `createModelService`. Nunca métodos arbitrarios del cliente.
3. **Repositorio genérico en runtime** con delegate Prisma tomado del registro
   (lista blanca), en lugar de bindings generados por modelo. Se mantiene la
   generación de `schema.prisma`, migraciones y un índice mínimo `modules.ts`.
4. **Vistas por defecto** derivadas de metadatos + comando **eject**
   (`eject:view -- modulo Modelo form|list|card|kanban`) que copia TSX editable a
   `views/`. Si existe TSX propio, se usa ese.
5. **Opciones en Field** (`searchable`, `sortable`, `groupable`, `public`) con
   defaults; sustituyen `clientFields`, publicación en `orm.config` y política
   `list` duplicada.
6. **Convenciones de relaciones** (fase posterior a evaluar): Many2one nombrado por
   entidad con `…Id` y objeto relacionado automáticos; `displayRelations`
   inferido. Respetar la decisión existente `Vehicle.name` como FK.

## Control de accesos (app nativa)

| Pieza | Equivalente Odoo | Alcance inicial |
| --- | --- | --- |
| Grupos con herencia | `res.groups` | p. ej. Flota / Usuario ⊂ Flota / Responsable |
| Acceso por modelo | `ir.model.access` | leer/crear/editar/eliminar por grupo |
| Reglas de registro | `ir.rule` | dominios con `actor`, reutilizando el motor de dominios |
| Menús/apps por grupo | `groups` en menús | sólo presentación; el servidor verifica |
| Usuarios ↔ grupos | pestaña de permisos | asignación desde Usuarios/Control de accesos |
| Superusuario | `__system__` | `isAdmin` actual se convierte en grupo de administración |

Los módulos declaran grupos y accesos por defecto en `manifest.ts`; la app permite
verlos y ajustarlos. Se construye con el propio framework (primer uso real).

Puntos delicados: aplicar reglas en **todas** las vías (read, list, grupos, kanban,
lookup, delete, related/displayName, historial) con pruebas dedicadas; transición
sin perder accesos de cuentas actuales; cambios de permisos invalidan sesión vía
`sessionVersion`; permisos cargados una vez por transacción, sin caché global.
Citas conserva su autorización clínica hasta que las reglas cubran su caso.
Fuera de alcance inicial: permisos por campo y multiempresa.

## Fases

| # | Fase | Entregable | Aceptación | Estimado |
| --- | --- | --- | --- | --- |
| — | Preparación | Commit de lo pendiente (con autorización) y rama nueva | Árbol limpio, punto de retorno | 15 min |
| 0 | Línea base | Conteo de archivos/líneas para Fabricante y Vehicle (fuente + generado) | Números registrados en este documento | 15–30 min |
| 1 | Diseño | Antes/después de Fabricante y Vehicle, API de manifest/Field/despachador, modelo de permisos, riesgos, decisión runtime vs. generación | Aprobación del usuario | ~1 h |
| 2 | Prototipo | Ruta comodín, despachador con acceso por modelo, repositorio genérico, vistas por defecto list/form en un **módulo desechable** | Modelo nuevo con un archivo, funcionando con permisos, revisión, auditoría y eliminación | 4–8 h |
| 3 | Eject + opciones de Field | Comando eject, opciones en Field, sin duplicados | Vista personalizada sin perder comportamiento | 2–4 h |
| 4 | Control de accesos | App nativa: grupos, acceso por modelo, reglas de registro, menús, migración de `isAdmin` | Pruebas de reglas en todas las vías; cuentas actuales conservan acceso | 6–12 h |
| 5 | Convivencia | Contactos, Usuarios, Citas y Flota actuales siguen funcionando | Pruebas existentes pasan sin cambios | 1–3 h |
| 6 | Migrar Flota | Flota como módulo de referencia, con grupos Usuario/Responsable | Mismo comportamiento y datos, menos archivos frente a la línea base; guía actualizada | 1–2 h |
| 7 | Ejercicio tutoría | related del logo en Vehicle con el nuevo enfoque | Lo ejecuta el usuario | a su ritmo |

Total estimado: 16–30 h de trabajo, en unas 5–8 sesiones, más revisiones.

## Riesgos

- Seguridad del despachador único: lista blanca estricta y revalidación en transacción.
- Cambios de API en Next 16 (rutas, Server Actions): consultar su documentación local.
- Inferencia de tipos con registro dinámico: compensar con índice generado mínimo.
- Pruebas de integración PostgreSQL lentas; usar siempre proyecto/esquema temporales.
- Apps manuales (Citas, Contactos) conviven y migran sólo cuando el framework cubra su caso.

## Primeros pasos al retomar (2026-11-13)

1. Leer AGENTS.md, README, estado-proyecto y este documento; contrastar con Git.
2. Pedir autorización para el commit del trabajo pendiente y crear la rama.
3. Fase 0: medir Fabricante/Vehicle y registrar los números aquí.
4. Fase 1: redactar el diseño en este documento y presentarlo para aprobación.
