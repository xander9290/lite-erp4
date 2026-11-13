# Módulos declarativos

Guía para crear aplicaciones con `defineModule` (fases 2–4 del
[plan](ideas/modulos-declarativos.md)). Un módulo se compone de un manifest y clases
de modelo; rutas, acciones, servicios, repositorio y vistas salen por convención.
Sólo se escribe TSX para lo que se personaliza.

> Estado: prototipo en la rama `refactor/modulos-declarativos`. Autorización por
> grupos, permisos por modelo y reglas de registro (sección 5); sin grupos, sólo administradores.
> Contactos y Usuarios conservan su flujo anterior. Citas y la Flota anterior fueron retiradas.

## Estructura

```
src/modules/<id>/manifest.ts        obligatorio: defineModule(...)
src/modules/<id>/models/*.ts        clases de modelo (server-only)
src/modules/<id>/views/*.tsx        opcional: vistas expulsadas con eject:view
src/modules/index.ts                módulos instalados (import explícito)
```

## 1. Declarar el módulo

```bash
npm run create:module -- biblioteca --dry-run
npm run create:module -- biblioteca
npm run create:model -- biblioteca Libro --dry-run
npm run create:model -- biblioteca Libro
```

`create:module` crea el manifest mínimo y registra su import en `src/modules/index.ts`.
El módulo vacío no aparece en el cajón y su ruta devuelve 404 hasta añadir un modelo.
`create:model` detecta el manifest, crea `models/libro.ts` con `name`/`active` y
añade `libro: Libro` con su import. La clave es el nombre de clase en minúsculas.
No crea vistas ni clientFields: personaliza la clase y ejecuta `orm:sync` antes de
abrir la aplicación. Nombre, icono, menús, grupos, permisos y reglas son decisiones
que puedes editar en el manifest; sin menú se deriva un enlace por modelo y sin
grupos el acceso sigue limitado a administradores.

Ambos comandos admiten `--dry-run` sin escrituras, rechazan colisiones, rutas
estáticas del mismo ID, enlaces y declaraciones ambiguas. No sobrescriben modelos
ni manifests existentes; las ediciones del registro y del manifest se limitan a su
AST. El `create:model` de aplicaciones con `orm.config.ts` conserva su flujo anterior.
No hay SQL en estos comandos. `create:views` sigue siendo del flujo anterior;
para módulos usa las vistas por defecto o `eject:view`.

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
registra el módulo en `src/modules/index.ts` si falta, sin duplicarlo, y avisa de
**reiniciar `npm run dev`** (el cliente Prisma cambió). El índice se revisa antes de
consultar la base; se escribe después de aplicar/verificar el esquema y generar
Prisma, antes de TypeScript. Un error posterior conserva los pasos completados.
`--plan` también muestra el registro pendiente sin escribir ni consultar la base.
Si el manifest está vacío, pide crear el primer modelo antes de sincronizar.

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

## 5. Control de accesos

Como `res.groups`, `ir.model.access` e `ir.rule` de Odoo, declarado en el manifest:

```ts
groups: {
  usuario: "Usuario",
  responsable: { label: "Responsable", implies: ["usuario"] },
},
access: [
  { group: "usuario", models: "tarea", perms: "cru" },          // c=crear r=leer u=editar d=eliminar
  { group: "usuario", models: "categoria", perms: "r" },
  { group: "responsable", models: ["tarea", "categoria"], perms: "crud" },
],
rules: [
  { id: "tareas-propias", label: "Sólo mis tareas", models: "tarea", groups: ["usuario"],
    domain: ({ actor }) => [{ field: "createBy", operator: "eq", value: actor.id }] },
  { id: "tareas-todas", label: "Todas las tareas", models: "tarea", groups: ["responsable"], domain: [] },
],
```

- **Grupos**: id público `<módulo>.<clave>`; `implies` hereda permisos y reglas.
- **Permisos**: un usuario puede una operación si alguno de sus grupos la concede.
- **Reglas de registro**: dominios con la sintaxis de `defineListAction` (estáticos o
  callback con `actor`). Sin `groups` son globales y se combinan con AND; con
  `groups`, las de los grupos del usuario se combinan con OR (por eso el responsable
  necesita su regla «todas»). `operations` limita a qué operaciones aplican.
- Se aplican en lista, conteo, grupos, kanban, lookup, lectura, guardado (antes y
  después de escribir), movimiento, borrado, reacciones, historial y notas. Un
  registro fuera de las reglas se comporta como inexistente.
- **Superusuario**: `isAdmin` tiene acceso total. Un módulo sin `groups` sigue
  siendo sólo para administradores.
- La app **Control de accesos** (`/erp/accesos`, sólo administradores) asigna
  usuarios a grupos, ajusta permisos por modelo (se guardan sólo las diferencias
  con el manifest) y activa o desactiva reglas. Los cambios se aplican en la
  siguiente operación: los permisos se leen dentro de cada transacción.
- Cajón y menús se muestran según los grupos con lectura declarados en el código;
  es presentación: el servidor vuelve a autorizar cada operación.

Fuera de alcance por ahora: permisos por campo, multiempresa y crear reglas desde
la interfaz (los dominios son código).

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
También ejecuta `create:module → create:model → orm:sync` sobre un módulo temporal,
con aprobación exclusiva del fixture, y comprueba registro y persistencia.

Para verificar la convivencia con autenticación, Contactos, Citas y tema:

```bash
npm run test:legacy:integration
```

Este wrapper ejecuta las cuatro suites existentes en un proyecto, esquema PostgreSQL,
servidor y cuentas temporales; el seed de autenticación se aplica sólo ahí. No requiere
las credenciales del administrador del ERP. Elimina sus recursos al terminar.
