# Lite ERP 4

ERP modular con Next.js, React, TypeScript, Prisma ORM 7 y PostgreSQL.
Las aplicaciones se componen con modelos declarativos y vistas TSX editables.

Los modelos del servidor concentran negocio, métodos y cálculos; React presenta
resultados y gestiona interacción. Para imágenes y textos derivados de relaciones,
declarar `related` sin consultas manuales: [Campos relacionados](docs/campos-relacionados.md).
Para fórmulas virtuales, declarar compute y un método @depends; los Fields display
presentan el resultado del servidor: [Campos calculados](docs/campos-calculados.md).

## Comandos del scaffold, en orden

Para añadir otro modelo a una aplicación, el flujo es **modelo → negocio → vistas → sincronizar**:

```bash
npm run create:model -- flota Mantenimiento
# Personaliza campos/reglas y clientFields.
npm run create:views -- flota Mantenimiento --label Mantenimientos
npm run orm:sync -- flota
```

[Metodología, vistas opcionales y protecciones](docs/modelos-y-vistas.md).

Las vistas reutilizan metadatos del modelo y lookups autorizados por convención.
Para proponer campos faltantes en vistas existentes: `npm run update:views -- flota Modelo`;
revisa el diff y repite con `--write` para aplicar. [Contrato, ejemplos y límites](docs/contratos-vistas.md).

`Fields.Image({folder:"..."})` genera uploaders/acciones autorizadas con orm:sync
y miniaturas en las vistas nuevas. Las vistas existentes importan el helper de
`src/generated/orm/uploads` sin regenerarse. [Imágenes y configuración](docs/ideas/campos-imagen.md).

Para instalar o actualizar modelos en desarrollo, el flujo guiado reúne los pasos:

```bash
npm run orm:sync -- flota
```

Muestra el SQL y pide aprobación antes de aplicarlo; se detiene ante errores.
`--plan` revisa las fuentes sin escribir. Para restricciones de texto existentes
(unicidad, longitud o nulabilidad), usa `npm run orm:sync -- flota --force`: comprueba
datos y mantiene la aprobación del SQL. [Guía del comando](docs/sincronizar-aplicaciones.md).

Cada aplicación creada con `create:app` incluye un README con comandos concretos
para su identificador, separados por caso. La tutoría de Flota se reinicia desde cero;
[punto de partida y ritmo](docs/tutorial-flota.md). La aplicación anterior fue retirada.

| Caso | Guía |
| --- | --- |
| Crear una aplicación y enlazar su persistencia | [Crear aplicaciones](docs/crear-aplicaciones.md) y [Flujo del framework](docs/flujo-framework.md). |
| Añadir campos a una aplicación instalada | [Sincronizar aplicaciones](docs/sincronizar-aplicaciones.md), con el ID de tu módulo. |
| Cambiar vistas, menús, dominios o adaptadores | Casos 4–7 del README de cada módulo. |
| Retirar una aplicación | [Alcance y procedimiento actuales](docs/retirar-aplicaciones.md). No hay comando de desinstalación. |

`orm:generate`, `orm:install` y `orm:bind` revisan sin escribir cuando omites
`--write`; no aplican SQL. Para cambios físicos, primero se crea la migración con
`--create-only`, se revisa su `migration.sql` y después se aplica con `db:migrate`.
Los README detallan dónde intervienen `db:generate`, el enlace y el reinicio de dev.

Los modelos admiten reacciones de borrador, restricciones, presentación y cálculos
de lectura con registro explícito o decoradores. [Guía de reacciones](docs/reacciones-modelos.md).

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
