# CardView y KanbanView

Componentes en `src/components/ui/card` y `src/components/ui/kanban`.
Ejemplos interactivos: `/sample#card-view` y `/sample#kanban-view`.
La demo es local y pública: sus proyectos son ficticios, no se guardan en la base
y se reinician al recargar. La integración del servicio real se prueba por separado.

## Búsqueda y filtros comunes

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

`titleField` identifica el título y `subtitleField` es opcional. La tarjeta por
defecto muestra hasta cuatro campos adicionales de `columns`; estas columnas
también definen filtros/orden y su formato. `recordHref` añade enlaces de apertura
que incluyen `returnTo` con la URL actual. La vista de destino debe validar y usar
ese parámetro al construir su enlace de vuelta.

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

`onMove` recibe `{ id, revision, from, to }` y devuelve `{ok:true}` o
`{ok:false,error,kind?}`. Cada DTO movible necesita `revision` ISO UTC con milisegundos.
Sin `onMove`, la vista es de consulta; si falta revisión, esa tarjeta no es movible.

El servicio comprueba en una transacción Serializable:

1. Cuenta activa, permisos admin y versión de sesión leídos de la base.
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

Usar un padre `flex min-h-0 flex-1 flex-col` y `className="flex-1"` para ocupar
el espacio disponible. En catálogos o paneles se puede definir altura explícita,
como `className="h-[42rem]"`. CardView adapta las columnas al ancho; KanbanView
conserva columnas legibles con scroll horizontal y scroll vertical por columna.

## Verificación

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
