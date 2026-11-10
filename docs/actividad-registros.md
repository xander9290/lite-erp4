# Actividad de registros: historial y notas

Implementado el 2026-11-10. El alcance inicial del chatter es registrar creación,
cambios guardados y notas internas. No incluye correos, adjuntos, actividades,
menciones, edición/borrado de notas ni seguimiento de cada pulsación del formulario.

## Por defecto en los servicios declarativos

Cada `createModelService` captura la creación y expone `activity` y `addNote`.
La infraestructura usa una tabla común `RecordActivity`, identificada por el nombre
fijo del modelo y el ID del registro; no crea una tabla de historial por aplicación.
Los modelos manuales y las escrituras Prisma directas requieren integración propia:
no hay triggers ni interceptación global de SQL.

Los cambios de valores se habilitan explícitamente en cada Field:

```ts
name = Fields.Text({ label: "Nombre", required: true, tracking: true });
active = Fields.Boolean({ label: "Activo", default: true, tracking: true });
secret = Fields.Text({ sensitive: true });
```

Sin `tracking: true` no se almacenan valores de ese campo. `sensitive: true` impide
combinarlo con tracking; no sustituye controles de publicación ni permisos del
formulario. No hay detección automática de secretos por nombre de campo.
El generador conserva estas opciones en sus declaraciones. Añadir tracking a un
campo existente no cambia columnas ni requiere migrar: sincronizar sus artefactos
con `orm:generate -- <id> --write`. No exige otro `orm:bind` si el acceso a los
campos ya está generado.

El scaffold nuevo marca `name` y `active` para seguimiento y conecta las acciones
y FormView automáticamente. Flota integra historial/notas y marca sus cuatro campos
actuales; conserva las reglas de negocio, listas y personalizaciones anteriores.
Los modelos existentes sin tracking empiezan con creación y notas; elegir sus
campos de seguimiento es un paso explícito.

La auditoría básica `RecordAudit` (`createBy`, fechas) mantiene su opt-in de
presentación `audit: true`. Es independiente de capturar actividad: no se publican
esas columnas adicionales sólo por tener historial.

## Guardados y transacciones

El servicio obtiene el registro anterior, verifica revisión y permisos, ejecuta
validación/hooks y vuelve a leer el resultado persistido. Compara sólo los campos
con tracking y crea la entrada dentro de la misma transacción Serializable.
`beforeSave`, `afterSave`, valores normalizados y movimientos kanban quedan
incluidos. Un error posterior revierte registro y actividad juntos. Un guardado
sin cambios en los campos rastreados no añade otra entrada de edición.

La creación genera sólo «Registro creado», con autor y fecha, sin snapshots ni
lista inicial de campos. Las diferencias anterior → nuevo se registran únicamente
al editar y guardar. Las entradas de creación antiguas tampoco publican sus
snapshots; no se reescriben ni borran esos datos históricos en la base.

Cada cambio de edición guarda campo, etiqueta, tipo, valor anterior y nuevo. Se conservan
`false`, cero, `null` y cadenas. Selection guarda también sus etiquetas; las fechas
son ISO UTC y se presentan en la zona del navegador. Many2one registra IDs, sin
consultar etiquetas de relaciones no autorizadas. El autor se referencia por ID
de User; la lectura muestra login/nombre/avatar actuales con un select limitado.
Los autores no se pueden eliminar mientras tengan actividad (FK Restrict).

No se reconstruyen cambios anteriores a esta implementación ni se atribuyen
eventos a registros antiguos. La auditoría básica existente permanece disponible.

## Acciones de servidor y permisos

Las acciones de cada aplicación fijan su servicio y obtienen el actor de la sesión:

```ts
export async function loadActivity(request: ActivityRequest): Promise<ActivityResult> {
  return recordService.activity(prisma, await requireAdmin(), request);
}
export async function addNote(request: ActivityNote): Promise<ActivityNoteResult> {
  return recordService.addNote(prisma, await requireAdmin(), request);
}
```

En acciones reales conservar el manejo de errores, como Flota o el scaffold.
No hay un endpoint que acepte modelos, actores, cambios o `where` del navegador.
Cada operación revalida active/admin/sessionVersion en su transacción y exige que
el registro exista. Los dominios de listas no se convierten en permisos de acceso
al historial: se mantiene la política admin del servicio actual.

