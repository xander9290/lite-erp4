# Nombres de presentación de modelos

Los modelos declarativos definen una presentación canónica en el servidor:
`displayName` personalizado → `name` Text no sensible y no vacío → ID.
Un método vacío también usa esa cadena de fallback; uno que devuelve otro tipo
se rechaza como error del modelo. No se almacena otra columna.

## Modelos nuevos del scaffold

create:app y create:model generan un método explícito, tipado y editable:

```ts
displayName(record: DisplayRecord<FlotaFabricante, "name">): string {
  return record.name;
}
```

Se importa DisplayRecord como tipo desde @/lib/orm. Con name Text se infiere la
dependencia por defecto; al personalizarlo para otros campos declarar displayFields
o decorar el mismo método con @displayName y ajustar su tipo. No crear un segundo
formateador en React. Las clases existentes no se sobrescriben para añadir el stub.

## Convención en colecciones y relaciones

lookup publica el nombre como `item.label`; read/save, como `displayName` junto a
values. list, acciones con dominio y kanban lo publican por registro en `$displayName`.
Es metadata de lectura: no añadirla a list.fields, clientFields, RHF, payloads ni SQL.
Las operaciones de búsqueda/filtro/orden/agrupación siguen las políticas y campos
persistentes publicados; el texto calculado no se convierte en una capacidad SQL.

El servicio calcula nombres para la página/rama autorizada antes de proyectar el DTO.
Dependencias locales reutilizan los registros ya leídos. Las rutas usan lookup del
repositorio en lotes de hasta 100 IDs del registro principal, en la misma transacción;
no se hace una consulta por fila ni se publican los objetos usados para formatear.
Los encabezados de grupo no resuelven nombres de registros que aún no se cargaron.
El fallback name puede cargarse implícitamente si es Text público, pero los métodos
de clase siguen recibiendo sólo sus dependencias declaradas.

- ListView usa la metadata en las columnas de identidad name/id de texto y en
  sus controles accesibles. `displayName: false` conserva el valor/etiqueta original;
  `displayName: true` permite usar el nombre del registro en otra columna textual.
  No sustituye imágenes, números, fechas o selecciones por defecto. renderCell
  sigue teniendo prioridad. Los IDs y revisiones permanecen intactos.
- CardView/KanbanView usan el nombre del servidor como título cuando se omite
  titleField. Un titleField explícito o renderCard conserva su presentación propia.
- Los formularios nuevos del scaffold reciben la metadata; los formularios
  existentes de Flota fueron adaptados sin regenerarse. Los proveedores/vistas
  manuales conservan sus DTOs y overrides; para adoptar un método de clase deben
  publicar/consumir la metadata desde su servidor autorizado, no inferir clases
  ni políticas a partir de una cadena enviada por el cliente.

Demo ficticia de servidor en /sample#image-collections: «Ficha · …» aparece en
las tres colecciones sin modificar sus IDs ni sus imágenes. No usa la base del ERP.

## Encabezados de formularios

Desde 2026-11-12, createModelService.read/save también devuelve `displayName` como
metadato junto a `values` y `audit`, sin incorporarlo al contrato editable, defaults,
RHF ni auditoría de cambios. Se calcula desde el registro persistido dentro de la
transacción autorizada: RepeatableRead al abrir y Serializable al guardar,
después de hooks y lectura final. Si falla la proyección/formato durante el guardado,
se rechaza la transacción; no se presenta como guardado confirmado.

Las dependencias escalares salen de la lectura existente. Las rutas Many2one usan
una proyección por ID mediante el lookup del repositorio generado, en la misma
transacción y con sus guardas de publicación/privacidad; no invocan otra acción
ni hacen consultas desde React. Si se añaden rutas, ejecutar orm:generate y orm:bind;
esto no crea columnas ni requiere migración SQL. Adaptadores sin las rutas necesarias
fallan cerrados hasta regenerarse.

FormViewLoader entrega `(values, audit, displayName)` a su render prop y FormView
entrega los mismos tres argumentos en `onSaved`. Los callbacks anteriores de uno
o dos argumentos siguen siendo compatibles. El scaffold enlaza el nombre al
breadcrumb y lo actualiza después de guardar; un borrador local no cambia el nombre
persistido. Las vistas personalizadas existentes requieren conectar esos argumentos;
no se regeneran automáticamente.

```tsx
<FormViewLoader recordKey={id} load={load}>
  {(record, _audit, displayName) => (
    <Editor record={record} displayName={displayName} />
  )}
</FormViewLoader>
```

En Vehicle, `name` conserva el ID de Modelo y
`@displayName("nameRecord.fabricante.name", "nameRecord.name")` produce
«Fabricante · Modelo» (el alias `fabricante` corresponde a `fabricanteId`). El breadcrumb usa el texto del servidor, sin convertir ese ID en
Text ni añadir otra columna persistente.

```ts
class Vehicle extends Model {
  name = Fields.Text({ required: true });
  plate = Fields.Text({ required: true });

  displayFields = ["name", "plate"] as const;

  displayName(record: Readonly<Record<string, unknown>>) {
    return `${record.name} · ${record.plate}`;
  }
}
```

`displayFields` enumera las dependencias (máximo doce, sin duplicados);
`id` se incluye siempre. Admite escalares y rutas Many2one con hasta tres saltos,
sin campos sensibles. Cada ruta termina en un escalar o ID.
El método es síncrono, heredable y devuelve texto: no recibe actor, transacción ni
acceso a consultas. Sólo recibe los campos declarados, fuera de los valores Zod,
defaults y RHF. Estos métodos no se serializan al cliente ni se publican remotamente.

