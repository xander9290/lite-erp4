# Flujo base de desarrollo del ERP

El flujo inicial ya permite crear una aplicación, declarar su modelo en TS,
incorporar el esquema, migrar y generar un acceso tipado para listar, crear y editar.
La lógica propia y las vistas siguen siendo archivos editables. Prisma continúa
ejecutando consultas y migraciones; las herramientas generan sus definiciones.

Flota está reservada para la tutoría del usuario. Los ejemplos siguientes describen
el procedimiento; las pruebas del framework usan otra aplicación temporal.

## Primera instalación

```sh
npm run create:app -- "Mi aplicación"
```

Antes de instalar, editar dentro de `src/app/(auth)/erp/mi-aplicacion`:

1. `models/Record.ts`: campos y reglas de servidor.
2. `orm.config.ts`: modelos, campos publicados y dependencias de datos.
3. `manifest.ts`: nombre, icono y dependencias de la aplicación.
4. `views/RecordForm.tsx`: composición explícita con nuestros Fields.
5. `views/record.list.ts`: columnas y campos de búsqueda de la lista.

El modelo inicial contiene `name` y `active`. La lista, formulario, rutas, acciones
y servicio están conectados desde el cascarón. Antes del enlace de datos devuelven
un error explícito; no simulan un guardado ni descartan el borrador.

```sh
# Preparar contrato cliente y propuesta.
npm run orm:generate -- mi-aplicacion --write

# Revisar el SQL y los archivos que se incorporarán.
npm run orm:install -- mi-aplicacion
npm run orm:install -- mi-aplicacion --write

# Revisar también los archivos nuevos, que git diff todavía no muestra.
git status --short prisma
git diff -- prisma

# En la base de desarrollo elegida: crear/aplicar migración y generar cliente.
npm run db:migrate -- --name install_mi_aplicacion
npm run db:generate

# Actualizar artefactos de revisión y generar el adaptador tipado.
npm run orm:generate -- mi-aplicacion --write
npm run orm:bind -- mi-aplicacion
npm run orm:bind -- mi-aplicacion --write
```

`orm:bind` compila llamadas explícitas al modelo de Prisma antes de escribir el
adaptador. Un cliente Prisma desactualizado provoca un rechazo; no se sustituye el
tipado por un acceso arbitrario a `prisma[modelo]` recibido del navegador.

En producción se versionan las migraciones y se aplican con `db:deploy`, seguido
del build habitual. No ejecutar `migrate dev` en producción.

## Añadir un campo después de instalar

Editar la clase, `clientFields` y las vistas, después:

```sh
npm run orm:generate -- mi-aplicacion --write
npm run orm:install -- mi-aplicacion --update
npm run orm:install -- mi-aplicacion --update --write
# Revisar el esquema y crear/aplicar su migración de desarrollo.
npm run db:migrate -- --name add_notes_mi_aplicacion
npm run db:generate
npm run orm:generate -- mi-aplicacion --write
npm run orm:bind -- mi-aplicacion --write
```

La política inicial es **aditiva**: permite modelos nuevos, campos opcionales,
campos obligatorios con default SQL literal y nuevos valores de selección. Conserva
los campos, índices, mapeos y valores anteriores. Rechaza retirarlos, renombrarlos,
cambiar sus tipos o añadir columnas obligatorias sin un default para los datos
existentes. Los índices/defaults nuevos también deben revisarse: esta política no
garantiza que cualquier migración pueda aplicarse a cualquier conjunto de datos.

Los cambios de validación exclusivamente Zod no alteran el almacenamiento; pueden
necesitar revisar datos existentes por separado. No borrar registros de propiedad
ni modificar hashes para forzar una actualización.

## Dónde vive cada responsabilidad

| Archivo/capa | Responsabilidad |
| --- | --- |
| `models/Record.ts` | Declaraciones y reglas de negocio del modelo |
| `models/record.service.ts` | Servicio y política de lista del módulo |
| `actions/record.actions.ts` | Sesión de servidor, entrada desde UI e invalidación tras éxito |
| `src/lib/orm/service.ts` | Validación, permisos admin en transacción, concurrencia y resultados para UI |
| `src/generated/orm/apps/<id>` | Zod, tipos, defaults y propuestas gestionadas |
| `src/generated/orm/bindings/<id>` | Adaptador tipado gestionado para Prisma |
| `views` | Composición libre de componentes TSX y eventos del cliente |

Los tipos del contrato de campos siguen disponibles como `<Modelo>Input` y
`<Modelo>Values`. El formulario usa `<Modelo>RecordInput/RecordValues`, que añaden
`id` y `revision` opcionales para creación y obligatorios como pareja para edición.
La revisión es el `updatedAt` del servidor en ISO UTC con milisegundos.

## Reglas de negocio en la clase

