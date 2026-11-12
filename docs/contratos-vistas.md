# Vistas enlazadas al contrato del modelo

Implementado el 2026-11-11. Las clases siguen en el servidor; las vistas importan
los Fields publicados del contrato generado. Se conservan TSX editable y componentes
manuales: ningún modelo decide automáticamente la distribución del formulario.

## Un único contrato de presentación

El scaffold genera `schemas/recurso.ui.ts`:

```ts
import { recordFields } from "./modelo.schema";
import { lookupRecords } from "../actions/fabricante.actions";
export const recordUI = {
  fields: recordFields,
  lookups: { fabricanteId: lookupRecords },
  // uploads: imageUploads, cuando hay Fields.Image.
};
```

En el formulario:

```tsx
<FormView methods={methods} model={recordUI} onSubmit={saveRecord}>
  <FormGroup>
    <FieldText<RecordInput> name="name" />
    <FieldMany2One<RecordInput> name="fabricanteId" />
    <FieldSelect<RecordInput> name="vehicleType" />
  </FormGroup>
</FormView>
```

FormLayout también acepta `model`. Los controles existentes heredan label/required;
Text hereda minLength/maxLength, Select sus opciones, Many2one su lookup, Image su
uploader y Number el permiso para negativos según el mínimo del Integer. Los
componentes, variantes y distribución se eligen en TSX. Las props explícitas,
incluido `false` o una etiqueta vacía, tienen prioridad; `undefined` hereda el valor.
Un formulario sin modelo conserva su funcionamiento manual. Select exige opciones
explícitas o heredadas; Many2one exige un modelo legacy o un loader autorizado.
Las búsquedas propias de las relaciones se mantienen, con autocomplete del navegador
desactivado. RHF, Zod, notebooks y protección de cambios pendientes siguen activos.

Cambiar maxLength en la clase y regenerar con `orm:sync` actualiza el control
heredado. Si la vista fija maxLength explícitamente, ese override sigue vigente.
La presentación no sustituye la validación ni la autorización del servidor.

## Columnas en el mismo TSX

```tsx
import ListView from "@/components/ui/list/ListView";
import { recordFields } from "../schemas/modelo.schema";

<ListView model="FlotaModelo" title="Modelos" fields={recordFields}
  load={listRecords} searchFields={["name"]}>
  <ListView.Field name="name" sortable />
  <ListView.Field name="fabricanteId" sortable groupable />
  <ListView.Field name="vehicleType" groupable />
</ListView>
```

Field deriva etiqueta, tipo, widget Many2one/Image y opciones Selection del contrato
publicado; admite los overrides de ListColumn, usando `name` en lugar de `field`.
Se permiten fragmentos y condiciones, de 1 a 12 columnas, sin duplicados. Otros hijos,
campos no publicados o sensibles y combinar `columns` con hijos producen un error.
La comprobación de nombres JSX ocurre al resolver las declaraciones; TypeScript no
infiere los nombres de un hijo a partir de las props de su padre.

`columns` continúa disponible. Para compartir columnas con CardView/KanbanView,
`modelColumns(recordFields, [{field:"name",sortable:true}])` aporta inferencia de los
nombres en TypeScript. El archivo `.list.ts` es opcional para una ListView JSX;
el scaffold conserva uno como configuración compartida para otras colecciones.
Los descriptores/Zod se resuelven antes de pasar columnas al componente cliente;
no pasar una clase server-only ni un Model como prop de formulario.

## El servidor fija la política

```ts
export const recordService = createModelService(recordModel, repository, {
  list: {
    fields: ["name", "fabricanteId", "vehicleType"],
    searchFields: ["name"],
    sortable: ["name", "fabricanteId", "vehicleType"],
    filterable: ["name", "fabricanteId", "vehicleType"],
    groupable: ["fabricanteId", "vehicleType"],
  },
  relations: {
    fabricanteId: async request =>
      (await import("../schemas/modelo.ui")).recordUI.lookups.fabricanteId(request),
  },
  audit: true,
});
```

