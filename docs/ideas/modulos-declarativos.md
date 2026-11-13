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

- Toda la lógica de negocio (campos, validación, onchange, cálculos, displayName,
  hooks y acciones) se declara en la clase de modelo y corre sólo en servidor;
  permisos/reglas en manifest y Control de accesos. React sólo presenta, interactúa,
  valida rápido por comodidad y dispara eventos; nunca autoriza ni decide negocio.
  Ejemplo orientativo discutido: módulo «Biblioteca» (Autor, Libro, Préstamo).

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
6. **Acciones de negocio** `@action({ label, states?, group?, confirm? })` en el
   modelo, invocadas sólo por el despachador autorizado, y `FormView.Actions` para
   mostrarlas según estado y permisos. Incluir en el diseño de la fase 1.
7. **Efectos externos tras confirmar** (correo, APIs): mecanismo `afterCommit` o
   cola, fuera de la transacción de beforeSave/afterSave. Evaluar en la fase 1.
8. **Convenciones de relaciones** (fase posterior a evaluar): Many2one nombrado por
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

## Fase 0: línea base (2026-11-13)

Medido en la rama `refactor/modulos-declarativos` desde `8de98f2`, con `wc -l`
(líneas físicas, incluidas vacías). Excluye migraciones SQL y `prisma/models`.

| Por modelo | Archivos propios de la app | Líneas | Generados | Líneas gen. | Total archivos | Total líneas | Clase de modelo |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Fabricante | 12 | 277 | 4 | 129 | 16 | 406 | 21 líneas (5 %) |
| Vehicle | 12 | 316 | 4 | 136 | 16 | 452 | 44 líneas (10 %) |

Archivos propios por modelo: clase, `*.service.ts`, `*.actions.ts` (84 líneas,
casi idénticas entre modelos), `*.schema.ts` (reexport), `*.ui.ts`, `*.list.ts`,
`*List.tsx`, `*Form.tsx` (100–136 líneas, ~60 de cableado: loader, recarga,
router, breadcrumbs, RHF), 3 páginas de ruta y README de vistas. Generados:
`*.schema.ts`, `*.store.ts`, `*.images.ts` y `*.images.actions.ts`.

Aplicación completa: 52 archivos / 1 484 líneas en `src/app/(auth)/erp/flota`
(48 / 1 167 sin README) más 23 / 847 generadas en `src/generated/orm/*/flota`.
Por módulo además: manifest (41), orm.config (25, repite `clientFields`), layout,
página raíz. La política `list` del servicio repite nombres de campos
(fields/searchFields/sortable/groupable/filterable) y `recordSearchFields` se
repite en la vista.

Meta de aceptación para Fabricante tras migrar: 1 archivo obligatorio (clase) más
la entrada en el manifest, con mismo comportamiento; vistas propias sólo si se
personalizan.

Hallazgo: el commit `8de98f2 fixes` retiró de `FabricanteForm.tsx` la eliminación
desde formulario (`deletion`) y el uso de `displayName` en el breadcrumb.
Confirmar con el usuario si fue intencional antes de tomarlo como referencia.

## Fase 1: diseño (borrador para aprobación, 2026-11-13)

Basado en el código actual: `createModelService` ya revalida sesión y admin dentro
de cada transacción (`assertActor` en `src/lib/orm/service.ts`); los `*.store.ts`
generados son derivables de los metadatos (select, dto, data, list, groups,
lookup, audit); `*.actions.ts` son 84 líneas casi idénticas; `ModelRepository`
ya es la interfaz que el servicio consume. Next 16 permite `[[...path]]` opcional
y las rutas estáticas tienen prioridad sobre las dinámicas, lo que permite
convivencia con las apps actuales.

### 1. Estructura y descubrimiento

```
src/modules/<id>/manifest.ts      obligatorio
src/modules/<id>/models/*.ts      clases de modelo
src/modules/<id>/views/*.tsx      opcional (eject)
src/modules/index.ts              generado: imports estáticos de manifests y vistas
```

Sin descubrimiento de filesystem en runtime (regla actual del registro). `index.ts`
lo regenera `orm:sync` (o `modules:index`), con hash como hoy.

### 2. Identidad del modelo

