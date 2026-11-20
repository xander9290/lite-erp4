# Módulos declarativos

Guía para crear aplicaciones con `defineModule` (fases 2–4 del
[plan](ideas/modulos-declarativos.md)). Un módulo se compone de un manifest y clases
de modelo; rutas, acciones, servicios, repositorio y vistas salen por convención.
Sólo se escribe TSX para lo que se personaliza.

> Estado: prototipo en la rama `refactor/modulos-declarativos`. Autorización por
> grupos, permisos por modelo y reglas de registro (sección 5); sin grupos, sólo administradores.
> Contactos y Usuarios conservan su flujo anterior. Citas y la Flota anterior fueron retiradas.

## Estructura

### Título de la pestaña

La ruta compartida `/erp/[module]/[[...path]]` define `generateMetadata`:
en listas usa la etiqueta del modelo, en creación «Nuevo registro» y al abrir
un registro su `displayName` canónico. Reutiliza `modelRead`, con sesión,
permisos y reglas de registro; ante fallo usa «Registro» sin publicar el error
ni el nombre. No se cachean nombres entre usuarios.

El título corresponde al registro persistido, no al borrador RHF. Guardar o
ejecutar una acción desde ModelForm refresca la ruta y sus metadatos. La carga
actual hace una lectura autorizada para metadata y otra mediante FormViewLoader;
no cambia el contrato de las vistas expulsadas ni las rutas manuales de
Contactos/Usuarios. Una futura unificación de carga debe conservar loader,
reintentos, autorización y actualización del registro sin duplicar consultas.

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

**Tarjeta en el cajón (`drawer`, 2026-11-20).** Todo módulo con modelos propios es una
aplicación con tarjeta en el cajón. `drawer: false` oculta sólo la tarjeta: sus rutas
(`/erp/<módulo>/<clave>`), su navegación al entrar, los enlaces desde otras aplicaciones
(p. ej. el menú Configuración de Contactos) y los permisos siguen igual, y el gestor de
módulos lo sigue listando. Útil para catálogos que se administran desde otra aplicación,
como las etiquetas de contacto de contactosextra:

```ts
export default defineModule({ id: "contactosextra", /* … */ drawer: false });
```

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

