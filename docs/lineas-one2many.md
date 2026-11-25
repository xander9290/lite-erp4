# Líneas declarativas y guardado del documento

`Fields.One2many` conecta un modelo padre con las filas de un modelo hijo. La tabla
`FieldOne2many` edita un borrador inline; Guardar persiste el documento completo en
una transacción Serializable. Esta integración pertenece a los módulos declarativos
creados con `defineModule` en `src/modules`. El scaffold anterior con `orm.config.ts`
requiere un servicio propio y no recibe persistencia anidada automática.

## Modelo padre e inversa

```ts
import { Fields, Model, ModelValidationError, constraint } from "@/lib/orm";

export class Documento extends Model {
  name = Fields.Text({ required: true });
  limite = Fields.Integer({ required: true, default: 100, min: 0 });
  lineas = Fields.One2many("ComprasDetalle", {
    inverse: "documentoId", label: "Detalles", maxRows: 50,
  });

  @constraint("limite", "lineas")
  comprobarTotal(values: Readonly<Record<string, unknown>>) {
    const lineas = values.lineas as { cantidad: number }[];
    if (lineas.reduce((sum, row) => sum + row.cantidad, 0) > Number(values.limite)) {
      throw new ModelValidationError("Las líneas superan el límite.", {
        lineas: "Reduce la cantidad total.",
      });
    }
  }
}

export class Detalle extends Model {
  name = Fields.Text({ required: true });
  documentoId = Fields.Many2one("ComprasDocumento", {
    required: true, onDelete: "Restrict",
  });
  cantidad = Fields.Integer({ required: true, min: 1, default: 1 });
}
```

Registrar ambos en el mismo `defineModule({ id: "compras", models:
{ documento: Documento, detalle: Detalle } })`. Los destinos usan el nombre del
contrato (`ComprasDetalle`), formado por módulo y clave, no el nombre de la clase.

La inversa debe ser Many2one obligatoria, no única y con `onDelete: "Restrict"`.
`One2many` no añade una columna SQL al padre: utiliza la FK del hijo. Sus defaults
son un arreglo nuevo, `minRows: 0`, `maxRows: 50`. Se admite un máximo de 100 filas
por relación, hasta cuatro relaciones por padre y un solo propietario declarado
por modelo hijo. En esta primera versión el hijo debe pertenecer al mismo módulo,
no declarar otras líneas ni campos `sensitive`. Las declaraciones incompatibles se
rechazan al cargar el manifest.

Al crear modelos o modificar campos persistidos: `npm run orm:sync -- compras` y
revisar el SQL. Añadir únicamente One2many sobre una FK ya instalada no crea otra
tabla ni columna. Reiniciar dev si cambia el cliente Prisma.

## Vista

ModelForm dibuja las líneas por defecto. En una vista personalizada, dentro del
ModelRecordForm habitual:

```tsx
<FormGroup fullWidth legend="Contenido">
  <FieldOne2many name="lineas">
    <FieldOne2many.Column name="name" widget="long" />
    <FieldOne2many.Column name="cantidad" align="right" />
  </FieldOne2many>
</FormGroup>
```

`FieldOne2many` se importa de `@/components/ui/form/FieldOne2many`. No se repiten
`columns`, `createRow`, defaults, labels, obligatoriedad, tipos ni validación de
campos: `buildModelUI(config)` incorpora el contrato del hijo a `ui.recordUI` y a
`ui.schema`. La inversa queda fuera del formulario y se asigna en servidor. Se
pueden declarar entre 1 y 12 columnas únicas, `label`, `width`, `align` y un widget
compatible con el Field. Omitir children muestra los campos escalares del hijo.
La variante manual anterior con `columns/createRow` continúa disponible; no mezclar
las dos formas.

Para una celda especial se permite `render={({ fieldName, row, index }) => ...}`
en Column; reutilizar los Fields y conservar el nombre accesible por fila.
`fieldName("cantidad")` entrega `lineas.0.cantidad`. Los lookups e imágenes heredan
sus proveedores del modelo hijo. Los campos `compute`/`related` y las reacciones
`onchange` dentro de filas aún no se publican como columnas automáticas. La lógica
de guardado del hijo sí se ejecuta siempre que se crea o modifica una línea.

Ejemplo local RHF/Zod, sin BD: `/sample#one2many-model`. El ejemplo manual anterior
permanece en `/sample#field-one2many`.