- `activity({id, cursor?})`: lectura RepeatableRead; veinte entradas por página y
  cursor `{id, createdAt}`. Orden descendente por fecha e ID; no usa offset.
  Devuelve `{entries, nextCursor}`. Los tipos públicos están en `orm/activity.ts`.
- Al leer se vuelven a filtrar los campos que ya no tienen tracking o ahora son
  sensibles. Los valores históricos siguen almacenados en la base, pero no se
  publican por esta API. Una página puede quedar sin entradas visibles y conservar
  cursor para seguir consultando.
- `addNote({id, body, requestId})`: texto plano de 1–4000 caracteres, recortado en
  los extremos, con autor/fecha asignados por servidor. No cambia valores ni la
  revisión del registro. HTML se muestra literalmente, nunca se ejecuta.
- `requestId` es UUID y tiene unicidad por actor. Reintentar el mismo contenido
  devuelve éxito sin duplicarlo; reutilizarlo con otro modelo/registro/contenido
  se rechaza. Ante errores de red el cliente conserva texto e ID para reintentar.

No se exponen métodos para alterar/borrar entradas históricas. Esto no convierte
la tabla en un registro inmutable ante administradores de base o escrituras custom.
La referencia a un registro es genérica, sin FK hacia sus tablas: al eliminarlo se
conserva el historial, pero el servicio ya no permite consultarlo ni añadir notas.
No hay purga ni recuperación de historiales de registros eliminados en este alcance.

## FormView

```tsx
<FormView
  activity={{ recordId: savedId, load: loadActivity, addNote }}
  audit={audit ?? null}
  // ...props habituales
/>
```

`activity` habilita la columna lateral de 24rem; sin actividad, la auditoría básica
conserva 18rem. Ambas ocupan todo el alto del body y se apilan en móvil.
Cuando hay `activity`, el historial y las notas sustituyen al resumen superior de
creador/fechas: el editor de notas empieza arriba. Cada entrada muestra el avatar
del autor junto a su nombre (iniciales cuando no hay imagen o no carga), además de
su fecha y tipo de evento. Se reutiliza PartnerAvatar y sus validaciones de URL.
Los metadatos básicos siguen disponibles en el contrato y en vistas sin actividad.
Antes del primer guardado se muestra un aviso; no se aceptan notas sin ID real.

El historial se carga al abrir el registro y se actualiza después de guardar con
éxito o publicar una nota. El botón Actualizar permite consultar manualmente la
actividad reciente; las páginas anteriores se cargan a petición del usuario.
No hay sondeo periódico ni refresco automático por tiempo, websocket o SSE.
Escribir o revertir campos sin guardar no añade diferencias al historial.
Consultar actividad nunca resetea ni reemplaza los valores editables del registro.

Las notas tienen un borrador independiente de RHF, con confirmación de salida y
autocomplete off. Guardar/Revertir campos no publica ni elimina ese borrador.
Publicar no marca los campos como modificados. La UI de consulta puede omitir
`addNote` o usar readOnly; el servidor conserva su propia autorización.

`/sample#record-audit` demuestra cambios, notas y borradores con RHF/Zod y datos
ficticios en memoria; recargar reinicia la demo. La persistencia real está en Flota
y se verifica con la integración PostgreSQL aislada, sin usar registros reales.

## Instalación y verificación

La migración de infraestructura `20261110213022_record_activity` crea sólo la tabla,
índices y FK de autor. Se creó con `--create-only`, se revisó y se aplicó a la base
local; después se generó Prisma Client y se renovó dev. En otra máquina aplicar
las migraciones con el flujo del proyecto y generar el cliente antes de guardar
con los servicios nuevos. Una tabla ausente hace fallar la transacción; nunca se
continúa con un guardado sin historial.

`test:orm` incluye pruebas de tracking, campos sensibles y contratos de notas.
`test:framework:integration` verifica creación/edición, normalización de hooks,
idempotencia, revisión intacta al añadir notas, paginación, privacidad, autorización,
aislamiento entre modelos, concurrencia, kanban, rollback y registros eliminados
en un esquema/proyecto temporales. La documentación de estado distingue resultados
actuales de pruebas históricas y limitaciones de Windows.
