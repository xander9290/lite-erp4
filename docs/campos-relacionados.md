# Campos relacionados de lectura

Implementado el 2026-11-12 como primer paso de la metodología: modelos del servidor
declaran relaciones, cálculos y reglas; React presenta resultados y gestiona la
interacción. Se conservan Prisma, TypeScript y vistas TSX editables.

Los ejemplos con nombres de Flota ilustran el contrato. Aquella aplicación se
retiró el 2026-11-12 para reiniciar la tutoría; las demos y las APIs compartidas
siguen disponibles.

## Declarar y presentar

```ts
class FlotaVehicle extends Model {
  name = Fields.Many2one("FlotaModelo", { required: true });
  fabricanteAvatar = Fields.Image({
    related: "name.fabricanteId.avatar",
    label: "Fabricante",
  });
  fabricanteNombre = Fields.Text({ related: "name.fabricanteId.name" });
}
```

No requiere método con `findUnique`, `@depends` ni handler de frontend para copiar
la URL. La primera parte de la ruta es el nombre del Field Many2one local. Los
saltos posteriores aceptan nombres de Fields (preferidos) o aliases de relaciones
existentes, como `fabricante`. Límite de tres relaciones; destino final Text para
Text e Image para Image. Los modelos destino deben estar en el mismo perfil.

El formulario sólo coloca el control:

```tsx
<FieldImage mode="display" name="fabricanteAvatar"
  widget="avatar" shape="squared" direction="inline" />
```

El modo display no registra un campo RHF, no tiene uploader, selector de archivos
ni botón para quitar la imagen. Hereda el label, muestra vacío/carga y permite
reintentar errores del motor. Mantiene URLs HTTPS seguras. El modo editable
existente conserva su API y comportamiento.

## Contratos y generación

Los `related` declarados arriba se separan de los Fields persistentes al compilar
el modelo. **No añadirlos a clientFields**, defaults, esquema Zod de guardado ni
valores RHF. Tampoco crean columnas, índices, auditoría ni uploaders. Se rechazan
required/unique/tracking/sensitive activos y cualquier default en un related.
Un formulario no puede falsificarlos dentro del payload: Zod estricto los rechaza.

Se publican en `<Modelo>PreviewFields`, junto al preview existente, y sus reglas
de dependencia se generan automáticamente. `recordUI` los conecta como:

```ts
import { recordFields, recordReadFields, recordReactionRules } from "./vehicle.schema";
export const recordUI = {
  fields: recordFields,
  readFields: recordReadFields,
  reactions: { rules: recordReactionRules, load: onchangeRecord },
  // lookups/uploads existentes se conservan.
};
```

`recordReadFields` reexporta `<Modelo>PreviewFields`. Los scaffolds nuevos generan
estos enlaces y un FieldImage display para cada Image related. No regenerar vistas
personalizadas. Para adaptar una vista anterior, añadir estos enlaces explícitos.

Ejecutar `orm:generate -- app --write` y `orm:bind -- app --write`, o el flujo
`orm:sync -- app` cuando corresponda; el código de generación verifica todas las
rutas. Cambiar sólo un related no requiere SQL ni migración. Los bindings se
compilan contra Prisma Client antes de escribirse; nunca editarlos a mano.

## Resolución y límites

- Reutiliza la acción de reacciones: sesión/admin revalidados y transacción
  RepeatableRead de sólo lectura. Un registro existente requiere ID/revisión
  vigentes. El navegador aporta el ID local, nunca un select, ruta o modelo.
- El generador exige publicación explícita y ausencia de sensibles en cada salto.
  Sólo permite modelos declarativos del perfil bajo la política admin actual;
  no introduce ACL granulares para destinos con reglas propias. Esos casos
  requieren un servicio autorizado específico.
- Los bindings usan delegates Prisma explícitos y proyecciones mínimas fijas,
  con guardas de metadata vigente. Las salidas con la misma raíz se unen en una
  llamada Prisma; esto no promete un único SQL para las relaciones anidadas.
- Relación intermedia/imagen vacía produce null. Un ID raíz inexistente produce
  error controlado. El resultado se valida con el Field de lectura antes de salir.
- Se calcula al abrir/resetear, cambiar la relación o reintentar. Conserva control
  de respuestas antiguas y no ensucia el formulario. No son suscripciones a cambios
  externos del fabricante: recargar/reintentar obtiene el valor actual.
- Related también se publica en colecciones mediante CollectionFields y cargas
  por lote (sección siguiente). No son campos calculados persistidos, inverse ni
  búsquedas/orden/grupos por related.
  Text related se presenta con FieldText mode=display, añadido junto a los
  [campos calculados virtuales](campos-calculados.md). No encadenar related con otros related.

Demo RHF/Zod en `/sample#related-image`, con modelos e imagen pública ficticios,
sin acceso a datos reales. El Vehicle del ejercicio anterior usaba estas declaraciones.

## ListView, CardView y KanbanView

El contrato generado exporta `<Modelo>CollectionFields`: Fields persistentes más
related, con capacidades de lectura. Mantener Fields para los formularios editables.
No añadir related a clientFields ni a sus schemas de guardado.

```ts
// schemas/vehicle.schema.ts
export { FlotaVehicleCollectionFields as recordCollectionFields }
  from "@/generated/orm/apps/flota/FlotaVehicle.schema";
```

```tsx
<ListView fields={recordCollectionFields} load={listRecords} /* ... */>
  <ListView.Field name="name" sortable groupable />
  <ListView.Field name="fabricanteAvatar" imageShape="squared" imageSize="sm" />
</ListView>
```

Para CardView/KanbanView, usar modelColumns(recordCollectionFields, columnas) y el
mismo proveedor de servidor. En la política list del servicio, publicar explícitamente
fabricanteAvatar dentro de fields. No incluirlo en searchFields, sortable, filterable
ni groupable: no existe como columna SQL. Las capacidades se validan en servidor
independientemente de las props de la vista.

El repositorio generado implementa relatedMany con delegates explícitos y proyecciones
limitadas a las salidas solicitadas. Se consultan sólo IDs distintos presentes en la
página/rama y lotes de hasta 100 por raíz. El servicio valida las URLs/textos y publica
sólo list.fields dentro de la misma transacción autorizada RepeatableRead. La carga de
grupos no consulta imágenes; se cargan al abrir las páginas de registros.
Regenerar contratos y binding con orm:generate/orm:bind; no requiere SQL.
Los bindings anteriores fallan explícitamente si falta relatedMany y hay registros.
La demo /sample#image-collections ofrece related de servidor con repositorio ficticio;
las pruebas SQL usan bindings reales en un esquema temporal.

Many2one directo sí se puede agrupar por su ID persistente: habilitar groupable en
la columna y en list.groupable, con proveedor de etiquetas en relations. El Vehicle
del ejercicio anterior habilitaba name (Modelo). Los nombres iguales no fusionan IDs. Esto no habilita
agrupación por rutas relacionadas ni columnas Kanban por Many2one; el contrato de
columnas Kanban sigue siendo Selection obligatorio.

## Siguiente evolución

Consolidar la proyección común con nombres de presentación y colecciones antes
de añadir cálculos persistidos. Para estos últimos habrá que definir invalidación
por cambios relacionados, escrituras fuera de formularios, ciclos y recomputación
por lotes. No inferir que `@depends` actual mantiene columnas calculadas.