## Concatenar datos relacionados

```ts
class Vehicle extends Model {
  name = Fields.Text({ required: true });
  fabricanteId = Fields.Many2one("Fabricante");
  displayFields = ["name", "fabricante.name"] as const;

  displayName(record: Readonly<{
    name: string;
    fabricante: Readonly<{ name: string }> | null;
  }>) {
    return [record.fabricante?.name, record.name].filter(Boolean).join(" · ");
  }
}
```

`fabricanteId` conserva el ID editable. `fabricante` es el alias Prisma: se quita
el sufijo `Id`; si el Field no termina en `Id`, su alias añade `Record`.
No se declara `fabricanteId.name`. La forma del parámetro debe corresponder a las
dependencias y nulabilidad declaradas; TypeScript no infiere automáticamente ese
objeto a partir de las cadenas de `displayFields`.

El generador verifica las rutas contra los modelos del **mismo perfil**. Todos los
IDs de relación atravesados y escalares finales deben estar publicados mediante
`clientFields` y no ser sensibles. El destino también debe estar registrado en ese
perfil; los modelos manuales/core, perfiles externos y colecciones inversas requieren
un proveedor propio. Esto conserva la política admin del servicio inicial y no
implementa reglas de acceso particulares por modelo relacionado.

El adaptador carga la proyección anidada para la página o lote de IDs con una sola
llamada `findMany`, sin consultas por registro en `displayName`. Prisma puede ejecutar
varias consultas SQL para resolver esa proyección. El método recibe copias congeladas
de los campos declarados; las relaciones vacías son `null` y DateTime se presenta
como ISO UTC. Ningún objeto relacionado completo se publica al cliente.

## Conectar un Many2one

El servicio del modelo relacionado expone `lookup`. Una Server Action fija el
servicio y obtiene la sesión; el servicio revalida cuenta activa, administrador y
versión de sesión dentro de RepeatableRead. Ejemplo:

```ts
"use server";

export async function lookupVehicles(request: ModelLookupRequest): Promise<Many2OneResult> {
  try { return await vehicleService.lookup(prisma, await requireAdmin(), request); }
  catch { return { ok: false, error: "No se pudieron consultar los vehículos." }; }
}
```

Los tipos se importan de `@/lib/many2one/model-lookup` y
`@/lib/many2one/types`; importar el servicio, Prisma y requireAdmin del proyecto.
El scaffold nuevo incluye `lookupRecords` autorizado.

```tsx
<FieldMany2One name="vehicleId" label="Vehículo" load={lookupVehicles} />
```

Con `load` no se declaran `model`, `displayName` ni `searchFields` en el Field.
Sugerencias, modal y resolución del ID guardado usan el mismo proveedor. El resultado
publica ID/label y `record: {id}`; no devuelve los campos usados para construir la
etiqueta ni columnas auxiliares. La selección conserva sólo el ID en RHF.

La búsqueda usa exclusivamente Text no sensibles de `searchFields` del servicio;
cada palabra debe coincidir en alguno. No busca sobre la etiqueta calculada ni por
rutas de auditoría. Hay paginación (1–25), orden estable por ID y resolución por ID
o lote de hasta cien IDs únicos. No acepta modelo, actor, select, plantilla, dominio
ni campos desde el navegador. Los dominios de otras acciones de lista no se heredan;
este servicio conserva acceso admin. Un dominio no autoriza relaciones al guardar:
las reglas de negocio específicas deben seguir validando las referencias.

Adaptadores existentes requieren `orm:bind -- <id> --write` para incorporar lookup,
una vez sincronizados sus modelos, esquema y cliente. No editar bindings ni hashes
manualmente. Cambiar sólo el método o dependencias escalares no requiere migración
ni otro bind si lookup ya existe. Agregar rutas relacionadas sí requiere regenerar
el adaptador con `orm:bind -- <id> --write` o el flujo `orm:sync -- <id>`; un adaptador
anterior falla cerrado. Declarar estas rutas no cambia el esquema SQL; agregar un
Field Many2one nuevo sí puede requerir la migración normal. Los adaptadores verifican
las dependencias contra los metadatos publicados generados; mantener contratos y
bindings sincronizados al modificar publicación, sensibilidad o destinos.
Proveedores propios pueden implementar el método opcional del repositorio.

## Compatibilidad y ejemplo

Los catálogos manuales `user`/`partner` conservan sus contratos y plantillas
anteriores, sin ampliar su whitelist. Sus vistas existentes siguen funcionando.
`mode="display"` conserva su valor ya resuelto. FieldRelationTag no incorpora
todavía el proveedor declarativo.

Ejemplo RHF/Zod en `/sample#model-display-name`, con vehículos/fabricante ficticios,
búsqueda, modal, resolución inicial y relación vacía. No persiste ni consulta registros
del ERP. Flota sigue en tutoría: esta mejora no edita sus declaraciones ni genera
sus artefactos por adelantado.

## Simplificaciones implementadas

`normalize(values)`, `context.previous` tipado en los hooks y `createQueryActions`
ya están disponibles. Contratos, ejemplos y límites en
[Ciclo de modelos y consultas compartidas](ciclo-modelos.md).


El contrato enlazado y las nuevas APIs de presentación se documentan en
[Contratos de vistas](contratos-vistas.md).
