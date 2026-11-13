# Retirar aplicaciones: alcance actual

Desde el 2026-11-13, `/erp/modulos` y `npm run module:manage` comparten un flujo
de revisión y ejecución **sólo en desarrollo** para módulos declarativos y
aplicaciones del scaffold anterior. Conserva datos por defecto; la purga exige
confirmación expresa, SQL revisado y un respaldo restaurado antes del borrado.
Procedimiento, requisitos y recuperación en [Gestor de Módulos](gestor-modulos.md).
Las aplicaciones manuales requieren adaptador específico; la infraestructura
compartida está protegida. Producción conserva el catálogo de consulta.

## Operaciones distintas

| Objetivo | Procedimiento actual | Efecto sobre datos |
| --- | --- | --- |
| Quitar una opción de navegación | Editar `menus` del manifest y comprobar tipos/lint. | Conserva registros y tablas; la ruta sigue existiendo. |
| Ocultar Crear/Eliminar en una lista | Usar `create={false}` o `delete={false}`. | Conserva registros y tablas; no cambia permisos del servidor. |
| Excluir una aplicación del catálogo de ejecución | Filtrar su entrada en el registro principal, resolviendo primero dependencias. | Conserva fuentes, tablas, datos y propiedad instalada. |
| Eliminar registros | Usar ListView → seleccionar → Acciones → Eliminar, cuando el servidor lo autorice. | Elimina las filas seleccionadas; no desinstala la aplicación. |
| Retirar una aplicación conservando datos | Módulos → ficha → Desinstalar → Conservar datos → Revisar plan. | Conserva esquema/propiedad, tablas, registros, actividad y accesos; reserva el ID y archiva el código local. |
| Reactivar una aplicación retirada | Instalar desde su ficha, con el archivo local verificado disponible. | Recupera el código y la misma identidad sin SQL adicional. |
| Retirar también tablas y datos | Desinstalar → Eliminar datos, revisar alcance, confirmar ID y mantenimiento. | Respalda/restaura antes de aplicar una migración nueva y la limpieza auxiliar exacta. |

## Ocultar una aplicación del catálogo sin desinstalarla

Para una aplicación creada por el scaffold, el catálogo y su `registry.ts` están
gestionados. Si sólo quieres excluir temporalmente un módulo del registro de
ejecución, conserva esos archivos y filtra sus entradas en el archivo editable
`src/lib/applications/registry.ts`:

```ts
// Ejemplo: dentro del array que ya pasas a createApplicationRegistry.
...scaffoldApplications.filter(application => application.id !== "mi-app"),
```

Sustituye la expansión existente `...scaffoldApplications` por esa expresión,
manteniendo los imports y las otras aplicaciones. Para volver a incluirla,
restaura la expansión original. La validación del registro exige que ninguna
aplicación que permanezca registrada dependa de la que excluyas.

Si el módulo está importado manualmente en el registro principal, retira su entrada
y su import de ese archivo, revisando antes sus dependientes. No elimines todavía
sus fuentes, su modelo instalado ni las migraciones.

El cajón y el Topnav dejan de mostrarla y `ApplicationLayout` no encuentra su ID
para abrir las rutas del módulo. Esto **no revoca por sí solo las Server Actions**:
su política de acceso sigue siendo la que implementen. Si el objetivo es impedir
también sus operaciones, aplica la restricción correspondiente en servidor.

Después de editar el registro:

```bash
npx tsc --noEmit
npm run lint -- src/lib/applications/registry.ts
npm run test:applications
```

## Retirada completa con plan

Una desinstalación completa necesita un flujo que coordine:

1. Los módulos dependientes, las relaciones y las inversas que apuntan al modelo.
2. La decisión de conservar/exportar o retirar los datos y las tablas.
3. Las referencias desde rutas, menús, acciones, servicios y artefactos generados.
4. La regeneración coherente del catálogo gestionado y sus manifiestos de integridad.
5. El registro de propiedad y los esquemas instalados, junto con una migración
   explícita si corresponde cambiar la estructura física.

El gestor coordina ese flujo para las instalaciones cuya propiedad puede verificar.
Rechaza dependientes y casos incompatibles en lugar de forzar el borrado.
`orm:install --update` sigue siendo aditivo; la retirada usa el motor específico
de `module:manage`. No se fuerza una retirada borrando
hashes o entradas de `prisma/.orm-installations.json`, ni editando a mano el catálogo
de `src/lib/applications/scaffolded`.