No importa vistas. Las capacidades sólo operan sobre `list.fields`; omitir una
capacidad la deshabilita. Se rechazan ordenamientos/filtros/grupos manipulados.
La ordenación por id sirve como fallback cuando no hay columnas ordenables.
`list.fields` publica hasta 12 campos no sensibles y, con `audit:true`, las rutas
aprobadas de auditoría. El DTO de colección contiene esos campos más id/revision y
etiquetas auxiliares; los select del repositorio pueden leer campos adicionales
para sus contratos de edición. Esta política no altera read/save ni define permisos
por fila: para contratos privados o políticas distintas se necesita servicio propio.
La configuración anterior `columns/searchFields` conserva compatibilidad y su
política explícita; no combinarla con `list`.

`relations` se declara una vez: lista normal, listas con domain, grupos y kanban
comparten la resolución por lotes de hasta 100 IDs. Sólo sale ID/etiqueta, sin caché
entre usuarios. Un lookup rechazado devuelve error de colección; una relación que
ya no está disponible muestra «No disponible», conservando el ID como clave.
Cada proveedor debe autorizar su lectura. El snapshot RepeatableRead pertenece a
la consulta base; los lookups autorizados corren después, en transacciones separadas.
Las etiquetas pueden reflejar cambios posteriores, nunca deciden filtros, orden,
conteos ni permisos. La importación diferida evita ciclos de inicialización entre
servicios y Server Actions relacionados.

## Lookups por convención

`create:views` busca el destino declarado en los perfiles locales y su acción
canónica `actions/recurso.actions.ts#lookupRecords`. Comprueba el contrato explícito
use-server/async, createQueryActions con requireAdmin y el repositorio del destino.
No concede autorización por el nombre de una clase. La ausencia/ambigüedad se
informa; `--lookup campo=modulo#exportAsync` conserva la alternativa personalizada.
Partner/User mantienen sus proveedores legacy autorizados. No se añaden dependencias
de aplicación ni permisos automáticamente. Los modelos con ciclos pueden necesitar
crear primero sus acciones y configurar un proveedor explícito.

## Nombres con tipos inferidos

```ts
const model = defineModel(FlotaModelo, {name:"FlotaModelo",table:"flota_modelo"});
export const flotaModeloModel = withDisplayName(
  model, {fabricante:flotaFabricanteModel}, ["name", "fabricante.name"],
  record => `${record.fabricante.name} · ${record.name}`,
);
```

Las dependencias limitan los campos visibles al callback e infieren su nulabilidad;
una relación opcional requiere `record.fabricante?.name`. Los nombres/rutas inválidos
se detectan en TypeScript. Se comprueba además en ejecución el destino de la relación,
la sensibilidad y la proyección publicada del generador. Para rutas de hasta tres
relaciones, cada modelo intermedio puede publicar su propio `displayRelations`
mediante withDisplayName. El formato es síncrono, recibe una proyección congelada y
sólo devuelve una etiqueta. `displayFields`/`displayName` de clase siguen soportados.

## Proponer cambios en vistas existentes

```bash
npm run update:views -- flota Modelo
# Revisa el diff completo, incluida la política del servidor.
npm run update:views -- flota Modelo --write
npm run orm:sync -- flota
```

Sin --write no modifica archivos. Propone controles, columnas JSX y capacidades
para campos declarados todavía ausentes. Los metadatos heredados se actualizan al
regenerar el contrato; no elimina overrides explícitos ni cambia reglas de negocio.
La política añadida aparece en el diff: revisa también campos que habías omitido
intencionalmente. No elimina campos retirados ni modifica menús.

El primer alcance exige modelo completo no sensible, recordUI explícito, formulario
enlazado con un único FormGroup y nombres literales, ListView con columnas JSX y
servicio con política list literal. Si una vista no existe, sólo considera las
existentes. CardView, múltiples grupos, JSX dinámico y configuraciones personalizadas
requieren intervención manual y se rechazan. Conecta proveedores nuevos de relaciones
o imágenes antes de proponer sus controles. Las escrituras comprueban cambios
concurrentes, rechazan symlinks y restauran archivos ante fallos ordinarios; no hay
regeneración indiscriminada ni garantías de atomicidad ante interrupciones.

Ejemplo funcional sin persistencia: `/sample#model-fields`. Flota adopta el contrato
en sus tres formularios, política independiente en sus servicios, columnas JSX y
nombre tipado en Modelo, y metadatos derivados para las tarjetas de Fabricante.
