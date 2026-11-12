# ListView · Card con filtros por columna

Para columnas related, pasar fields del contrato generado CollectionFields, no
Fields de captura. Por ejemplo, importar FlotaVehicleCollectionFields como
recordCollectionFields y usar `<ListView.Field name="fabricanteAvatar" />` bajo
`<ListView fields={recordCollectionFields} ...>`. Publicarlo en list.fields del
servicio; se resuelve por lote en servidor. No habilitar orden/filtros/grupos sobre
related. Many2one directo permite groupable en columna y servicio.
Detalles en [Campos relacionados](../../../../docs/campos-relacionados.md).

Las filas de registros usan padding vertical compacto (`py-2`, 0.5rem por lado),
también dentro de agrupaciones. Se conservan tamaño de avatares/casillas y ajuste
multilínea; los encabezados mantienen su separación.

Agrupación anidada opcional: `groupable: true` con proveedor propio `load`.
Contrato, paginación por rama, selección y límites en
[Agrupación de listas](../../../../docs/agrupacion-listas.md).

En las páginas del ERP, ListView se monta directamente en el layout, sin wrappers
con padding ni enlaces de navegación externos: ocupa todo el ancho y la altura
disponibles debajo del Top. `breadcrumbs` coloca la ruta dentro del header, también
durante la carga inicial. El header y
el footer permanecen visibles y la región de la tabla tiene scroll automático en
ambos ejes. Para reutilizar ese comportamiento, el contenedor debe ser una columna
flex con `flex-1 min-h-0` y altura limitada por el layout. Dentro del catálogo
`/sample` conserva su altura de contenido.

Card DaisyUI con header de acciones, body con tabla y footer extensible. Las consultas, el orden y la paginación se ejecutan con Prisma en el servidor. No requiere dependencias nuevas.

```tsx
import ListView from "@/components/ui/list/ListView";

<ListView
  model="partner"
  title="Contactos"
  breadcrumbs={[{ label: "Aplicaciones", href: "/erp" }, { label: "Contactos" }]}
  headerActions={<a href="/sample#list-view" className="btn btn-ghost btn-sm">Ejemplos</a>}
  footer={<p>Contenido adicional del footer.</p>}
  columns={[
    { field: "name", label: "Nombre", sortable: true },
    { field: "user.login", label: "Usuario", sortable: true },
  ]}
/>
```

## Estructura

- **Header**: barra compacta de `breadcrumbs`, agrupación, actualizar, limpiar filtros y `headerActions` para botones o menús propios. Cada miga tiene `label` y un `href` opcional; la última representa la página actual. `createHref`/`createLabel` habilitan «Nuevo» cuando exista la ruta de creación. La ruta y los controles comparten fila cuando hay espacio y se adaptan en móvil. No muestra el bloque de icono/título/contador/descripción; el total se consulta en el footer. `title` conserva el nombre accesible de la sección, tabla y acciones.
- **Body**: tabla con orden y filtro en cada encabezado. Los encabezados siguen disponibles en carga, error y ausencia de resultados.
- **Footer**: rango, tamaño de página y paginación, más el slot `footer` para contenido adicional.

El wrapper incluye Suspense; las páginas pueden seguir siendo Server Components. La interacción consulta una Server Action validada.

## Selección y acciones predeterminadas

Cada fila tiene una casilla independiente. La casilla del encabezado selecciona o
deselecciona **sólo la página visible** y muestra el estado intermedio cuando hay una
selección parcial. Cambiar página, filtros, orden, fuente o actualizar la consulta
limpia la selección; no hay selección implícita de resultados en otras páginas.

`create` y `delete` son booleanos, ambos `true` por defecto:

```tsx
<ListView model="partner" title="Contactos"
  columns={[{ field: "name", label: "Nombre", sortable: true }]}
  createHref="/erp/contactos/nuevo"
  create={false}
  delete={false}
/>
```

