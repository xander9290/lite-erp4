# CardView y KanbanView

Los related Image/Text pueden presentarse con columnas creadas desde
`<Modelo>CollectionFields` (reexportado como recordCollectionFields), usando
modelColumns. Publicarlos en list.fields del servicio y regenerar contratos/binding:
se resuelven por lote por página en servidor, sin copiar lógica a React. No admiten
orden/filtros/grupos por ese valor virtual. [Contrato](campos-relacionados.md#listview-cardview-y-kanbanview).
Agrupar Many2one directo en ListView requiere groupable en vista y servicio;
las columnas Kanban mantienen el contrato Selection obligatorio.

Componentes en `src/components/ui/card` y `src/components/ui/kanban`.
Ejemplos interactivos: `/sample#card-view` y `/sample#kanban-view`.
La demo es local y pública: sus proyectos son ficticios, no se guardan en la base
y se reinician al recargar. La integración del servicio real se prueba por separado.

Las columnas `widget: "image"` muestran miniaturas en las tres colecciones. La
primera sustituye el icono de la tarjeta por defecto; renderCard personalizado
controla su presentación. imageSize admite sm/md/lg e imageShape rounded/squared,
con fallback accesible si falta o falla la URL. El servidor sólo lo permite para
Fields.Image no sensibles; legacy conserva su whitelist. Demo
`/sample#image-collections` y [contrato de imágenes](ideas/campos-imagen.md).

## Búsqueda y filtros comunes

### Selection como badge

ListView, CardView y KanbanView comparten `widget: "badge"` para campos Selection:

```tsx
{ field: "estado", widget: "badge", colors: {
  disponible: "success",
  mantenimiento: "warning",
} }
```

En ModelCollection/modelColumns, etiquetas y opciones se obtienen del modelo.
`colors` también funciona sin widget; en ese caso aplica color a la fuente:

```tsx
{ field: "estado", colors: { disponible: "success", mantenimiento: "warning" } }
```

`colors` es opcional y sus claves deben ser valores del Selection. Colores:
primary, secondary, accent, info, success, warning, error y neutral. Sin color
configurado, badge usa neutral y texto sin widget conserva su color heredado.
Igual fallback para valores desconocidos; null/vacío se muestra como «—».
Texto escapado, clases estáticas del tema y
etiquetas multilínea. El badge sólido usa el color de contenido del tema.

modelColumns y createModelService rechazan badge en otros tipos/sensibles,
colores inválidos o claves ajenas a la selección. colors admite widget badge o
ningún widget; no se combina con image/partner/many2one. Sigue limitado a Selection.
El servicio reutiliza las opciones canónicas para sus columnas. Proveedores
manuales de colecciones declaran options explícitas; la whitelist legacy
partner/user no se amplía. renderCell/renderCard personalizados conservan su
prioridad; el contenido propio no recibe badges automáticos.

Es presentación: no cambia valores, SQL, permisos, filtros, orden ni agrupación.
ListView pasa options al filtro para ofrecer igualdad, desigualdad y vacío,
como las otras colecciones. Demo ficticia en `/sample#badge-collections`;
Flota lo usa en la columna estado. La demo permite alternar badge/texto en las
tres vistas sin modificar valores ni su configuración de consulta.

CardView y KanbanView usan header compacto compartido: breadcrumbs opcionales,
búsqueda, filtros, orden y acciones. title permanece como encabezado accesible;
icon/description se aceptan por compatibilidad sin el bloque visible de resumen.
CardView muestra el total sólo en el footer; Kanban conserva conteos por columna.
El skeleton usa el mismo header compacto. En móvil los controles se distribuyen
en filas, con Actualizar junto a Filtros; se mantiene autocomplete off.

Ambas vistas comparten una barra con:

- Búsqueda al pulsar Buscar o Enter, combinable con los filtros.
- Filtros por texto, número, booleano, fecha/rango e instante UTC, usando los
  controles de ListView. Las selecciones admiten igualdad, desigualdad y vacío.
- Etiquetas para quitar condiciones individuales y un botón para limpiar todo.
- Campo de orden y dirección.

`paramPrefix` separa sus parámetros de otras vistas en la misma página. La búsqueda,
filtros y orden permanecen en la URL y se restauran al volver o recargar. Las fechas
se capturan en la zona del navegador y se consultan como ISO UTC. Los proveedores
de servidor deben validar el estado y limitar los campos, como `createModelService`.

## CardView

```tsx
import CardView from "@/components/ui/card/CardView";
import { listRecords } from "../actions/record.actions";
import { recordColumns, recordSearchFields } from "./record.list";

<CardView
  model="MiModelo"
  title="Mis registros"
  titleField="name"
  breadcrumbs={[{ label: "Aplicaciones", href: "/erp" }, { label: "Mis registros" }]}
  columns={recordColumns}
  searchFields={recordSearchFields}
  load={listRecords}
  createHref="/erp/mi-app/nuevo"
  recordHref="/erp/mi-app/{id}"
  pageSize={12}
  paramPrefix="cards"
  className="flex-1"
/>
```

`load(state)` devuelve el mismo `ListResult` que ListView. El servidor consulta
el conjunto completo con sus filtros y devuelve una página; no se filtra únicamente
la página que ya está en el navegador. Se muestran total, tamaño de página y controles
anterior/siguiente.

Si se omite `titleField`, el título usa `$displayName` del servidor, después name
y finalmente ID. Un `titleField` explícito tiene prioridad; `subtitleField` es opcional.
Convención, lotes y límites en [Nombres de presentación](nombres-presentacion.md).
La tarjeta por
defecto muestra hasta cuatro campos adicionales de `columns`; estas columnas
también definen filtros/orden y su formato. `recordHref` añade enlaces de apertura
que incluyen `returnTo` con la URL actual. La vista de destino debe validar y usar
ese parámetro al construir su enlace de vuelta.

CardView usa padding exterior de 8px en móvil y 12px desde sm, con separación de
8px entre tarjetas. Las tarjetas predeterminadas tienen padding interior de 12px
y no reservan un bloque de detalles si no hay campos adicionales. Las columnas
tienen un mínimo de 21rem (336 px) y se reparten el ancho (desde 2026-11-25; antes
18rem; 24rem dejaba las tarjetas demasiado alargadas): una columna en móvil y
5 de unos 370 px en 1920 px.

Con recordHref, en CardView **toda la tarjeta abre el registro** (2026-11-25): un
único enlace real se extiende sobre ella, así que Ctrl/clic central, abrir en otra
pestaña y el teclado siguen funcionando, y no hay fila «Abrir registro». En la
tarjeta por defecto ese enlace es el título; con renderCard es un enlace invisible
con `aria-label="Abrir <título>"` y el contenido deja pasar los clics, salvo sus
propios enlaces, botones y campos, que siguen respondiendo. KanbanView conserva la
fila «Abrir registro» en tarjetas personalizadas porque sus tarjetas se arrastran y
tienen selector de estado.

En columnas se admite `options: [{value,label}]` para una selección; así el filtro
presenta sus etiquetas y no operadores de texto incompatibles con un enum.

## KanbanView

El primer proveedor de servidor agrupa por un **Fields.Selection obligatorio**, con
hasta 12 estados. Configurar el campo en el servicio editable de la aplicación:

```ts
export const recordService = createModelService(recordModel, MiModeloRepository, {
  columns: recordColumns,
  searchFields: recordSearchFields,
  kanban: { field: "status" },
});
```

El cascarón nuevo ya incluye acciones `loadKanban` y `moveRecord` con `requireAdmin`,
adaptadas a ese servicio. Si el modelo todavía no configura un campo kanban,
rechazan la operación explícitamente. Aplicaciones anteriores pueden crear las
mismas acciones delegando a `recordService.kanban(prisma, actor, request)` y
`recordService.move(prisma, actor, input)`, usando la sesión del servidor e
invalidando la ruta tras un movimiento exitoso.

```tsx
import KanbanView from "@/components/ui/kanban/KanbanView";
import { loadKanban, moveRecord } from "../actions/record.actions";

<KanbanView
  model="MiModelo"
  title="Tablero"
  titleField="name"
  columns={recordColumns}
  searchFields={recordSearchFields}
  groupField="status"
  groups={[
    { value: "draft", label: "Borrador", tone: "neutral" },
    { value: "done", label: "Terminado", tone: "success" },
  ]}
  load={loadKanban}
  onMove={moveRecord}
  recordHref="/erp/mi-app/{id}"
  pageSize={10}
  paramPrefix="board"
  className="flex-1"
/>
```

Los valores de `groups` deben coincidir con la selección del modelo. Para evitar
duplicarlos, se pueden tomar de `<Modelo>Fields.status.metadata.choices` del contrato
cliente generado, comprobando primero que `metadata.kind === "selection"`.
Sólo pasar las opciones serializables al componente; no pasar descriptores Fields
ni importar la clase del servidor dentro de una vista cliente.

`load({group,state})` devuelve `ListResult` de **una columna**. Cada columna consulta
su contador y su página independientemente, y tiene “Cargar más”. Los IDs repetidos
entre páginas se deduplican. El orden es el seleccionado en la barra; el arrastre
cambia el estado, no escribe una posición manual dentro de la columna.

Al cambiar filtros, actualizar o terminar un movimiento, se recargan las columnas
desde su primera página. Esto vuelve a aplicar orden, filtros y totales del servidor.
Si un filtro excluye el estado de destino, la tarjeta puede dejar de verse tras
guardar. La carga incremental de cada columna no se guarda en la URL.

## Movimiento y seguridad

Para módulos declarativos, `kanban: {field, transitions:[{from,to,action}]}` conecta
el movimiento a métodos @action dentro de la misma transacción, con permisos,
revisión, reglas, grupos e historial del método. La vista pasa
`transitions={config.kanbanTransitions}` y `onMove={modelMove.bind(null,config.id)}`.
Destinos no declarados se deshabilitan en selector/arrastre/teclado y el servidor
los rechaza de forma independiente. Si el resultado final no coincide con el
destino, el movimiento se revierte. `kanban:"estado"` y servicios con sólo field
mantienen el comportamiento directo previo. [Contrato y límites](modulos-declarativos.md#kanban-mediante-acciones-publicadas).

`onMove` recibe `{ id, revision, from, to }` y devuelve `{ok:true}` o
`{ok:false,error,kind?}`. Cada DTO movible necesita `revision` ISO UTC con milisegundos.
Sin `onMove`, la vista es de consulta; si falta revisión, esa tarjeta no es movible.

El servicio comprueba en una transacción Serializable:

1. Cuenta activa, permisos de escritura y versión de sesión leídos de la base;
   módulos declarativos aplican sus grupos/reglas, servicios sin authorizer
   conservan la política admin.
2. Estados declarados, ID, revisión y estado de origen actuales.
3. Validación completa y hooks `beforeSave`/`afterSave`, compartidos con FormView.
4. Escritura con comparación de revisión y avance de `updatedAt`.

No se acepta un campo/modelo arbitrario del cliente. Un rechazo mantiene el estado
anterior, muestra la alerta y recarga el tablero. Un error de red también recarga:
la respuesta pudo perderse después del commit. La vista no finge que un movimiento
ya se guardó mientras el proveedor todavía no lo confirmó.

Se usa `@dnd-kit/core` para arrastrar desde el asa con puntero o tacto. El teclado
permite tomar con espacio/Enter, cambiar de columna con izquierda/derecha,
soltar con espacio/Enter y cancelar con Escape. El selector de estado ofrece una
alternativa accesible sin arrastre. El área de las tarjetas mantiene el scroll
táctil; sólo el asa usa `touch-action: none`.

## Personalizar contenido y tamaño

Ambas vistas admiten `icon`, `description`, `headerActions`, `footer`, `createHref`,
`createLabel`, `recordHref` y `renderCard(record)` para dibujar el contenido de cada
tarjeta. Ese callback se define dentro de un componente cliente (como el ejemplo
de `/sample`); una función normal no puede cruzar el límite servidor/cliente.
Un Server Action sí puede pasarse como `load`/`onMove`.

Kanban usa padding exterior de 8px en móvil y 12px desde sm, con 8px entre
columnas. Conserva el ancho de columnas, el padding de las tarjetas y sus scrolls.

Usar un padre `flex min-h-0 flex-1 flex-col` y `className="flex-1"` para ocupar
el espacio disponible. En catálogos o paneles se puede definir altura explícita,
como `className="h-[42rem]"`. CardView adapta las columnas al ancho; KanbanView
conserva columnas legibles con scroll horizontal y scroll vertical por columna.

## Etiquetas Many2one y Selection

Una columna `widget: "many2one"` presenta el nombre del registro relacionado sin
reemplazar el ID guardado. El scaffold conecta el mismo `--lookup` autorizado del
formulario a las acciones de lista/kanban. Las vistas existentes pueden hacerlo
explícitamente en servidor:

```ts
return resolveListLabels(await queries.listRecords(state), {
  fabricanteId: lookupFabricantes,
});
```

Importar `resolveListLabels` de `@/lib/list/relation-labels`. Los proveedores son
fijos del servidor, nunca elegidos por el navegador. Cada uno autoriza su consulta;
lista y etiquetas se consultan en transacciones separadas. La respuesta incluye
sólo etiquetas auxiliares en `$labels`, sin objetos completos del lookup. Se
deduplican IDs por página y se dividen en lotes de hasta cien, sin caché compartida
entre usuarios. Un fallo del proveedor rechaza la página; una referencia ausente
o no legible para el actor se muestra vacía, igual que una relación sin valor.

ListView (incluidos vista rápida y grupos), CardView y KanbanView comparten esa
presentación. Selection usa `options` en celdas y encabezados de grupo. Orden y
filtros siguen actuando sobre los escalares originales; no hay búsqueda SQL por
etiquetas ni agrupación por rutas. Desde el 2026-11-15, con `filterLookups`, el
filtro de relación busca nombres mediante su lookup autorizado y aplica el ID
seleccionado con igualdad/desigualdad/vacío; no ofrece Contiene sobre el ID. Para grupos propios, publicar
`groupField` del nivel actual, preferiblemente mediante `groupedPage`.
Ejemplo ficticio junto al formulario RHF/Zod en `/sample#model-display-name`.

## Comprobaciones

```sh
npm run test:views
npm run test:scaffold
node --test src/lib/list/query.test.mjs src/lib/list/filters.test.mjs
npm run test:framework:integration
npm run build
```

La integración usa un esquema PostgreSQL temporal, sin datos del ERP. Cubre
contadores por columna, filtros combinados, estados desconocidos, permisos,
movimientos simultáneos, revisiones antiguas y rollback por reglas de negocio.

## Filtros Many2one por selección (2026-11-15)

ModelCollection conecta automáticamente los lookups publicados en config.lookups
con modelLookup, sin cambiar clases, vistas de aplicación ni SQL. Lista (cabecera),
Card y Kanban (panel Filtros) comparten ColumnFilter. Buscar muestra resultados
paginados del proveedor autorizado; seleccionar/aplicar guarda sólo `{field,
operator:"eq"|"neq",value:ID}` en la URL. También se admite vacío/tiene valor.
Las etiquetas de filtros activos se resuelven por ID mediante el mismo lookup;
no se publican objetos completos ni se sustituyen los permisos de servidor.

Las vistas base aceptan `filterLookups: { campo: loaderAutorizado }`. Una fuente
custom de ModelCollection puede suministrar `source.filterLookups`; no se mezcla
silenciosamente con proveedores de servidor por defecto. Sin lookup se conserva
el comportamiento anterior; las columnas de texto y Selection no cambian.
Las consultas del lookup autorizan acceso al destino, y la lista sigue verificando
sus permisos/reglas antes de filtrar por el escalar. La búsqueda general y el orden
no cambian: no se busca automáticamente por displayName compuesto del destino.

Si había un filtro de texto antiguo sobre la relación, quitarlo y volver a
seleccionar el registro; no se interpreta su texto como un nombre o una ruta SQL.
El panel descarta ese valor antiguo cuando su operador ya no está disponible.
Búsquedas fallidas ofrecen reintento; al cambiar consulta/proveedor se descartan
respuestas antiguas con el hook Many2one existente. Mantener autocomplete off.

Demo ficticia `/sample#relation-filter`, sin BD. Comprobados buscar Corolla,
seleccionar Toyota / Corolla, URL con model-1, un único vehículo y reapertura con
nombre resuelto. Prueba `npm run test:relation-filter` para operadores y predicados.
