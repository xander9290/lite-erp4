# Sincronizar una aplicación con un comando

Desde una terminal interactiva en la raíz del proyecto:

```bash
npm run orm:sync -- flota
```

Sustituye flota por el ID de tu aplicación. Antes, declara los modelos, publica sus
campos en orm.config.ts y registra los modelos en el manifest. El comando sirve
tanto para la primera instalación como para cambios aditivos posteriores y ampliaciones
de VARCHAR que conservan el resto de atributos del campo; no crea
vistas ni acciones nuevas en aplicaciones existentes.

## Qué hace

1. Genera contratos y valida la propuesta Prisma.
   También genera uploaders/acciones en src/generated/orm/uploads, con hashes y
   publicación explícita, sin reescribir vistas personalizadas.
2. Incorpora el esquema y su propiedad, detectando instalación o actualización.
3. Lee el historial y muestra el SQL completo de las migraciones pendientes del
   proyecto, incluidas las de otras aplicaciones. Indica la base y el schema.
4. Pide escribir `aplicar` antes de ejecutar ese SQL. Si hace falta otra migración,
   la prepara con migrate dev --create-only y vuelve a mostrarla para aprobación.
5. Comprueba que la base y el esquema coincidan.
6. Genera Prisma Client, sincroniza contratos y genera/compila los adaptadores.
7. Comprueba TypeScript y recuerda reiniciar dev si estaba abierto.

Ejemplo con nombre de migración opcional:

```bash
npm run orm:sync -- flota --name add_fabricante_flota
```

Sin --name usa sync_flota; Prisma añade su fecha al directorio. Si no hay cambios
físicos, no crea una migración vacía ni solicita aprobación SQL innecesaria.
Las herramientas anteriores siguen disponibles para estudiar o ejecutar cada paso.
Ya no necesitas repetir manualmente toda su secuencia para un cambio habitual.

## Revisar sin escribir

```bash
npm run orm:sync -- flota --plan
```

Este modo sólo revisa fuentes y muestra su propuesta. No consulta la base, no
escribe artefactos, no verifica drift ni compila bindings contra un cliente nuevo.
No equivale a una sincronización completa. Puede ejecutarse sin terminal interactiva.

## Errores, cancelación y continuación

La terminal muestra el paso activo. Un fallo detiene el flujo con salida distinta
de cero, sin ejecutar los pasos siguientes. Corrige el problema y repite el mismo
comando. Si cancelas una aprobación, conserva los archivos preparados para revisión;
esa aprobación no se interpreta como concedida al volver a ejecutar.

La operación completa no es una transacción ni revierte pasos ya completados.
Por ejemplo, un error de TypeScript posterior no deshace una migración aplicada.
Se vuelve a calcular el estado al repetir; no se borra el historial para continuar.
La CLI no tiene --yes ni acepta aprobaciones por pipe: el SQL exige una terminal
interactiva. La confirmación se limita a las migraciones mostradas; si cambian
durante la revisión, el comando se detiene.

Sólo para desarrollo y la configuración del proyecto en prisma7.config.ts. Antes
de aprobar comprueba el destino mostrado. Usa migrate deploy/build en producción.
No ejecuta reset, push, seed ni acepta pérdidas automáticamente. Un drift que
requiera reset, una migración fallida, un historial ausente/modificado o SQL con
retiradas/borrados detectados exige revisión manual. La comprobación SQL de este
flujo es conservadora, no un analizador de SQL ni una garantía sobre scripts custom.

El bloqueo identifica el nombre y muestra el SQL de la migración que requiere
revisión; no implica que el cambio recién declarado sea destructivo. Al cambiar
de máquina puede haber migraciones históricas de retirada aún pendientes. Revisar
la cadena completa y el estado real de la tabla antes de aplicar ese historial
por el flujo manual (`npm run db:deploy`); después repetir orm:sync. No usar deploy
como bypass general ni marcar migraciones como aplicadas sin comprobar el esquema.

Prisma puede aplicar migraciones anteriores incluso con --create-only; por eso
orm:sync revisa y aplica las pendientes primero mediante deploy, sólo con aprobación.
La preparación cierra stdin del subproceso para que no pueda aceptar un reset.
La detección de cambios nuevos usa el flujo Prisma de desarrollo y su shadow DB.
La cuenta de desarrollo necesita los permisos habituales para ese flujo.

Hay un lock de sincronización en prisma/.orm-sync.lock, además de las protecciones
de cada herramienta. No ejecutes otros cambios de esquema/migración en paralelo.
Si una interrupción forzada deja el lock, comprueba que el proceso haya terminado
antes de retirar únicamente ese archivo. No borrar hashes, migraciones o locks
de otro proceso para forzar una sincronización.

Las vistas, permisos específicos, reglas de negocio y relaciones se siguen
desarrollando explícitamente. Cambiar sólo TSX, menús o dominios no obliga a migrar.