`create={false}` oculta el botón aunque exista `createHref`; sin una ruta válida
tampoco se muestra. `delete={false}` oculta «Eliminar» y su menú, manteniendo las casillas.
Estas props controlan presentación y no conceden ni sustituyen permisos.

«Acciones» es un desplegable del header con icono de engrane que aparece sólo al
seleccionar registros. Contiene «Eliminar», habilitado para filas con `revision`
ISO UTC. Se cierra con Escape, al salir del foco, pulsar fuera o elegir una acción.
Al quitar la selección también se oculta. Eliminar solicita confirmación y bloquea peticiones repetidas.
Cancelar conserva la selección. Si la consulta cambia durante la confirmación, se
cancela ese borrado y se pide seleccionar de nuevo. Después de intentar el borrado se vuelve a consultar
la lista, también ante errores de red cuyo commit sea desconocido; no se simula una
eliminación optimista. Si se elimina la última fila de una página, el proveedor
ajusta la paginación al rango disponible.

Las fuentes incorporadas `partner`, `user` y `dentalAppointment` tienen un proveedor
de borrado explícito. Contactos oculta Crear/Eliminar a cuentas sin escritura. El
servidor revalida sesión activa, administrador y `sessionVersion` dentro de una
transacción Serializable. El lote admite de 1 a 50 IDs únicos con sus revisiones;
un cambio concurrente o una FK restringida revierte todo el lote. No se pueden
eliminar la cuenta de la sesión ni citas/contactos/usuarios con relaciones que lo
impidan. Borrar un usuario conserva su contacto Partner.

Las fuentes propias conectan una Server Action mediante `onDelete`:

```ts
// Contrato de la prop, disponible como tipos en ui/list/ListView:
onDelete: (selection: readonly { id: string; revision: string }[]) =>
  Promise<{ ok: true; deleted: number }
    | { ok: false; error: string; kind?: "validation" | "server" }>;
```

El callback no recibe modelos, filtros ni dominios arbitrarios. Sin proveedor no
se ejecuta un borrado; el botón queda desactivado. El scaffold y Flota conectan
`onDelete={deleteRecords}` con `recordService.remove`. Los adaptadores generados
incluyen `remove(tx, id, revision)`; para módulos enlazados anteriormente hay que
regenerarlos con `orm:bind -- id --write`. No hay cambio de esquema ni migración.

El dominio de una lista filtra su consulta; los permisos del borrado son los del
servicio. La eliminación no ejecuta `beforeSave`/`afterSave`. Las reglas de negocio
propias de borrado requieren una acción/servicio autorizado específico. No eliminar
relaciones ni recursos externos desde el cliente para evitar un rechazo de FK.

Ejemplo local: `/sample#list-selection`, con datos ficticios, paginación, eliminación
en memoria y botón para restablecer. Las listas reales de Contactos/Usuarios del
catálogo usan `delete={false}`. Pruebas: `npm run test:list-selection` y la integración
PostgreSQL aislada `npm run test:framework:integration`.

## Columnas y tipos

### Widget Image

Para servicios declarativos autorizados:

```ts
{ field: "avatar", label: "Imagen", type: "text", widget: "image",
  imageSize: "sm", imageShape: "squared", sortable: false, filterable: false }
```

Sólo se admite sobre un Fields.Image no sensible en la configuración del servicio
del servidor. imageSize permite sm/md/lg (32/48/96 px), imageShape rounded/squared.
Se muestra fallback accesible para valores ausentes, inválidos o fallos de carga.
Pulsar la miniatura sigue recordHref o abre la vista rápida. La URL se carga
directamente en el navegador, sin proxy del servidor ni enlace externo implícito.
CardView/KanbanView comparten el render y usan la primera Image como cabecera de
la tarjeta por defecto. renderCard personalizado mantiene su presentación.
Los proveedores legacy conservan sus campos/widget partner; no se admiten rutas
arbitrarias de imagen enviadas desde el cliente. Demo `/sample#image-collections`.

