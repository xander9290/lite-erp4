# Módulos declarativos

Guía para crear aplicaciones con `defineModule` (fases 2–3 del
[plan](ideas/modulos-declarativos.md)). Un módulo se compone de un manifest y clases
de modelo; rutas, acciones, servicios, repositorio y vistas salen por convención.
Sólo se escribe TSX para lo que se personaliza.

> Estado: prototipo en la rama `refactor/modulos-declarativos`. Autorización
> actual: sólo administradores (los grupos de Control de accesos llegan en la fase 4).
> Las apps existentes (Contactos, Usuarios, Citas, Flota) siguen con su flujo anterior.

## Estructura

```
src/modules/<id>/manifest.ts        obligatorio: defineModule(...)
src/modules/<id>/models/*.ts        clases de modelo (server-only)
src/modules/<id>/views/*.tsx        opcional: vistas expulsadas con eject:view
src/modules/index.ts                módulos instalados (import explícito)
```

## 1. Declarar el módulo

```ts
// src/modules/demo/manifest.ts
export default defineModule({
  id: "demo",                       // minúsculas, sin guiones
  name: "Demo módulos",
  icon: "flask-conical",            // nombre de icono Lucide (no el componente)
  models: {
    tarea: { model: Tarea, kanban: "estado" },
    categoria: Categoria,
  },
  menu: { Tareas: "tarea", Configuración: { Categorías: "categoria" } },
});
```

Cada clave de `models` define la convención completa. Para `demo.tarea`:

| Elemento | Valor |
| --- | --- |
| Id público (acciones) | `demo.tarea` |
| Modelo Prisma / tabla | `DemoTarea` / `demo_tarea` (`table` lo sobrescribe) |
| Rutas | `/erp/demo/tarea`, `/nuevo`, `/<id>` |
| Menú | etiqueta del `menu`, o la clave capitalizada |

Opciones por modelo: `table`, `list` (sobrescribe la política), `kanban` (Selection
obligatoria), `view: "list" | "card"`, `defaultSort` y `views` (ver eject).

No importes `lucide-react` ni vistas de forma estática en el manifest: `orm:sync` lo
carga desde scripts sin React.

## 2. Declarar el modelo

La lógica de negocio vive en la clase y corre sólo en el servidor: Fields,
`normalize`, `beforeSave`/`afterSave`, `@onchange`, `@depends`, `@constraint` y
`@displayName` funcionan igual que en los modelos existentes.

```ts
export class Tarea extends Model {
  name = Fields.Text({ label: "Título", required: true, maxLength: 120, tracking: true, searchable: true });
  categoria = Fields.Many2one("DemoCategoria", { label: "Categoría", required: true });
  prioridad = Fields.Integer({ label: "Prioridad", min: 1, max: 5, default: 3, groupable: true });

  beforeSave(values: Record<string, unknown>) {
    if (values.estado === "hecha" && values.prioridad === 5) throw new ModelValidationError("Revisa la tarea.", { prioridad: "..." });
    return values;
  }
}
```

Many2one entre modelos de módulos usa el nombre Prisma (`"DemoCategoria"`) y obtiene
búsqueda y etiquetas autorizadas sin configurar nada. Many2one a modelos manuales
(Partner, User) aún requiere un proveedor propio.

### Opciones de colección en cada Field

| Opción | Si no se declara | Restricciones |
| --- | --- | --- |
| `list` | `true` (máximo 12 columnas) | campos virtuales sólo admiten esta |
| `searchable` | `name` o el primer Text | sólo Text; si algún campo la declara, se usan sólo las `true` |
| `sortable` / `filterable` | todos menos Image | no Image |
| `groupable` | Boolean, Selection, Many2one | no Image ni DateTime |

Un campo con `list: false` no puede ser buscable, ordenable, filtrable ni agrupable.
Los campos `sensitive` nunca se publican. El servicio sigue fijando y validando la
política en el servidor; las vistas no la amplían.

## 3. Instalar

```bash
npm run orm:sync -- demo
```

Muestra el SQL y pide `aplicar`. Para un módulo declarativo sólo genera esquema y
migración: no hay contratos, bindings ni uploads en `src/generated/orm`. Después
registra el módulo en `src/modules/index.ts` y **reinicia `npm run dev`** (el
cliente Prisma cambió).

## 4. Personalizar una vista (eject)

```bash
npm run eject:view -- demo tarea form
```

```bash
npm run eject:view -- demo tarea list
```

Crea `views/TareaForm.tsx` o `views/TareaList.tsx` con los mismos controles que la
vista por defecto y la registra en el manifest como carga perezosa
(`views: { form: () => import("./views/TareaForm") }`). No sobrescribe archivos ni
vistas ya registradas; `--dry-run` sólo muestra el plan.

- **Formulario**: edita libremente la maquetación dentro de `<ModelForm>`, que aporta
  carga, guardado, recarga, breadcrumbs, historial y eliminación. Los controles se
  tipan con `FormValues<typeof Tarea>`: un nombre de campo inexistente no compila.
- **Lista**: ordena, renombra o restringe columnas (`{ field: "vence", label: "Fecha
  límite", filterable: false }`). Sólo campos publicados por la política del
  servidor; una columna puede quitar capacidades, nunca añadirlas.

## Seguridad

Todas las operaciones pasan por `src/lib/modules/actions.ts`: una Server Action fija
por operación que valida el id contra el registro; el servicio revalida sesión y
permisos dentro de su transacción. El navegador recibe sólo metadatos planos
(`ModelClientConfig`), nunca clases, repositorios ni dominios.

## Comprobaciones

```bash
npm run test:modules
```

```bash
npm run test:modules:integration
```

La integración instala un módulo de prueba propio (`scripts/fixtures/modules-ensayo`)
en un proyecto y esquema PostgreSQL temporales y los elimina al terminar.
