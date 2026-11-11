# Lite ERP 4

ERP modular con Next.js, React, TypeScript, Prisma ORM 7 y PostgreSQL.
Las aplicaciones se componen con modelos declarativos y vistas TSX editables.

## Comandos del scaffold, en orden

Para añadir otro modelo a una aplicación, el flujo es **modelo → negocio → vistas → sincronizar**:

```bash
npm run create:model -- flota Mantenimiento
# Personaliza campos/reglas y clientFields.
npm run create:views -- flota Mantenimiento --label Mantenimientos
npm run orm:sync -- flota
```

[Metodología, vistas opcionales y protecciones](docs/modelos-y-vistas.md).

`Fields.Image({folder:"..."})` genera uploaders/acciones autorizadas con orm:sync
y miniaturas en las vistas nuevas. Las vistas existentes importan el helper de
`src/generated/orm/uploads` sin regenerarse. [Imágenes y configuración](docs/ideas/campos-imagen.md).

Para instalar o actualizar modelos en desarrollo, el flujo guiado reúne los pasos:

```bash
npm run orm:sync -- flota
```

Muestra el SQL y pide aprobación antes de aplicarlo; se detiene ante errores.
`--plan` revisa las fuentes sin escribir. [Guía del comando](docs/sincronizar-aplicaciones.md).

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

- [Estado actual y continuidad entre agentes](docs/estado-proyecto.md). Leer junto con [AGENTS.md](AGENTS.md) al retomar el proyecto.
- [Aplicaciones y navegación](docs/desarrollo-aplicaciones.md).
- [Instalación de modelos y propiedad](docs/instalar-modelos.md).
- [Dominios de listas](docs/dominios-listas.md).
- [Nombres de presentación y Many2one declarativos](docs/nombres-presentacion.md).
- [Normalización, estado anterior y acciones de consulta](docs/ciclo-modelos.md).
- [Agrupación anidada de listas](docs/agrupacion-listas.md).
- [Auditoría de registros](docs/auditoria-modelos.md).
- [Historial de cambios y notas internas](docs/actividad-registros.md).
- [Vistas de colecciones](docs/vistas-colecciones.md).
