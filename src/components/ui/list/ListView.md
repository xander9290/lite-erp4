# ListView · Card con filtros por columna

En las páginas del ERP, la tarjeta ocupa la altura restante del viewport. El header y
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
  headerActions={<a href="/sample#list-view" className="btn btn-ghost btn-sm">Ejemplos</a>}
  footer={<p>Contenido adicional del footer.</p>}
  columns={[
    { field: "name", label: "Nombre", sortable: true },
    { field: "user.login", label: "Usuario", sortable: true },
  ]}
/>
```

## Estructura

- **Header**: título, icono, contador, actualizar, limpiar filtros y `headerActions` para botones o menús propios. `createHref`/`createLabel` habilitan «Nuevo» cuando exista la ruta de creación.
- **Body**: tabla con orden y filtro en cada encabezado. Los encabezados siguen disponibles en carga, error y ausencia de resultados.
- **Footer**: rango, tamaño de página y paginación, más el slot `footer` para contenido adicional.

El wrapper incluye Suspense; las páginas pueden seguir siendo Server Components. La interacción consulta una Server Action validada.

## Columnas y tipos

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
- `description`, `icon`, `className`, `headerActions`, `footer`: presentación opcional.
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

Esta fase es de lectura; crear/editar y persistir relaciones corresponde a FormView.
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