La clase puede implementar estos hooks opcionales:

```ts
beforeSave(values: Record<string, unknown>, context: ModelContext) {
  if (values.name === "Bloqueado") {
    throw new ModelValidationError("Ese nombre no está permitido.", {
      name: "Elige otro nombre.",
    });
  }
  return values;
}

async afterSave(record: Record<string, unknown>, context: ModelContext) {
  // Escribir datos relacionados mediante context.tx, si corresponde.
}
```

Importar `ModelContext` y `ModelValidationError` desde `@/lib/orm`. Los contratos
de campos y tipos derivados siguen disponibles para definir tipos más concretos;
también se pueden declarar interfaces propias.

`beforeSave` corre después de validar datos y comprobar la revisión; su resultado
vuelve a validarse con Zod antes de escribir. `afterSave` corre dentro de la misma
transacción. Ambos reciben `context.tx`, `actor`, `operation` y el ID al editar.
Si fallan, la escritura se revierte. No equivalen a un evento después del commit:
no enviar correos, cobros o peticiones externas desde ellos. Los efectos externos
y una cola/outbox tendrán un contrato propio cuando se necesiten.

Los otros métodos de la clase no se publican automáticamente ni se convierten en
acciones remotas. Los eventos de cliente siguen usando callbacks, `useWatch` y
hooks de React; las reglas que protegen datos deben verificarse en el servidor.

## Permisos y concurrencia

El servicio inicial es **admin para lectura y escritura**. La acción toma la sesión
del servidor; el servicio vuelve a consultar `active`, `isAdmin` y `sessionVersion`
dentro de la transacción. Cambiar `manifest.access` no cambia esta política.
Un permiso por registro, empresa o campo requiere un servicio/política específico.

Las actualizaciones comparan ID y revisión, avanzan `updatedAt` al menos un
milisegundo y usan una transacción Serializable. Un guardado desactualizado o un
conflicto de serialización devuelve validación para recargar. No se reintenta
automáticamente una operación de negocio ni se limpia el borrador cuando falla.

Las claves foráneas y la unicidad se verifican en la base; sus rechazos se traducen
en errores de validación. Esto no sustituye permisos específicos sobre relaciones
cuando una aplicación tenga requisitos adicionales.

## Listas y contratos publicados

ListView admite `load={listRecords}` de una acción propia, junto con el identificador
del modelo y columnas. El navegador envía estado de paginación/filtros/orden; el
servicio fija el repositorio y sus columnas permitidas. La acción no recibe un
modelo arbitrario ni una selección de datos privados.

El servicio comparte filtros por tipo y paginación limitada a 50 filas. Admite
texto, enteros, booleanos y datetime; para selecciones se usan igualdad/desigualdad
o vacío. No aplica operadores de búsqueda de texto sobre enums de Prisma. Las
relaciones se presentan inicialmente como IDs escalares; para nombres, avatares
o búsquedas relacionadas se puede construir un proveedor específico.

El repositorio generado inicial requiere que `clientFields` incluya todos los
campos declarados de ese modelo. Para datos privados, publicaciones parciales o
escrituras anidadas se necesita un servicio y adaptador propios. No ampliar la
publicación sólo para evitar este rechazo.

## Vistas adicionales

CardView y KanbanView ya forman parte de la UI. Reutilizan servicios y contratos
autorizados, con búsqueda, filtros y estado URL. Kanban añade una selección de
estado y movimientos con revisión, permisos y hooks; guía en
[vistas de colecciones](vistas-colecciones.md).

## Comprobaciones realizadas

```sh
npm run test:orm
npm run test:orm:install
npm run test:scaffold
node --test src/lib/list/query.test.mjs
npm run test:framework:integration
```

La integración crea un proyecto temporal y un esquema PostgreSQL exclusivo,
despliega migraciones versionadas, guarda un registro, amplía su clase, vuelve a
migrar y comprueba que los datos anteriores sobrevivan. Cubre compilación del
adaptador/TSX, datos inválidos, sesión revocada, usuario sin permisos, relaciones,
duplicados, concurrencia, filtros, hooks y rollback. Se elimina al terminar. No
usa el usuario admin real ni instala Flota.

Con `-- --serve` mantiene el proyecto en `http://127.0.0.1:3031` para revisión
visual, con nombres exclusivos de cookies para no compartir la sesión del ERP.
Se detiene con Ctrl+C desde una terminal normal o creando `.stop` en su directorio
temporal. Una terminación forzada del proceso puede impedir el cleanup: revisar
el proyecto y su esquema de prueba antes de borrar cualquier recurso.

Este alcance es suficiente para comenzar la tutoría de una aplicación sencilla.
No promete todavía relaciones declarativas m2m/o2m, renderizado automático, catálogo
de instalación desde frontend, permisos granulares ni migraciones destructivas.
