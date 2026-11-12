# Retirar aplicaciones: alcance actual

El proyecto todavía **no tiene un comando para desinstalar aplicaciones**.
Los scripts disponibles crean cascarones, generan contratos, incorporan/evolucionan
modelos y enlazan repositorios. No existen `remove:app`, `delete:app`,
`orm:uninstall`, ni una opción `--remove` en los comandos actuales.

## Operaciones distintas

| Objetivo | Procedimiento actual | Efecto sobre datos |
| --- | --- | --- |
| Quitar una opción de navegación | Editar `menus` del manifest y comprobar tipos/lint. | Conserva registros y tablas; la ruta sigue existiendo. |
| Ocultar Crear/Eliminar en una lista | Usar `create={false}` o `delete={false}`. | Conserva registros y tablas; no cambia permisos del servidor. |
| Excluir una aplicación del catálogo de ejecución | Filtrar su entrada en el registro principal, resolviendo primero dependencias. | Conserva fuentes, tablas, datos y propiedad instalada. |
| Eliminar registros | Usar ListView → seleccionar → Acciones → Eliminar, cuando el servidor lo autorice. | Elimina las filas seleccionadas; no desinstala la aplicación. |
| Retirar fuentes, registro gestionado, modelos y tablas | No hay flujo automatizado implementado. | Requiere una retirada específica y una migración revisada para cambios físicos. |

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

## Retirada completa: todavía sin comando

Una desinstalación completa necesita un flujo que coordine:

1. Los módulos dependientes, las relaciones y las inversas que apuntan al modelo.
2. La decisión de conservar/exportar o retirar los datos y las tablas.
3. Las referencias desde rutas, menús, acciones, servicios y artefactos generados.
4. La regeneración coherente del catálogo gestionado y sus manifiestos de integridad.
5. El registro de propiedad y los esquemas instalados, junto con una migración
   explícita si corresponde cambiar la estructura física.

Ese flujo no está implementado. `orm:install --update` permite adiciones, no sirve
para desinstalar ni para retirar campos/modelos. No se fuerza una retirada borrando
hashes o entradas de `prisma/.orm-installations.json`, ni editando a mano el catálogo
de `src/lib/applications/scaffolded`.

Tampoco basta con borrar la carpeta de una aplicación: el catálogo mantiene imports
estáticos y el instalador conserva su propiedad e inversas. Las migraciones ya
aplicadas forman parte del historial y se conservan. `prisma migrate reset` reinicia
la base del entorno; no es un comando para quitar una sola aplicación.

Hasta disponer de un desinstalador, la exclusión reversible del catálogo cubre la
retirada visual. La retirada completa debe prepararse como un cambio específico,
revisando código, dependencias y persistencia juntos.

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
esquema PostgreSQL desechables. El identificador de aplicación flota queda libre;
el [nuevo tutorial](tutorial-flota.md) empieza por un dry-run, sin recreación automática.