### Widget Partner

`widget="partner"` muestra un avatar circular de 32px junto al nombre. Sin imagen,
con una URL inválida o si falla la carga, muestra iniciales; si falta también el
nombre, usa `?` y el texto `—`. Las fotos usan carga diferida y los nombres largos
se ajustan al espacio. El avatar es decorativo para lectores de pantalla.

```tsx
// ListView model="partner"
{ field: "name", label: "Contacto", widget: "partner", avatarField: "avatarUrl", sortable: true }

// ListView model="user"
{ field: "partner.name", label: "Contacto", widget: "partner", avatarField: "partner.avatarUrl", sortable: true }
```

`avatarField` es opcional: el registro del modelo resuelve esas mismas rutas por
defecto. El servidor valida la pareja columna/avatar; no acepta rutas arbitrarias
ni convierte las URLs en campos de búsqueda, filtro u ordenamiento. Prisma incluye
el avatar en el select del listado, sin consultas por fila. Los filtros y el orden
continúan usando el nombre. El nombre abre el registro de la fila si hay `recordHref`;
si no, abre la vista rápida, que también muestra el widget.

`PartnerAvatar` y `PartnerIdentity` en `ui/PartnerAvatar.tsx` son reutilizables. Al
cambiar la URL se reinicia el estado de carga fallida. Se cargan directamente URLs
HTTPS de proveedores públicos, sin pasar archivos por un proxy de imágenes del ERP.
Ejemplos reales en Contactos, Usuarios y `/sample#list-view`.

Cada columna acepta `field`, `label`, `sortable`, `filterable` (true por defecto), `type`, `align` y `format`. El tipo se obtiene de `listModels[model].fieldTypes`; no hace falta repetirlo por columna. El servidor valida el tipo: una prop no puede convertir un campo de texto en número. Se admite presentar un datetime como `type="date"` para filtrar solo por días.

| Tipo | Operadores |
| --- | --- |
| `text` | Contiene, igual, distinto, comienza/termina con, vacío/con valor. |
| `number` / `integer` | =, ≠, >, ≥, <, ≤ y rango inclusivo. |
| `date` / `datetime` | En, antes/después, desde/hasta, rango y vacío/con valor. |
| `boolean` | Sí o No. |

Los filtros son explícitos: abrir el icono, elegir condición y valores, y pulsar **Aplicar filtro** (o Enter). Escape/cerrar descartan la edición. Limpiar quita el filtro de esa columna; el header permite limpiar todos. Se combina un criterio por columna mediante AND. Los valores activos se resumen bajo el título de la columna.

Las rutas relacionadas registradas, por ejemplo `user.login`, se consultan con filtros de relación. «Está vacío» también contempla relaciones opcionales ausentes, sin comparar con null campos obligatorios.

### Fechas y zona horaria

En datetime se puede elegir **Día completo** o **Fecha y hora exactas**. Los inputs usan la zona del navegador y se convierten a ISO UTC antes de consultar.

Un día se expresa como `[medianoche local, siguiente medianoche local)`, incluyendo todas sus horas; un rango incluye el último día completo. La siguiente medianoche se construye por calendario, no sumando 24 horas, para manejar días de 23/25 horas. En precisión exacta, el rango incluye ambos extremos y admite milisegundos. Se rechazan fechas inexistentes, horas que no existen por cambio de horario y rangos invertidos.

## Presentación y navegación