Id con punto, estilo Odoo: `flota.fabricante`. De ahí se derivan nombre Prisma
`FlotaFabricante`, tabla `flota_fabricante`, delegate `flotaFabricante` y ruta
`/erp/flota/fabricante`. Coinciden con los actuales de Flota: **migrar Flota no
requiere renombrar tablas**. `defineModel` deja de ser obligatorio; el manifest
registra las clases y permite override de `table`.

### 3. Opciones en Field (sustituyen clientFields, publicación y política list)

| Opción | Default | Sustituye |
| --- | --- | --- |
| `public` | `true` salvo `sensitive` | `clientFields`, publicación en orm.config |
| `searchable` | `true` sólo para Text llamado `name` | `searchFields`, `recordSearchFields` |
| `sortable` / `filterable` | escalares públicos | `sortable`, `filterable` |
| `groupable` | Boolean, Selection, Many2one | `groupable` |
| `list` | `true` salvo Text largo | `list.fields`, columnas por defecto |

El servicio sigue fijando la política en servidor; sólo cambia de dónde la lee.
Se conserva `presentation.list` explícito como override.

### 4. Repositorio genérico en runtime

`createRepository(model, delegate)` implementa `ModelRepository` desde los
metadatos con `tx[delegate]`, donde `delegate` sale del registro (nunca del
cliente). Mantiene exactamente la semántica actual: revisión por `updatedAt`,
avance monotónico, `createBy` sólo al crear, lista blanca de campos en lookup y
groups, orden estable por `id`. Verificación: las pruebas de servicio actuales
se ejecutan contra el repositorio generado **y** el genérico (pruebas de contrato)
hasta retirar los bindings.

### 5. Despachador de Server Actions

`src/lib/modules/actions.ts` ("use server") exporta funciones fijas por operación
en lugar de una genérica, para tipado claro y superficie mínima: `modelRead`,
`modelSave`, `modelList`, `modelLookup`, `modelDelete`, `modelKanban`,
`modelMove`, `modelReact`, `modelActivity`, `modelNote`, `modelAction`,
`modelUpload`. Cada una: valida el id contra el registro → obtiene servicio →
el servicio autoriza en su transacción → `revalidatePath` por convención de ruta.
Mensajes de error genéricos como hoy. Las acciones son públicas para cualquier
cliente autenticado según Next: toda la seguridad está en el servidor.

### 6. Control de accesos dentro del servicio

`assertActor` pasa a `assertAccess(tx, actor, model, operation)`:

- Revalida activo/`sessionVersion` como hoy.
- Superusuario (`isAdmin`) pasa siempre: las cuentas actuales no pierden acceso.
- Carga grupos efectivos (con implicados) una vez por transacción, sin caché global.
- Comprueba `ModelAccess` (read/create/write/unlink) del modelo.
- Reglas de registro: dominios del manifest combinados con AND en list, count,
  groups, lookup, kanban, read, save, delete, move, react, activity, related y
  displayName. Read/save/delete fuera de la regla responden como «no encontrado».

Tablas nuevas (app nativa `access`): `AccessGroup`, `AccessGroupImplied`,
`AccessUserGroup`, `AccessModelAccess`, `AccessRecordRule`. Los grupos, accesos y
reglas por defecto se declaran en manifests y se sincronizan al instalar; la UI
asigna usuarios, activa/desactiva reglas y ajusta CRUD. **Los dominios de reglas
se definen en código** (callbacks con `actor`, como `defineListAction`); la UI no
crea código ni dominios arbitrarios en el primer alcance. Cambiar grupos de un
usuario incrementa su `sessionVersion`. Servicios manuales (Contactos, Usuarios,
Citas) conservan `requireAdmin` hasta migrar.

### 7. Rutas

`src/app/(auth)/erp/[module]/[[...path]]/page.tsx` y su layout resuelven:
`/erp/<m>` → primer menú; `/erp/<m>/<modelo>` → lista; `/nuevo` → creación;
`/<id>` → formulario. Carpetas estáticas existentes (`contactos`, `citas`,
`usuarios`, `flota` actual) tienen prioridad: convivencia sin cambios.

### 8. Vistas por defecto, hook y eject

- `DefaultList`/`DefaultForm` construidos con los componentes actuales desde
  metadatos serializados (sin funciones ni clases server-only en el cliente).
  Lista o tarjetas según `manifest` (`views: { list: "card" }`), kanban si hay
  Selection con `kanban: true`.
- `useRecordForm("flota.fabricante", id)` encapsula el cableado que hoy repiten
  los formularios (~60 líneas: loader, recarga protegida, router, breadcrumbs con
  displayName, RHF/Zod, actividad, eliminación, `onSaved`).