## Transacción y lógica

El navegador envía todas las líneas con sus datos escalares. Una nueva no tiene
`id/revision`; una existente conserva ambos. Quitarla del borrador sólo programa
su baja para el próximo Guardar. No enviar la inversa ni datos de auditoría.

El servicio autoriza al actor y verifica la revisión del padre, carga la colección
completa, valida identidades y ejecuta normalize/beforeSave del padre. Después
escribe el padre, aplica altas/cambios/bajas mediante los servicios del hijo,
vuelve a leer las líneas canónicas y ejecuta las constraints del padre. afterSave
del padre recibe el documento con líneas e IDs definitivos. La lógica hija usa
normalize, beforeSave, constraints y afterSave habituales en esa misma transacción,
con auditoría del creador al crear. Las líneas sin cambios no se reescriben.

Por tanto, normalize/beforeSave del padre trabajan con el borrador; una constraint
sobre `lineas` ve los resultados de normalización y hooks del hijo. Context.previous
contiene el documento anterior, con sus líneas, como copia congelada. Para cambiar
filas desde un hook, devolver arreglos/objetos nuevos; no mutar previous. No ejecutar
efectos externos en los hooks: un error posterior puede revertir la transacción.

Un error en cualquier escritura, constraint o hook revierte padre, hijos e historial.
Los errores de línea se prefijan, por ejemplo `lineas.1.name`, y FormView conserva
el borrador. Los IDs ajenos, repetidos, revisiones antiguas y campos no declarados
se rechazan. Las reglas agregadas se expresan con `@constraint("lineas", ...)`;
no es necesario recorrerlas desde una Server Action propia.

Guardar desde la vista independiente del hijo sigue siendo posible: exige también
permiso de escritura sobre el padre, valida su documento y avanza su revisión.
Esto incluye crear, editar, eliminar y ejecutar acciones/movimientos mediante el
servicio del hijo. No se permite trasladar una línea existente a otro padre.
Si los hooks del padre vuelven a modificar el hijo, su respuesta se relee para
entregar la revisión definitiva. Las acciones y Kanban del padre conservan las
líneas; los botones de formulario mantienen su guardado previo habitual.

## Relaciones de consulta (`readonly`, 2026-11-19)

**Regla:** usa líneas editables sólo para hijos acotados que se editan junto con su
documento (`maxRows ≤ 100`). Para hijos numerosos o sin tope claro (municipios de un estado,
comentarios de un pedido) declara una relación de consulta y crea los hijos **desde su
propio formulario**.

```ts
class Estado extends Model {
  municipioIds = Fields.One2many("UbicacionesMunicipio", { inverse: "estadoId", label: "Municipios", readonly: true });
}
```

- No forma parte del documento: ni RHF/Zod, ni guardado, ni revisión, ni límite de filas.
  Enviar la clave al guardar se rechaza como campo no declarado.
- El formulario del padre muestra la colección del hijo **paginada, con búsqueda, filtros y
  orden** (`<ModelChildCollections />`; el formulario por defecto la incluye). El servidor fija
  `<inverse> = registro` (AND con cualquier filtro del navegador), exige leer al padre y
  aplica permisos y reglas del hijo (`modelChildren` → `childCollectionList`).
  El dominio del manifest del hijo corresponde a su colección principal y no se
  hereda aquí: la inversa fija la fuente de esta consulta independiente. Los filtros
  válidos del usuario y la política de campos siguen aplicándose.
- Cada fila abre el formulario del hijo; «Nuevo» llega con el padre preasignado
  (`?default_<inverse>=<id>`, validado al guardar como cualquier Many2one) y vuelve al padre.
- Mismo módulo; el hijo debe tener un Many2one `inverse` hacia el padre (obligatorio o no).
  Con el registro sin guardar se muestra «Guarda el registro para ver …».
- Formularios expulsados: coloca `<ModelChildCollections />` (o `name="municipioIds"`) donde
  deban aparecer; las colecciones ya no usan `<form>` propios, así que caben dentro del
  formulario del registro sin que Enter lo envíe.

Desde 2026-11-22, `openIn="modal"` abre «Nuevo» y las filas en el formulario
del hijo sin salir del principal. También se admite la consulta en extensiones,
incluida una inversa añadida por esa extensión. Guardado independiente y cierre
protegido: [Formularios en modal](formularios-modal.md).

## Permisos y límites

