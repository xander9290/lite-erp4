# Flota

Aplicación creada con create:app. Los TS/TSX del módulo son editables; los artefactos de src/generated son gestionados.

1. Declara campos y reglas en models/Record.ts.
2. Ajusta clientFields/dependencias en orm.config.ts y manifest.ts; compón tus Fields y columnas en views.
3. npm run orm:generate -- flota --write
4. Revisa npm run orm:install -- flota; añade --write para incorporar el esquema nuevo.
5. Revisa todos los archivos nuevos y modificados de prisma, después npm run db:migrate -- --name install_flota y npm run db:generate.
6. npm run orm:generate -- flota --write
7. npm run orm:bind -- flota --write

Para añadir campos después de instalar: orm:generate, orm:install con --update (revisar y después --write), migración, db:generate y orm:bind. Sólo se permiten adiciones; no se retiran ni cambian campos existentes automáticamente.

La ListView y FormView ya llaman al servicio; hasta completar el enlace muestran un error explícito sin simular guardados. El servidor vuelve a validar permisos admin, datos y revisión dentro de la transacción. FormView conserva isDirty, Revertir y aviso de cambios pendientes. El manifest no cambia por sí solo la política del servicio.

Reglas: beforeSave(values, context) normaliza/valida y afterSave(record, context) corre en la misma transacción. Usa ModelValidationError para rechazos de negocio. No envíes efectos externos desde estos hooks; no son afterCommit.

Guía desde la raíz del proyecto: docs/flujo-framework.md.