- `eject:view -- flota Fabricante form` copia un TSX corto que usa ese hook; si
  existe `views/FabricanteForm.tsx`, el índice generado lo usa en vez del default.
- Tipos para vistas propias con `import type` desde la clase (borrado en build;
  la clase sigue server-only).

### 9. Acciones de negocio y efectos posteriores

- `@action({ label, states?, groups?, confirm? })`: metadato publicado; `modelAction`
  valida nombre contra la lista blanca, estado, grupo y revisión; el método
  devuelve un patch que pasa por el mismo pipeline de `save` (normalize, Zod,
  beforeSave, constraints, tracking) en Serializable.
- `context.afterCommit(fn)`: cola en memoria ejecutada tras commit; los fallos se
  registran sin revertir. Sin reintentos ni persistencia en el primer alcance.

### 10. Qué se sigue generando y qué se retira

Se mantiene: `schema.prisma` y migraciones (instalador con propiedad/hashes),
`src/modules/index.ts`. Se retira gradualmente: bindings `*.store.ts`, acciones
de uploads por modelo, reexports `*.schema.ts`/`*.ui.ts`, `*.actions.ts`,
`*.service.ts` y páginas por modelo. Zod de cliente se construye desde los
metadatos serializados (ya existen los datos para ello); pendiente medir costo.

### 11. Fabricante después (objetivo)

```ts
// src/modules/flota/models/fabricante.ts
export class Fabricante extends Model {
  name   = Fields.Text({ label: "Nombre", required: true, maxLength: 120, tracking: true });
  active = Fields.Boolean({ label: "Activo", default: true, tracking: true });
  logo   = Fields.Image({ label: "Logotipo", folder: "flota-fabricantes" });
}
```

```tsx
// src/modules/flota/views/FabricanteForm.tsx (sólo si se personaliza)
export default function FabricanteForm({ id }: { id?: string }) {
  const form = useRecordForm<Fabricante>("flota.fabricante", id);
  return (
    <FormView {...form.props}>
      <FormGroup legend="Datos generales">
        <FieldImage name="logo" shape="squared" widget="avatar" />
        <FieldText name="name" direction="inline" />
        <FieldBoolean name="active" direction="inline" />
      </FormGroup>
    </FormView>
  );
}
```

De 16 archivos / 406 líneas a 1 archivo (~10 líneas) + entrada en manifest; con
vista propia, 2 archivos (~25 líneas). Cifras objetivo, a confirmar en la fase 6.

### 12. Alcance del prototipo (fase 2)

Módulo desechable `demo` con un modelo simple y un Many2one. Necesita tablas: se
verifica primero en el proyecto/esquema temporal de `test:framework:integration`;
instalarlo en la BD local requiere aprobar su SQL. Entregables: registro + índice,
repositorio genérico con pruebas de contrato, despachador, `assertAccess` con
superusuario (grupos completos en fase 4), ruta comodín, DefaultList/DefaultForm y
`useRecordForm`.

### Decisiones (aprobadas 2026-11-13 con las opciones recomendadas)

Aprobadas 1–4 tal como se recomiendan abajo. La 5 sigue sin respuesta; no bloquea
porque Flota no se toca hasta la fase 6.

1. Ids con punto (`flota.fabricante`) y carpeta `src/modules/`.
2. Despachador con funciones por operación (recomendado) frente a una sola.
3. Reglas de registro sólo en código en el primer alcance.
4. Zod de cliente en runtime frente a seguir generándolo.
5. Si el retiro de `deletion`/`displayName` en `8de98f2` fue intencional.

## Fase 2: prototipo (2026-11-13)

Implementado en la rama `refactor/modulos-declarativos`, sin commit:

- `src/lib/modules/define.ts`: `defineModule({ id, name, icon, models: { clave: Clase | {...} }, menu })`
  deriva id `modulo.clave`, nombre Prisma, tabla, delegate, ruta, menú, política de
  lista desde metadatos y `GenerationProfile` con `runtime: true`.
- `repository.ts`: repositorio genérico en runtime, equivalente al template de
  `orm:bind` (revisión, createBy, lookup/related/relatedMany con los mismos
  planificadores y guardas, groups, list con auditoría).
