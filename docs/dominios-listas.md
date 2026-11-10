# Acciones de lista con dominio de servidor

Una acción de lista fija un subconjunto de registros sin modificar ListView ni sus
filtros visibles. Se declara en un archivo `server-only` mediante
`recordService.defineListAction`. El modelo, repositorio, columnas y permisos siguen
siendo los del servicio; no se aceptan del navegador.

```ts
// models/record.lists.ts
import "server-only";
import { recordService } from "./record.service";

export const recordLists = {
  all: recordService.defineListAction(),
  mine: recordService.defineListAction({
    domain: ({ actor }) => [
      { field: "createBy", operator: "eq", value: actor.id },
    ],
  }),
  active: recordService.defineListAction({
    domain: [{ field: "active", operator: "eq", value: true }],
  }),
};
```

El resultado es una función `(prisma, actor, state) => Promise<ListResult>`. Cada
Server Action elige una función fija y obtiene su actor de la sesión:

```ts
// actions/record.actions.ts, junto a las importaciones de tu módulo
"use server";

export async function listMyRecords(state: ListState): Promise<ListResult> {
  try {
    return await recordLists.mine(prisma, await requireAdmin(), state);
  } catch (error) {
    return { ok: false, error: error instanceof AccessError
      ? error.message : "No se pudieron listar los registros." };
  }
}
```

La vista recibe `load={listMyRecords}`. No se pasa un dominio ni el ID del usuario
en sus props. Otra ruta puede reutilizar el mismo componente con `listRecords` o
`listActiveRecords`; cada ruta se enlaza desde `menus` en el manifest. El manifest
contiene rutas y etiquetas, nunca funciones de dominio ni perfiles ORM.

## Ejemplos generados

Las aplicaciones nuevas incluyen tres rutas que reutilizan `views/RecordList.tsx`:

| Ruta | Acción del servidor | Dominio |
| --- | --- | --- |
| `/erp/mi-app` | `listRecords` | Todos los registros autorizados por el servicio. |
| `/erp/mi-app/mis-registros` | `listMyRecords` | `createBy` igual al actor autenticado. |
| `/erp/mi-app/activos` | `listActiveRecords` | `active` igual a `true`. |

Los dominios se editan en `models/record.lists.ts`; la vista elige la acción por una
prop de servidor (`view="all"`, `"mine"` o `"active"`). La acción remota recibe
solamente `ListState`. La creación permanece en ListView y no aparece en el Topnav.
Una aplicación existente puede añadir estos archivos y rutas manualmente: volver
a ejecutar `create:app` no sobrescribe módulos personalizados.

## Condiciones y valores

`domain` es un array de condiciones combinado mediante AND. Cada condición usa
`field`, `operator`, `value`; admite los campos escalares declarados del modelo y
los implícitos `id`, `createBy`, `createdAt`, `updatedAt`. No depende de las columnas
publicadas. Filtrar por `createBy` no requiere `audit: true` ni publica la auditoría.
El tipo comprueba los nombres de campo; el servidor valida también operadores y
valores. No se admiten rutas de relaciones, campos arbitrarios de User ni `where`
de Prisma sin validar.

| Tipo | Operadores | Valor |
| --- | --- | --- |
| Text | `eq`, `neq`, `in`, `notIn`, `contains`, `startsWith`, `endsWith` | String o array de strings. |
| Integer | `eq`, `neq`, `in`, `notIn`, `gt`, `gte`, `lt`, `lte` | Entero de 32 bits o array de enteros. |
| Boolean | `eq`, `neq` | Boolean nativo: `true` o `false`. |
| Selection | `eq`, `neq`, `in`, `notIn` | Valor declarado de la selección o array. |
| DateTime | `eq`, `neq`, `in`, `notIn`, `gt`, `gte`, `lt`, `lte` | ISO UTC con `Z`, o array de esos instantes. |
| Many2one, `id`, `createBy` | `eq`, `neq`, `in`, `notIn` | ID exacto o array de IDs. |

`eq`/`neq` aceptan `null` sólo en campos opcionales; los arrays no admiten null.
Las comparaciones de texto e IDs son sensibles a mayúsculas con PostgreSQL. En
búsquedas de texto, `%`, `_` y `\` se tratan como caracteres literales. Estas reglas
son propias del dominio; los filtros visibles conservan sus operadores existentes.

Para combinar condiciones se usan `all`, `any` y `not`, cada uno como nodo separado:

```ts
domain: ({ actor }) => [
  { field: "createBy", operator: "eq", value: actor.id },
  { any: [
    { field: "active", operator: "eq", value: true },
    { not: { field: "name", operator: "startsWith", value: "Archivo" } },
  ] },
],
```

Un dominio vacío o `all: []` permite todos; `any: []` no devuelve ninguno.
`in: []` no devuelve ninguno y `notIn: []` permite todos. `not` invierte esas
constantes. En los demás casos, comparaciones y negaciones conservan las reglas de
NULL de PostgreSQL/Prisma; usa una condición explícita para incluir nulos cuando
corresponda. Se permiten hasta 100 nodos, ocho niveles y 100 valores por array.

## Ejecución, errores y permisos

Los dominios estáticos se validan al definir la acción. Un callback se resuelve en
la transacción RepeatableRead **después** de revalidar cuenta activa, permisos y
`sessionVersion`. Recibe `{ actor, tx }` y puede ser asíncrono. Usa `tx` para lecturas
auxiliares de esa misma transacción; evita escrituras y efectos externos.

La consulta es `AND(dominio, filtros visibles, búsqueda)`. Conteo y filas usan el
mismo `where` y snapshot; la paginación se calcula después. Limpiar filtros no
retira el dominio. Un dominio inválido, callback fallido o parámetros manipulados
devuelven error: nunca se repite una consulta sin el dominio como fallback.

El dominio de una acción **no es una regla de acceso al registro**. El servicio del
scaffold continúa siendo admin para leer y escribir; no se amplía al declarar una
vista «Mis registros». `read`, `save`, `move` y el kanban existente conservan su
política. Para prohibir también la apertura/edición de registros ajenos se necesita
una política de servidor aplicada a todas esas operaciones. Los registros previos
con creador null no aparecen en «Mis registros».

El loader de una acción de lista también sirve para CardView, que usa el mismo
contrato. No se añade en esta fase un dominio al proveedor por columnas de Kanban.
No hay cambios de Prisma, migraciones ni regeneración de adaptadores para usar
esta funcionalidad.

Pruebas: `test:orm`, `test:scaffold` y `test:framework:integration`. La integración
usa un proyecto y un esquema PostgreSQL exclusivos con cuentas desechables.
