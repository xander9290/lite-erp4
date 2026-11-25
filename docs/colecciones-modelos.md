# Una colección, varias presentaciones

Desde 2026-11-19 el modelo del manifest admite `domain: d => ...` como fuente
común de Lista/Card/Kanban, aplicada en servidor antes de conteos/páginas/grupos.
No se declara en columnas TSX. Las colecciones One2many readonly usan su propia
fuente fijada por la inversa y no heredan ese dominio de la colección principal;
conservan permisos y reglas de registro. [Contrato de dominios](dominios-modelos.md).

Implementado el 2026-11-14. La aplicación declara su modelo, política y configuración
Kanban una vez. ModelCollection conecta los proveedores autorizados, campos publicados,
búsqueda, filtros, orden y navegación; cada vista TSX decide únicamente su presentación.
Los componentes ListView, CardView y KanbanView siguen disponibles por separado.

## Registro y selección

```ts
vehicle: {
  model: Vehicle,
  view: "kanban", // presentación inicial
  kanban: {
    field: "estado",
    transitions: [
      { from: "disponible", to: "mantenimiento", action: "enviarMantenimiento" },
      { from: "mantenimiento", to: "disponible", action: "finalizarMantenimiento" },
    ],
  },
  views: {
    list: () => import("./views/VehicleList"),
    card: true, // presentación por convención, sin archivo obligatorio
    kanban: () => import("./views/VehicleKanban"),
    form: () => import("./views/VehicleForm"),
  },
}
```

Las claves list/card/kanban registran alternativas independientes; true usa la vista
compartida y una función carga TSX personalizado de forma diferida. La presentación
inicial también queda disponible por convención. No es obligatorio declarar tres
vistas ni crear tres archivos. Sin cambios al manifest, list/form existentes conservan
su comportamiento. Kanban exige la configuración válida del modelo, incluido un
Selection público/obligatorio/publicado con máximo 12 estados.

La ruta compartida muestra un selector sólo cuando hay más de una alternativa y
resuelve `?view=list`, `?view=card` o `?view=kanban`. Valores desconocidos, repetidos
o no registrados vuelven a la presentación inicial; nunca se importa una ruta ni
se elige un proveedor a partir de texto arbitrario del navegador.

## TSX de presentación

```tsx
import ModelCollection from "@/components/modules/ModelCollection";
import type { ModelClientConfig } from "@/lib/modules/config";

export default function VehicleKanban({ config }: { config: ModelClientConfig }) {
  return <ModelCollection config={config} view="kanban" columns={[
    { field: "name" },
    { field: "plate" },
    { field: "estado", widget: "badge",
      colors: { disponible: "success", mantenimiento: "warning" } },
  ]} />;
}
```

El mismo contrato funciona con view="list" o view="card". columns elige qué se ve
y sus widgets, colores y etiquetas; no amplía la política de publicación del servidor.
Los related de lectura siguen sin búsqueda, filtros, orden ni grupos SQL.

Para diseñar tarjetas libremente, añadir "use client" en la vista y pasar renderCard;
renderCell personaliza celdas de lista. Se conservan titleField, subtitleField,
headerActions, footer y className. No pasar callbacks normales desde un Server
Component a un Client Component. Los renderers no ejecutan consultas ni negocio.

create={false} oculta Nuevo; delete={false} desactiva la acción de eliminación de
la lista; movable={false} presenta el tablero como consulta. open={false} omite
enlaces al formulario. Son opciones de UI, sin cambios de permisos del servidor.

## Contrato compartido y consulta

`modelCollection(config, columns?)` en lib/modules/collection produce descriptores
de presentación, queryColumns, enlaces comunes y los grupos/rutas Kanban. Las
capacidades de consulta proceden de config.list, independientemente de que una
tarjeta omita un campo. Así, cambiar de presentación no pierde una ordenación
válida por un campo que no se está dibujando. La UI de tarjeta/tablero ofrece
filtros y orden del contrato publicado; restricciones explícitas de una columna
(sortable/filterable false) se respetan también en esos controles. Ninguna prop
concede permisos.

ModelCollection enlaza por defecto modelList/modelKanban/modelMove/modelDelete a
un ID registrado. Las acciones siguen autorizando sesión, CRUD, reglas, revisión
y transiciones en el servidor. Un tablero con transitions ejecuta @action y sus
hooks, sin volver a escribir estados directamente. No se añaden consultas SQL ni
esquemas alternativos en la vista.

CollectionSource permite proveedores propios con los mismos tipos: load(state),
loadKanban({group,state}), move e remove opcionales. Al suministrarlo no se mezclan
silenciosamente mutaciones del proveedor por defecto. El proveedor custom debe
implementar su autorización en servidor; la demo pública usa datos ficticios.

## Estado, paginación y retorno

- Al cambiar de presentación se conservan búsqueda, filtros (incluidos errores
  de formato), orden/dirección, tamaño y parámetros ajenos.
- Se reinician página y agrupación de lista; se desmonta la presentación anterior,
  limpiando selección de filas y páginas incrementales del tablero. No se trasladan
  selecciones ni grupos de lista a una columna Kanban.
- Lista y Card consumen el mismo proveedor paginado. Kanban conserva su proveedor
  por columna y sus conteos/paginación independientes; no filtra en cliente una
  página de lista para simular un tablero. Tamaño inicial del core: 25, máximo del
  servidor 50. Los componentes originales conservan sus defaults propios.
