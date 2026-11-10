# Lite ERP 4

ERP modular con Next.js, React, TypeScript, Prisma ORM 7 y PostgreSQL.
Las aplicaciones se componen con modelos declarativos y vistas TSX editables.

## Comandos del scaffold, en orden

Cada aplicación creada con `create:app` incluye un README con comandos concretos
para su identificador, separados por caso. El módulo de tutoría actual es
[Flota](src/app/(auth)/erp/flota/README.md).

| Caso | Guía |
| --- | --- |
| Crear una aplicación y enlazar su persistencia | [Crear aplicaciones](docs/crear-aplicaciones.md) y [Flujo del framework](docs/flujo-framework.md). |
| Añadir campos a una aplicación instalada | Caso 3 del [README de Flota](src/app/(auth)/erp/flota/README.md#3-añadir-un-campo-o-modelo-después-de-instalar), con el ID de tu módulo. |
| Cambiar vistas, menús, dominios o adaptadores | Casos 4–7 del README de cada módulo. |
| Retirar una aplicación | [Alcance y procedimiento actuales](docs/retirar-aplicaciones.md). No hay comando de desinstalación. |

`orm:generate`, `orm:install` y `orm:bind` revisan sin escribir cuando omites
`--write`; no aplican SQL. Para cambios físicos, primero se crea la migración con
`--create-only`, se revisa su `migration.sql` y después se aplica con `db:migrate`.
Los README detallan dónde intervienen `db:generate`, el enlace y el reinicio de dev.

## Desarrollo

Desde la raíz, con las dependencias y la base local configuradas:

```bash
npm ci
npm run dev
```

La aplicación abre en [localhost:3000](http://localhost:3000). La configuración de
Prisma está en `prisma7.config.ts`; los scripts `db:*` la seleccionan explícitamente.
El inicio de dev no sustituye las migraciones ni la generación del acceso a datos.

## Comprobaciones

```bash
npm run test:orm
npm run test:orm:install
npm run test:scaffold
npm run test:applications
npm run test:list-selection
npx tsc --noEmit
npm run lint
```

`npm run test:framework:integration` comprueba persistencia, evolución, dominios,
permisos, concurrencia y eliminación con cuentas y un esquema PostgreSQL temporales.

## Otras guías

- [Aplicaciones y navegación](docs/desarrollo-aplicaciones.md).
- [Instalación de modelos y propiedad](docs/instalar-modelos.md).
- [Dominios de listas](docs/dominios-listas.md).
- [Auditoría de registros](docs/auditoria-modelos.md).
- [Vistas de colecciones](docs/vistas-colecciones.md).