## Líneas anidadas (2026-11-19)

Una línea puede declarar sus propias líneas: **documento → línea → sublínea**, hasta 3
niveles, sin ciclos y con un solo dueño por modelo. Ejemplo: Pedido → Partidas → Entregas.

```ts
class Partida extends Model {
  pedidoId = Fields.Many2one("VentasPedido", { required: true });
  entregas = Fields.One2many("VentasEntrega", { inverse: "partidaId", label: "Entregas", maxRows: 10 });
}
```

- Se lee y guarda el **árbol completo** en una transacción: cada nivel corre su propio
  servicio (normalize, hooks, constraints, dominios, historial). Un cambio sólo en una
  sublínea guarda su línea (avanza su revisión) y deja intactas las hermanas.
- Límites: `maxRows ≤ 100` por relación y **500 filas en total** por documento, además del
  tamaño del payload. Una fila no legible en cualquier nivel impide abrir el documento.
- Quitar una línea quita sus sublíneas de abajo hacia arriba, por sus servicios; borrar una
  línea suelta desde su propia vista sigue bloqueado por `Restrict` mientras tenga sublíneas.
- Errores con la ruta completa (`lineas.0.entregas.1.cantidad`); cualquier fallo revierte
  todo el documento.
- Una escritura independiente de una sublínea avanza la revisión de su línea y del
  documento: un borrador abierto queda obsoleto.
- Formulario: `FieldOne2many` muestra un botón para expandir cada fila con sublíneas; la
  tabla del nivel siguiente aparece debajo, editable en línea, sin modales. Las filas con
  errores en sus sublíneas se abren solas; las cerradas siguen montadas (RHF conserva sus
  valores y validación).
- No es para catálogos grandes (p. ej. municipios por estado): ver
  [One2many anidados](ideas/one2many-anidados.md).

Se comprueban permisos/reglas del padre y cada operación del hijo dentro de la
transacción. Además, el motor de accesos limita automáticamente los registros del
hijo a los padres que el actor puede leer, mediante la relación inversa declarada.
Esto protege también listas, lookups y aperturas directas de la vista independiente;
no se necesita copiar el domain del padre ni enumerar sus IDs. El filtro se combina
con AND fuera de las reglas de grupo del hijo: una regla propia de «todos» no puede
ampliar el alcance del padre. Sus permisos CRUD y reglas adicionales permanecen
obligatorios. Si falta lectura del modelo padre, se deniega el hijo y la UI oculta
sus capacidades; los administradores conservan su bypass habitual. Las escrituras
independientes siguen necesitando escritura en el padre, además de lectura.
 Consultar el documento requiere leer la colección completa: si una
regla oculta alguna fila, o se excede maxRows, se rechaza abrir/guardar el documento.
Nunca se interpretan como bajas las líneas ocultas por permisos. Ediciones del
padre que dejan sus líneas intactas no necesitan permisos write/unlink del hijo.
La UI oculta agregar y bloquea filas/bajas según capacidades, sin sustituir al servidor.

No hay paginación de líneas, persistencia de orden manual, más de 3 niveles,
Many2many en hijos ni borrado en cascada del padre (sólo las sublíneas de una línea que se
quita desde su documento). La FK Restrict impide borrarlo
mientras conserve hijos. Las escrituras Prisma directas y servicios personalizados
no pasan por este coordinador: deben implementar sus propias reglas, permisos,
auditoría y avance de revisión del padre.

`FormValues<typeof Documento>` incluye la colección. Un destino declarado como string
no permite inferir automáticamente la forma de otra clase; para métodos tipados se
puede declarar `Fields.One2many<MiTipoDeFila>(...)`, incluyendo `id?/revision?`.
El contrato cliente y cada servicio hijo validan los datos reales con Zod.

## Verificación

`npm run test:nested:integration` prueba el árbol de 3 niveles en proyecto/esquema
temporales. `npm run test:orm`, `npm run test:modules`, `npm run test:form-model` verifican contratos
y compatibilidad de controles. `npm run test:one2many:integration` crea un proyecto y
un esquema PostgreSQL temporal, prueba el ciclo padre/hijos, rollback de hooks y
constraints, permisos/reglas, auditoría, límites, concurrencia, revisiones,
acciones/Kanban y elimina sus recursos al terminar. No usa cuentas ni registros
reales del ERP. Requiere la BD de desarrollo disponible.