Tampoco basta con borrar la carpeta de una aplicación: el catálogo mantiene imports
estáticos y el instalador conserva su propiedad e inversas. Las migraciones ya
aplicadas forman parte del historial y se conservan. `prisma migrate reset` reinicia
la base del entorno; no es un comando para quitar una sola aplicación.

Los archivos de trabajo y respaldos en `.module-operations` son privados y locales;
el registro `prisma/.app-retirements.json` sí se versiona junto con los esquemas.
Conservar el archivo local es necesario para la reactivación automática. Si ya
se prepararon cambios y ocurre un error, mantener el mantenimiento y revisar la
recuperación manual: no se promete rollback global ni retirada en caliente.

La exclusión reversible del catálogo sigue siendo sólo una retirada visual.
Editar el registro con expresiones dinámicas puede impedir que el gestor lo
inspeccione; resolver esa incompatibilidad antes de preparar operaciones.

Guías relacionadas: [Crear aplicaciones](crear-aplicaciones.md),
[Flujo del framework](flujo-framework.md), [Instalar modelos](instalar-modelos.md).

## Retirada específica de Flota, 2026-11-12

El usuario autorizó retirar la aplicación anterior y borrar sus datos locales para
comenzar otra tutoría. Se preparó un cambio específico; no se añadió un comando
genérico de desinstalación ni se amplió orm:sync para eliminar modelos.

- Copia local del código anterior en `.tutorial-backups`, excluida de Git y sin
  configuración privada. No es una copia de los registros eliminados.
- Propiedad e inversas verificadas con readInstallationState antes de retirar el
  esquema de Flota. Eliminados sólo sus segmentos gestionados de User y su entrada
  de propiedad, como parte de esta retirada completa; no para forzar una evolución.
- Catálogo/registro regenerados con scaffoldRegistryFiles y writeArtifacts,
  conservando las comprobaciones y el manifiesto calculado por el generador.
- Retirados fuentes y artefactos de aplicación (apps/bindings/uploads). El ejemplo
  histórico del generador en src/generated/orm/flota permanece y no está instalado.
- Migración `20261112173158_remove_flota_tutorial`: transacción explícita, cuatro
  tablas de Flota, su enum y actividad únicamente de sus cuatro nombres de modelo.
  Aplicada a la base local después de revisar que no había migraciones pendientes.
  Sin CASCADE ni reset; las migraciones anteriores se conservan. Esta migración
  elimina datos: su ejecución en otra base requiere revisar ese alcance allí.
- Prisma Client regenerado; conteos de todas las demás tablas de negocio y de la
  actividad ajena a Flota iguales antes/después. Archivos remotos no modificados.

Las pruebas de related tienen su propio fixture, instalado sólo en el proyecto y
esquema PostgreSQL desechables. El ID quedó libre en aquella retirada histórica,
pero después el usuario recreó la aplicación Flota y volvió a retirarla junto con
Citas el 2026-11-13 (apartado siguiente). Demo se conserva. El
[nuevo tutorial](tutorial-flota.md) usa ahora el ID disponible `flota`.

## Retirada de Citas odontológicas y Flota, 2026-11-13

El usuario autorizó retirar ambas aplicaciones (Demo se conserva). Cambio específico,
sin comando genérico, siguiendo el procedimiento de la retirada anterior:

- Copia local del código, esquemas y registro en `.tutorial-backups/retiro-citas-flota-2026-11-13`
  (excluida de Git). Datos revisados antes: las seis tablas estaban vacías; sólo había
  7 entradas de historial de Flota en `record_activities`.
- Flota: propiedad e inversa de User retiradas con `readInstallationState`/`removeInverse`
  y el registro reescrito desde ese estado; catálogo regenerado con
  `scaffoldRegistryFiles([])` y `writeArtifacts`. Artefactos `apps/bindings/uploads/flota`
  retirados; el ejemplo del generador `src/generated/orm/flota` se conserva.
- Citas: esquemas manuales y relación inversa en Partner retirados; la fuente
  `dentalAppointment` sale de la lista genérica (`src/lib/list`) y de las pruebas
  (`test:appointments*`, su caso en `manifest.test.ts`, su bloque en
  `framework-check.fixture` y su suite en `test:legacy:integration`).
  `prisma-connection.test.ts` se conserva con `npm run test:prisma-connection`.
- Migración `20261113190000_remove_citas_flota`: transacción explícita, borra el
  historial sólo de esos seis modelos, FKs, seis tablas y el enum de Citas; sin CASCADE.
  Esta migración elimina datos: en otra base, revisar su alcance antes de aplicarla.
- El ID `flota` quedó libre y se adoptó después para la nueva tutoría en `codex/flota`.