Los campos `related` también forman parte de la política de colección por defecto
(salvo `list: false` o una lista explícita en el manifest). Se presentan como columnas
de lectura en ListView/CardView y en sus vistas personalizadas; por ejemplo,
`{ field: "fabricanteLogo", widget: "image" }`. No admiten búsqueda, orden, filtros
ni agrupación, ni se incluyen en los valores editables del formulario.
Los Fields `compute` también se publican como lectura por convención; `list: false`
los excluye. Sus dependencias deben estar publicadas. No son filtros/orden/grupos
SQL. [Contrato de cálculo por página](campos-calculados.md#lista-card-y-kanban-2026-11-15).

`invisible: true` establece la visibilidad inicial del Field en formularios, sin
retirarlo del payload ni de la validación. En TSX, `invisible={condición}` controla
la visibilidad y `invisible={false}` anula el valor del modelo. Es presentación;
para ocultar una columna usar `list: false`. Contrato y ejemplo RHF/Zod en
[Invisible](../src/components/ui/form/FieldVisibility.md) y `/sample#field-invisible`.

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

Lista, Tarjetas y Kanban comparten ahora ModelCollection y el contrato de colección.
Registrar views.list/card/kanban como true o loader permite alternarlas sin sustituir
vistas. `view` elige la inicial; Kanban necesita su configuración del modelo.
[API, URL, proveedores, personalización y ejemplos](colecciones-modelos.md).
`eject:view` admite también card y kanban y conserva cada loader por separado.

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
- **Registros relacionados** (desde el 2026-11-17): etiquetas Many2one, rutas de
  `@displayName` (por ejemplo `modelo.fabricante.name`) y campos `related`
  respetan el permiso de lectura y las reglas **del modelo destino**. Si el actor no
  puede leer ese registro, ese tramo se presenta **vacío** (y todo lo que cuelga de
  él); el ID guardado se conserva y guardar no borra la relación. Lo resuelve el
  servidor por lotes, dentro de la misma transacción. Modelos de infraestructura
  (User, Partner) no tienen reglas de módulo. Asignar una referencia que el actor no
  puede leer todavía no se rechaza al guardar.
- **Superusuario**: `isAdmin` tiene acceso total. Un módulo sin `groups` sigue
  siendo sólo para administradores.
- `Ajustes → Accesos` (`/erp/ajustes/accesos`, sólo administradores) asigna
  usuarios a grupos, ajusta permisos por modelo (se guardan sólo las diferencias
  con el manifest) y activa o desactiva reglas. Los cambios se aplican en la
  siguiente operación: los permisos se leen dentro de cada transacción.
- Cajón y menús se muestran según los grupos con lectura declarados en el código;
  es presentación: el servidor vuelve a autorizar cada operación.
  Incorporar los ajustes de lectura guardados en Control de accesos a esta
  visibilidad está [pendiente](ideas/menus-permisos-efectivos.md).

Fuera de alcance por ahora: permisos por campo, multiempresa y crear reglas desde
la interfaz (los dominios son código).
Permisos por campo y presentación por grupo se registraron como
[pendiente de diseño](ideas/permisos-campos.md) el 2026-11-14; no están implementados.

## 6. Acciones del modelo

### Kanban mediante acciones publicadas

Un modelo puede declarar el grafo de transiciones en el manifest:

```ts
vehicle: {
  model: Vehicle,
  kanban: {
    field: "estado",
    transitions: [
      { from: "disponible", to: "mantenimiento", action: "enviarMantenimiento" },
      { from: "mantenimiento", to: "disponible", action: "finalizarMantenimiento" },
    ],
  },
  // Conservar las vistas personalizadas existentes.
},
```

Cada par origen/destino debe ser único, usar valores distintos de una Selection
obligatoria pública publicada (máximo 12 estados) y apuntar a un método @action.
Se valida al declarar el módulo y al construir el servicio. Un método puede
servir a varios pares si sus reglas lo permiten. `transitions: []` impide cambios;
una transición ausente se rechaza sin fallback de escritura directa.

Compatibilidad: `kanban: "estado"` sigue funcionando. La forma anterior del
servicio `{field:"estado"}` también conserva movimientos directos por el ciclo
de guardado; no implica ejecutar métodos @action. Añadir transitions activa el
despacho autorizado de acciones. No requiere orm:sync ni migración si campos y
estados ya existen.

En una vista KanbanView personalizada, conectar:

```tsx
load={modelKanban.bind(null, config.id)}
onMove={modelMove.bind(null, config.id)}
transitions={config.kanbanTransitions}
```

El contrato cliente conserva `config.kanban` como nombre del campo y publica sólo
pares from/to en kanbanTransitions. El servidor resuelve la acción desde su copia
del manifest; una petición sólo admite ID, revisión, from y to. No acepta nombre
de método, patch ni configuración de transiciones del navegador.

El movimiento usa una transacción Serializable: revalida sesión/escritura/regla,
revisión y origen persistidos, ejecuta la acción con sus grupos y el mismo ciclo
de persistencia/historial del botón. Comprueba el estado final después de hooks:
si difiere del destino, revierte registro, revisión e historial. No abre una
transacción anidada ni coordina dos requests. Un movimiento al estado actual es
un no-op autorizado con revisión vigente, sin ejecutar acción ni escribir.

El grafo publicado deshabilita destinos del selector y del arrastre/teclado; es
una ayuda de interfaz, no una autorización. Los grupos de acción se comprueban
en servidor y pueden rechazar un destino visible. Esto no crea permisos por campo
ni convierte las acciones en el único canal de escritura de un Selection; las
restricciones generales del modelo siguen correspondiendo a sus reglas/hooks.
Demo local en /sample#kanban-view con selector de transiciones; integración real
en el fixture desechable de módulos, sin datos de Flota.

La lógica de un botón de negocio vive en la clase, publicada con `@action`:

```ts
import { action, type ActionRecord } from "@/lib/orm";

@action({ label: "Confirmar" })
confirmar(record: ActionRecord<Venta>) {
  if (record.estado !== "borrador") throw new ModelValidationError("Sólo borradores.");
  return { estado: "confirmada" };
}
```

En la vista (por defecto o expulsada):

```tsx
<FormHeader>
  <FormButton action="confirmar" />
  <FieldSelect<Values> name="estado" widget="statebar" />
</FormHeader>
```

FormButton guarda primero si hace falta y luego ejecuta la acción. El servidor
valida el nombre contra las acciones publicadas, los permisos, los grupos opcionales
(`groups: ["gerente"]`), la regla de registro y la revisión, y persiste el patch por
el mismo ciclo del guardado. Contrato completo en
[Acciones de formulario](ideas/acciones-formulario.md#contrato-implementado-2026-11-14).

## 7. Extender un modelo de otro módulo (herencia)

Equivalente al `_inherit` de Odoo, con una clase mixin. El módulo que extiende no edita
las fuentes del base:

```ts
// src/modules/soporte/models/equipo.ts
import { Fields, ModelValidationError, action } from "@/lib/orm";
import { extendModel } from "@/lib/modules/extend";
import { Equipo } from "@/modules/taller/models/equipo";

export const EquipoSoporte = extendModel(Equipo, Base => {
  // Declara la clase con nombre: los decoradores legacy no admiten clases anónimas.
  class EquipoSoporte extends Base {
    responsable = Fields.Text({ label: "Responsable", maxLength: 60, tracking: true });
    nivel = Fields.Integer({ label: "Nivel", required: true, default: 1, min: 1, max: 3 });

    @action({ label: "Escalar" })
    escalar(record: { nivel: number }) { return { nivel: Math.min(3, record.nivel + 1) }; }

    beforeSave(values: Record<string, unknown>) {
      const result = super.beforeSave(values); // conserva la regla del base
      if (result.estado === "baja" && !result.responsable) throw new ModelValidationError("Asigna un responsable.");
      return result;
    }
  }
  return EquipoSoporte;
});

// src/modules/soporte/manifest.ts
export default defineModule({
  id: "soporte", name: "Soporte", icon: "life-buoy",
  depends: ["taller"], models: {},
  extends: { "taller.equipo": EquipoSoporte },
});
```

- **Datos:** los campos persistentes van en una tabla compañera del extensor
  (`soporte_taller_equipo`, modelo `SoporteTallerEquipo`) con `recordId` único hacia el
  base y `ON DELETE CASCADE`. El esquema del base sólo recibe la inversa 1:1, marcada
  como propiedad del extensor. Se instala con `orm:sync -- soporte` o desde Módulos.
- **Lectura y guardado:** el repositorio del base lee y escribe la compañera en la misma
  sentencia y transacción, con una sola revisión (la del base). Los registros previos a
  la extensión no tienen fila: se presentan con los defaults y la fila se crea al guardar.
- **Composición:** el registro aplica las extensiones en orden de dependencias
  (`extB(extA(Base))`); `super` encadena hooks, y `@action`, `@onchange`, `@constraint`
  y `@depends` de la subclase se registran solos. Dos extensiones no pueden declarar el
  mismo campo, ni redeclarar campos del base.
- **`beforeSave` del base:** devuelve siempre `{ ...values, cambios }`. Si arma un objeto
  nuevo, perdería los campos extendidos; Zod lo rechaza y no se guarda nada.
- **Accesos:** permisos, reglas de registro y capacidades son los del modelo base.
- **Vistas:** el formulario por defecto añade un grupo por extensión (con el nombre del
  módulo). En formularios expulsados, `<ModelExtensions />` (de
  `@/components/modules/ModelForm`) marca dónde se pintan; `eject:view` ya lo incluye.
  Sin él, los valores extendidos se conservan al guardar.
- **Gestor:** desinstalar el base queda bloqueado mientras exista el extensor;
  desinstalar el extensor con «Eliminar datos» borra sólo su tabla y su inversa.

### Fase 2: colecciones, presentación propia y campos avanzados

Los campos extendidos participan en la misma política de Lista/Tarjetas/Kanban del
base: `list`, `searchable`, `sortable`, `filterable` y `groupable` se declaran en el
Field. Se conservan los límites compartidos (12 columnas, seis campos de búsqueda,
tres niveles de agrupación); un override explícito de `list` del base prevalece.
Los predicados se traducen a la relación 1:1 de la compañera, el orden usa esa
relación y los grupos/conteos se consultan y paginan en SQL. No se descargan todos
los registros ni se enumeran IDs para aplicar reglas.

**Sin fila compañera:** las colecciones, filtros, dominios, reglas y lookups usan
vacío (`null`), no el default del formulario. Se incluye un único grupo «Sin valor»
al final; cero y false son valores. Al abrir un formulario se ofrecen los defaults,
que sólo se persisten al guardar. No hay backfill ni escrituras al consultar. Un
compute cuya dependencia obligatoria extendida esté vacía se presenta vacío en
colecciones, sin ejecutar el método con datos inválidos. Una Selection extendida
usada como columna Kanban no incluye registros sin valor en sus estados; localizarlos
en Lista con el filtro «Está vacío» y guardarlos para asignarles el default.

Una extensión puede declarar `Fields.Image({folder: "..."})`, `Fields.Text/Image`
con `related` y `unique` **opcional sin default**. El índice único pertenece a la
compañera; un duplicado revierte base, compañera y revisión en la misma transacción.
Las subidas reutilizan el firmante autorizado del modelo base, sin secretos en el
cliente. Related sigue siendo virtual y readonly, admite campos del base o de
extensiones en destinos declarativos registrados y respeta las reglas de lectura
de cada destino; no admite búsqueda/filtro/orden/grupos sobre la salida virtual.
La publicación de cada salto se valida contra los contratos compuestos del registro.

Para una presentación propia, el manifest admite un objeto sin romper la forma
anterior `extends: { "taller.equipo": EquipoSoporte }`:

```ts
extends: {
  "taller.equipo": {
    model: EquipoSoporte,
    views: { form: () => import("./views/EquipoSoporte") },
  },
},
```

El componente es cliente, recibe `{config: ModelClientConfig}` y devuelve los Fields
de la extensión. No monta otro ModelForm, FormView ni FormProvider. Se resuelve
desde la ruta servidor y se entrega como contenido React, nunca pasando loaders
del manifest al navegador. `<ModelExtensions />` inserta la vista personalizada
mediante un Fragment, sin FormGroup ni legend automáticos. La vista decide su
composición con FormGroup, Stack, Notebook u otros componentes dentro del RHF/FormView
del base: comparte validación, modo consulta, bloqueo, dirty guard, actividad y
guardado. Sin vista propia se conservan los controles automáticos dentro de un
FormGroup con el nombre del extensor. Un formulario expulsado sólo necesita
conservar `<ModelExtensions />`.
Si el formulario ya presenta explícitamente campos delegados (por ejemplo los de
Partner en User), usar `<ModelExtensions excludeFields={["name", "email", "phone", "avatarUrl"]} />`
para evitar controles duplicados. Sólo afecta al render automático; los campos
permanecen en RHF y en el guardado. Las otras extensiones se siguen presentando.

El extensor también puede añadir reglas al modelo que extiende:

```ts
groups: { tecnico: { label: "Técnico", implies: ["taller.editor"] } },
rules: [{
  id: "nivel-tecnico", label: "Técnicos: nivel hasta 2",
  models: "taller.equipo", groups: ["tecnico"],
  domain: [{ field: "nivel", operator: "lte", value: 2 }],
}],
```

Sólo se aceptan destinos externos declarados en `extends`, con su dependencia;
esto no añade grants CRUD al modelo base. Las reglas se combinan por el motor
existente (globales AND, grupos OR), pueden desactivarse desde Accesos y se aplican
a read/list/lookup y mutaciones, incluida la comprobación del resultado guardado.
Los callbacks de reglas del base se validan contra sus metadatos compuestos al
ejecutarse; los dominios estáticos se validan al declarar cada módulo. Los grupos
locales de una @action de la extensión pertenecen al extensor, incluso al ejecutar
la acción desde el base. El superusuario conserva el bypass existente.

Límites vigentes: al menos un campo persistente por extensión; campos obligatorios
con default literal; sin One2many, sensitive, unique obligatorio/con default ni
extensión de líneas One2many. Partner/User siguen fuera (fase 3). No se edita el
esquema/propiedad del base para almacenar campos extendidos. Diseño e historial en
[Herencia de modelos](ideas/herencia-modelos.md).

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

`npm run test:extensions:integration` instala `taller` y `soporte`
(`scripts/fixtures/modules-extension`) en un proyecto/esquema temporales y comprueba la
herencia completa, incluida la desinstalación del extensor con respaldo. También
inicia un Next temporal en puerto libre y comprueba por HTTP autenticado que su
vista diferida usa los Fields/metadatos del base dentro de un único formulario.
Usa cuentas ficticias y firmas de imagen de prueba, sin subir archivos externos.

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

## Pendiente: Módulos distribuibles

ZIP de fuentes para incorporar en src/modules, validar/registrar con un comando
y desplegar mediante el build normal de Next.js. No está implementado ni permite
instalación dinámica en producción. [Alcance acordado](ideas/modulos-distribuibles.md).

## Documentos con líneas

`Fields.One2many("ModuloDetalle", { inverse: "documentoId" })` declara una colección
del hijo; ModelForm la incorpora y FieldOne2many.Column personaliza sus columnas.
El guardado aplica lógica/permisos/revisiones de padre e hijos en una transacción.
Alcance inicial de un nivel, mismo módulo y colección completa acotada: ver
[contrato y ejemplos](lineas-one2many.md). No requiere crear Server Actions por relación.

## Relaciones Many2many

`Fields.Many2many("ModuloEtiqueta", { label: "Etiquetas", maxSelected: 20 })`
declara IDs de registros existentes y compartidos. ModelForm y eject:view lo
presentan con FieldRelationTag y lookup autorizado. orm:sync genera su tabla
intermedia gestionada; guardado y revisión pertenecen al dueño, con autorización
de lectura de los destinos. Alcance y límites en [Many2many](relaciones-many2many.md).

## Folio en name u otro Text

`name = Fields.Text({ label: "Folio", sequence: { prefix: "TCK-{year}-", padding: 6,
reset: "year" } })` asigna el folio al crear desde el servidor. No requiere
beforeSave; el campo se conserva único y de sólo lectura. ModelForm muestra Nuevo
en el borrador y el valor asignado después de guardar. [Migración, concurrencia
y límites](folios-secuencias.md).