- `format`: `text`, `number`, `currency`, `date`, `datetime` o `boolean`; `currency` y `decimals` ajustan la presentación. El formato no cambia el tipo de dato permitido por el servidor.
- `pageSize`: valor inicial entre 1 y 50 (25 por defecto). `defaultSort`: columna visible/ordenable y dirección. El ID desempata el orden en el servidor.
- `className`, `headerActions`, `footer`: presentación opcional. `description` e `icon` siguen aceptándose por compatibilidad, pero no se renderizan en el header compacto.
- `renderCell(record, column)`: presentación personalizada en un wrapper cliente. Devuelve `undefined` para usar el formato habitual. No se envía como parte de la configuración de consulta; ejemplo en `citas/views/AppointmentList.tsx`.
- `recordHref`: ruta interna con `{id}` para el futuro FormView. Se agrega `returnTo` con el contexto; el destino debe validarlo antes de redirigir. Sin ruta, abrir una fila muestra una vista rápida de lectura.
- `paramPrefix`: namespace opcional para varias listas en una misma página.

La URL conserva `filters` (JSON), `page`, `size`, `sort` y `dir`. Aplicar/limpiar filtros, ordenar o cambiar tamaño vuelve a la página uno. Atrás/Adelante restaura el estado. Se conservan parámetros ajenos y el fragmento. Las respuestas fuera de orden se descartan.

El buscador general se sustituyó por controles en encabezados; `searchPlaceholder` se retiró. `searchFields` se conserva para interpretar enlaces anteriores con `q`: se muestra su búsqueda activa como etiqueta y puede limpiarse con los demás filtros.

## Registro y seguridad

`src/lib/list/registry.ts` define consultas tipadas, selects públicos y órdenes permitidos. `listConfigSchema`, `listStateSchema` y `validateListFilters` validan modelos, campos, operadores, tipos y valores en el servidor; no se aceptan delegates, where, include ni contraseñas arbitrarios. Un enlace con filtros malformados produce un error recuperable, nunca una lectura sin filtros silenciosa.

Al añadir un modelo, registrar sus tipos de campo, nulabilidad, relaciones opcionales, select y ordenamientos reales. No exponer campos privados mediante metadatos. La acción exige sesión activa y administrador para Usuarios/Citas. La consulta clínica de `dentalAppointment` además revalida sesión y permisos en la transacción de su módulo; no heredar el acceso general de Contactos.

## Ejemplos

- `/erp/contactos`: columnas de texto y relación con consultas reales.
- `/erp/citas`: paciente con avatar, teléfono, fechas, motivo y seguimiento; formulario operativo en `nuevo` y `[id]`.
- `/sample#list-view`: header con menú, footer propio, filtros de texto y `User.lastLogin` para fechas reales.
- La misma sección incluye un ejemplo local de controles numéricos/booleanos con datos de demostración. Los modelos actuales no tienen esos campos; el motor de comparación está probado y requiere registrar campos reales antes de consultarlos en Prisma. No se insertan datos ni se modifica el esquema para la demostración.

Crear/editar campos y persistir relaciones corresponde a FormView. ListView ofrece
consulta, selección y la acción de eliminación descrita arriba.
## Fuentes de una aplicación del scaffold

Además de los modelos del registro central, ListView admite una acción propia:

```tsx
<ListView model="MiModelo" load={listRecords} title="Mis registros"
  columns={recordColumns} searchFields={recordSearchFields}
  recordHref="/erp/mi-app/{id}" createHref="/erp/mi-app/nuevo" />
```

`load` recibe únicamente `ListState` y devuelve `Promise<ListResult>`. El servidor
debe fijar su modelo, columnas permitidas y permisos; las props de presentación
no autorizan consultas. El scaffold usa `createModelService` y un adaptador tipado
generado por `orm:bind`. El registro central conserva su whitelist de modelos.
Los tipos de las columnas personalizadas deben indicarse explícitamente.

Para reutilizar una lista con un conjunto fijo de registros, el servidor puede
declarar `recordService.defineListAction({ domain })`. El wrapper remoto sigue
recibiendo sólo `ListState` y se pasa a `load`; el dominio no se serializa a la UI
ni se limpia con los filtros. Contrato y ejemplos del scaffold en
[Dominios de lista](../../../../docs/dominios-listas.md).


El contrato enlazado y las nuevas APIs de presentación se documentan en
[Contratos de vistas](../../../../docs/contratos-vistas.md).