- `registry.ts`: índice de `src/modules/index.ts`, servicios perezosos con
  `createModelService`, etiquetas Many2one, firmante de imágenes y
  `modelClientConfig` (sólo datos planos). `withActor` reutiliza el actor de la
  operación para las etiquetas; sin actor fallan cerrado.
- `actions.ts`: despachador con una Server Action fija por operación; valida el id
  contra el registro. Autorización: superusuario (`requireAdmin`) hasta la fase 4.
- `fields.ts` / `client.ts`: Fields y Zod reconstruidos en el navegador desde
  metadatos (sustituyen `*.schema.ts`/`*.ui.ts`/uploads generados).
- `src/components/modules/ModelCollection.tsx` (lista o tarjetas) y
  `ModelForm.tsx` (cableado completo: loader, recarga protegida, breadcrumbs con
  displayName, actividad, eliminación). **Cambio respecto al diseño:** en lugar del
  hook `useRecordForm`, una vista propia pasa sólo su maquetación como `children`
  de `ModelForm`; los modelos aceptan `views: { form, list }`.
- Ruta `src/app/(auth)/erp/[module]/[[...path]]` con layout de acceso; las carpetas
  estáticas existentes siguen teniendo prioridad (build lo confirma).
- `orm:sync`/`orm:install` cargan `src/modules/<id>/manifest.ts` si no hay
  `orm.config.ts`; para módulos `runtime` sólo se genera esquema y migración.
- **Cambio respecto al diseño:** el icono del manifest es un nombre Lucide
  (`"flask-conical"`); el registro de aplicaciones lo resuelve. Importar
  `lucide-react` o `next-auth` de forma estática rompe los scripts con
  `--conditions=react-server`.
- Módulo desechable `src/modules/demo` (Tarea con Many2one, Selection kanban,
  Integer, DateTime, normalize y beforeSave; Categoría): 49 líneas en 3 archivos.
  Instalado en la BD local el 2026-11-13 con `orm:sync -- demo` (migración
  `20261113154528_demo_module`, sólo aditiva, aprobada por el usuario) y
  registrado en `src/modules/index.ts`. Sin artefactos en `src/generated/orm/*/demo`.

Verificación 2026-11-13: `test:modules` 5/5; `test:modules:integration` aprobado
en proyecto y esquema temporales (instalación sólo de esquema, sin contratos,
bindings ni uploads generados; crear, normalize, beforeSave con fieldErrors,
campos no declarados, revisión, listas, búsqueda, filtros, agrupación Many2one con
etiquetas, lookup, kanban, move, historial, notas, borrado con Restrict y lote
revertido, rechazo de no administradores y sesiones viejas; `next typegen` + tsc
con demo registrado); esquema y proyecto eliminados. `tsc`, ESLint de archivos
nuevos/modificados y `next build` aprobados. Regresión: test:scaffold 12/12,
test:applications 10/10, test:list-selection 8/8, test:form-navigation 12/12;
test:orm 74/75 y test:orm:install 13/19 fallan sólo por `EPERM` al crear symlinks
en Windows (pendiente ya registrado, ajeno a estos cambios).

No verificado: vistas por defecto en navegador. El servidor `--serve` temporal
(puerto 3032) no completó el streaming de Suspense en el panel del navegador
(se quedaba en «Cargando…»; el login no hidrataba).

Revisión visual 2026-11-13 en `:3000` con la sesión del usuario (Claude in
Chrome), sólo con registros «ZZ Prueba», ya eliminados; los registros del usuario
(«Departamento de ventas», «Centralizar CRM») se conservaron. Comprobado: cajón y
menú con grupo Configuración; lista y formulario por defecto; defaults del modelo
(Pendiente, 3); búsqueda Many2one por lookup autorizado; `normalize` en servidor;
URL y breadcrumb tras crear; regla `beforeSave` como «Error de validación» con
error en el campo y borrador conservado; historial «Pendiente → En curso» (sin
Prioridad, que no tiene tracking); lista con etiqueta de Categoría y agrupación
Many2one; eliminación bloqueada por Restrict y eliminación correcta con retorno a
la lista. Corregido tras la revisión: el layout `[module]` leía `params` fuera de
Suspense (aviso de Next 16, ya sin errores en consola) y el repositorio genérico
mostraba un mensaje de `orm:bind`; ahora indica reiniciar dev tras `orm:sync`
(ocurrió porque dev conservaba el cliente Prisma anterior a la instalación).

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
