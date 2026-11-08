# Autor implícito de los registros: createBy

Los modelos declarados con `Model` incorporan `createBy` al generar su esquema,
junto con ID, `createdAt` y `updatedAt`. No se añade a la clase ni a `clientFields`.

```prisma
createBy     String? @map("create_by")
createByUser User?   @relation("MiModelo_createBy", fields: [createBy], references: [id], onDelete: Restrict)
```

`createBy` contiene el **ID de User** que creó el registro, no el de Partner.
`createByUser` es la relación Prisma con esa cuenta. El generador añade un índice
en `createBy` y la inversa `<modelo>CreatedRecords` a User, mediante los segmentos
gestionados del instalador.

User es infraestructura del framework: la auditoría no añade una dependencia de
negocio a Usuarios en cada manifest, evitando ciclos. Las relaciones declaradas
por la aplicación siguen necesitando sus dependencias habituales. El generador
comprueba que exista User con clave `id String` compatible.

## Asignación y protección

El servicio revalida la cuenta activa, permisos y versión de sesión dentro de su
transacción. Al crear pasa `actor.id` al repositorio generado; éste escribe
`createBy` de forma explícita. La edición y los movimientos kanban conservan el
autor original, aunque los realice otra cuenta.

El valor no tiene un default SQL: la base no conoce la sesión de la aplicación.
No se admite como dato editable en Zod, defaults, `clientFields` ni payloads de
formulario. `createBy` y `createByUser` son nombres reservados para la declaración
y generación. Los DTO estándar conservan sus campos anteriores: el autor no se
publica automáticamente al navegador. Puede habilitarse explícitamente como
metadato de lectura, separado de `values`, usando `audit: true` en el servicio.

Un repositorio personalizado debe respetar el argumento `actorId` de su método
`create(tx, values, actorId)`. Las escrituras directas con Prisma/SQL son código de
servidor de confianza y deben gestionar su auditoría explícitamente. No se añade
un trigger para impedir cambios hechos directamente por el administrador de BD.

## Registros anteriores y borrado

La columna es nullable para conservar los registros creados antes de esta función.
Esos registros quedan con `createBy = null`: no se inventa un creador ni se asigna
al usuario que los edite posteriormente. Las altas realizadas por el servicio
generado sí guardan siempre el usuario autenticado.

La clave foránea usa `Restrict`: una cuenta que figura como creadora no puede
borrarse físicamente mientras tenga registros asociados. Puede desactivarse con
la política normal de Usuarios; la identidad histórica permanece.

## Consultar la auditoría desde un servicio

Prisma Client incluye los tipos y la relación. Seleccionar únicamente los datos
que corresponda publicar, después de verificar permisos en el servidor:

```ts
await tx.flotaRecord.findUnique({
  where: { id },
  select: {
    id: true,
    createBy: true,
    createByUser: { select: { id: true, login: true } },
  },
});
```

No incluir la cuenta completa: User contiene credenciales y datos de acceso.
## Mostrarlo en FormView y ListView

El adaptador generado incluye una lectura de auditoría con `select` limitado:
fechas y usuario con ID, login, nombre del contacto/avatar. No devuelve contraseña,
permisos, versión de sesión, teléfono ni correo. Para habilitar su publicación:

```ts
const service = createModelService(recordModel, Repository, {
  columns: recordColumns,
  searchFields: recordSearchFields,
  audit: true,
});
```

Después de actualizar el framework, regenerar el adaptador con
`npm run orm:bind -- mi-app --write`. No hace falta otra migración si `createBy`
ya está instalado. El repositorio personalizado puede implementar `audit(tx, id)`;
si se solicita auditoría sin ese método, el servicio rechaza la operación.

Las acciones `read`/`save` responden `{ ok: true, values, audit }`. `values` sigue
siendo exclusivamente el contrato del formulario. `audit` usa `RecordAudit` de
`@/lib/orm/audit`: fechas ISO y `createBy: { id, login, name, avatarUrl } | null`.
La lectura de ambos ocurre en la misma transacción autorizada. No mezclar `audit`
en `defaultValues`, Zod o el payload de guardado.

`FormViewLoader` entrega la auditoría como segundo argumento:

```tsx
<FormViewLoader recordKey={id} load={load}>
  {(record, audit) => <Editor record={record} initialAudit={audit} />}
</FormViewLoader>
```

En Editor, mantenerla en estado React independiente y actualizarla con
`onSaved={(_values, audit) => setAudit(audit)}` de FormView. Para presentar el autor:

```tsx
<FieldMany2One
  mode="display"
  label="Creado por"
  direction="inline"
  value={audit?.createBy ? {
    id: audit.createBy.id,
    label: `[${audit.createBy.login}] ${audit.createBy.name}`,
    avatarUrl: audit.createBy.avatarUrl,
  } : null}
/>
```

Este modo no usa RHF, inputs ocultos, búsqueda ni modal; también funciona fuera de
FormLayout. Las fechas pueden presentarse con `<time>` y el formato del navegador.
El `readOnly` habitual de un FieldMany2One editable sigue perteneciendo a RHF;
para auditoría usar `mode="display"`.

Para el listado, importar `recordAuditColumns` de `@/lib/orm/audit` y añadir todas
o algunas a las columnas que comparten la vista y el servicio:

```ts
export const recordColumns = [
  { field: "name", label: "Nombre", sortable: true },
  ...recordAuditColumns,
];
```

Incluye «Creado por» (login/avatar), «Creado el» y «Actualizado el», con tipos
explícitos para los filtros de la UI. El servicio permite filtros y orden en
`createdAt`, `updatedAt`, `createBy`, `createByUser.login` y
`createByUser.partner.name`; búsquedas textuales por las dos últimas si se
incluyen en `searchFields`. En ausencia de contacto usar login como columna.
Las fechas son ISO UTC y los filtros de día conservan el rango convertido por
la UI. Los filtros «Está vacío» incluyen autores/contactos desconocidos.
Sólo las columnas de nombre/login admiten widget `partner`, con avatar limitado
a `createByUser.partner.avatarUrl`. Sin `audit: true` se rechazan estos campos
y no se envían metadatos adicionales.

Ejemplo local, RHF/Zod, guardado simulado y listado: `/sample#record-audit`.
Los modelos manuales necesitan su propio proveedor autorizado de auditoría.

## Actualizar un módulo ya instalado

La actualización es aditiva y mantiene las protecciones de propiedad y hashes:

```sh
npm run orm:generate -- mi-app --write
npm run orm:install -- mi-app --update
npm run orm:install -- mi-app --update --write
npm run db:migrate -- --name add_create_by --create-only
# Revisar el SQL y aplicar en desarrollo.
npm run db:migrate
npm run db:generate
npm run orm:generate -- mi-app --write
npm run orm:bind -- mi-app --write
```

Reiniciar dev después de generar Prisma Client para renovar su instancia cacheada.
En producción, versionar esquema/registro/migración/adaptador y aplicar las
migraciones con `db:deploy` durante el despliegue.

Los modelos manuales previos del ERP no se modifican automáticamente para añadirles
autor; esta incorporación pertenece a la capa declarativa. User recibe únicamente
las inversas necesarias para los modelos generados.

## Verificación

`test:orm` verifica campos implícitos, relación, reservas y exclusión del contrato
cliente. `test:orm:install` y `test:scaffold` comprueban instalación/regeneración.
`test:framework:integration` usa PostgreSQL aislado para verificar creación con
actor autenticado, rechazo de suplantación, conservación del autor al editar desde
otra cuenta, registros antiguos con autor desconocido y claves foráneas.