- La URL permite enlaces directos y atrás/adelante. Abrir/crear un formulario
  conserva returnTo; ModelForm lo valida contra la ruta exacta de la colección y
  lo mantiene tras crear/guardar, en Nuevo y en el breadcrumb. La eliminación
  conserva su retorno seguro existente y el guard de cambios pendientes.
- La ruta modular contiene una colección principal sin prefix. Para demos o
  composiciones propias, CollectionViews y ModelCollection aceptan paramPrefix;
  ambos deben usar el mismo valor (incluido `<prefix>_view`). No mezclar diferentes
  namespaces entre las presentaciones de una misma colección.

## Expulsar una presentación

```bash
npm run eject:view -- flota vehicle card --dry-run
npm run eject:view -- flota vehicle card
npm run eject:view -- flota vehicle kanban --dry-run
npm run eject:view -- flota vehicle kanban
```

Ejemplos para tipos no expulsados todavía: si ya hay archivo/loader personalizado,
el comando rechaza la colisión. Form/list siguen disponibles. Un registro true se
puede sustituir por su loader generado; otras vistas se conservan. Kanban sin
configuración se rechaza antes de escribir. No SQL, migraciones, --force ni
sobrescritura de archivos existentes.

## Flota y verificación

Vehículos registra sus tres presentaciones, con Kanban inicial. VehicleList conserva
su diseño; VehicleKanban se simplifica al wrapper y VehicleCard muestra logo,
nombre, matrícula y estado. Modelo conserva Card inicial y añade Lista por
convención, sin borrar su vista personalizada. Fabricante y los formularios no
se regeneran.

Demo independiente: `/sample#collection-core`, con fuente ficticia compartida,
selector, búsqueda/filtros/orden y paginación; sin escrituras en BD. Las pruebas de
contrato verifican publicación, capacidades, registro y URL; el generador comprueba
registro separado de tipos y preservación de loaders personalizados.

## Capacidades del actor

La ruta entrega config.capabilities desde el servidor. ModelCollection exige read
y limita Nuevo por create, Eliminar por unlink y onMove por move. Las props sólo
pueden reducir esas capacidades. Sin snapshot se deniega la presentación; demos
y fuentes propias deben declararlo explícitamente. Acciones y grafo se proyectan
por actor, sin sustituir las reglas transaccionales por registro. No requiere
repetir condiciones en cada TSX. [Contrato](capacidades-modelos.md).

## Carga, respuestas antiguas y recuperación (2026-11-15)

`ui/collection/useCollectionLoad` centraliza el ciclo de consulta para Lista/Card,
ramas desplegadas de listas agrupadas y cada columna Kanban. El estado se identifica
por consulta, proveedor e intento. Al cambiar consulta/proveedor o desmontar la
vista se invalida la respuesta anterior: éxitos y errores tardíos no se publican.
La cancelación es lógica; no interrumpe SQL ni una Server Action ya enviada.

Las excepciones de conexión producen «No pudimos conectar. Intenta nuevamente.»;
los resultados `ok:false` conservan el mensaje del servidor. Reintentar ejecuta
sólo la consulta fallida, sin ciclos automáticos ni reintentos de mutaciones.
Lista/Card muestran carga limpia al cambiar de página/consulta/proveedor. Las
ramas y columnas mantienen su carga independiente.

Kanban conserva páginas ya cargadas durante la carga/reintento de la siguiente,
acumula por identidad y actualiza registros repetidos sin duplicarlos. No mezcla
datos de otra consulta o proveedor; un cambio de proveedor reinicia la columna
en la primera página. Filtros y actualización global siguen desmontando columnas
y cargando desde uno; tras mover se conserva la confirmación y recarga del servidor.
Un error de una columna no borra ni reintenta las demás. Autorización, URL,
paginación de servidor, selección y contratos de proveedores siguen vigentes.
No hay cambios en los modelos ni necesidad de orm:sync.

Demo `/sample#collection-core`: selector Normal / Fallo de conexión una vez /
Respuesta lenta. El fallo afecta a la siguiente consulta; en Kanban sólo a Por
hacer. Reintentar recupera sin BD. En respuesta lenta, buscar «lento» demora 2,5 s;
cambiar la búsqueda antes de recibirlo permite comprobar el descarte de la anterior.

Pruebas: `npm run test:collection-load` cubre respuestas fuera de orden, cancelación
antes de iniciar y durante carga, errores tardíos, rechazo síncrono/asíncrono,
mensajes del servidor, recuperación, independencia de columnas y acumulación
sin mezclar filtros/proveedores. No se añade AbortSignal a los contratos existentes.

## Campos compute

Lista/Card/Kanban consumen los valores calculados por el servicio para la página
autorizada, reutilizando @depends. ModelCollection acepta `{field:"kilometrosRestantes"}`
sin renderers ni fórmulas adicionales. Son columnas de lectura y no habilitan
búsqueda/filtros/orden/grupos. La política incluye dependencias y salidas publicadas;
no se calculan cabeceras de grupo. [Alcance y límites](campos-calculados.md#lista-card-y-kanban-2026-11-15).
Demo independiente `/sample#computed-collections`.

## Varias pantallas sobre el mismo modelo

Para presentar el mismo modelo con listas, dominios y formularios distintos (por
ejemplo Contactos y Direcciones), usar `screens` en el manifest en lugar de
duplicar el modelo. Contrato en [Pantallas nombradas](pantallas-modelos.md).
