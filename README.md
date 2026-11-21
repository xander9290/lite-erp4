# Lite ERP 4

ERP modular con Next.js, React, TypeScript, Prisma ORM 7 y PostgreSQL.
Las aplicaciones se componen con modelos declarativos y vistas TSX editables.

Los modelos del servidor concentran negocio, métodos y cálculos; React presenta
resultados y gestiona interacción. Para imágenes y textos derivados de relaciones,
declarar `related` sin consultas manuales: [Campos relacionados](docs/campos-relacionados.md).
Para fórmulas virtuales, declarar compute y un método @depends; los Fields display
presentan el resultado del servidor. Lista, Card y Kanban también muestran esos
cálculos por página autorizada, sin duplicar fórmulas: [Campos calculados](docs/campos-calculados.md).

La presentación comparte una convención: displayName personalizado → name Text
público → ID. create:app/create:model incluyen el método displayName editable;
formularios, lookups y colecciones reutilizan el resultado del servidor.
[Contrato y overrides](docs/nombres-presentacion.md).

Para el nuevo flujo de módulos declarativos: `npm run create:module -- biblioteca`,
`npm run create:model -- biblioteca Libro`, personalizar la clase y
`npm run orm:sync -- biblioteca`. Manifest y registro del modelo se crean
automáticamente; lista y formulario se resuelven por convención. No requiere
`create:views`. [Guía y límites](docs/modulos-declarativos.md).

Las [capacidades efectivas](docs/capacidades-modelos.md) comparten permisos del
actor entre menús, formularios y colecciones: consulta, crear, eliminar, acciones
y movimientos. Incluye grupos heredados y ajustes desde Accesos; el servidor
revalida cada operación. Los [grupos por módulo](docs/ideas/access-manager.md)
se asignan desde Ajustes → Grupos, con un máximo de un grupo por usuario y módulo.
Entrada directa y consulta relacional están separadas. Los grupos y concesiones
iniciales se retiraron para declararlos desde cero; admin conserva acceso.
Las [restricciones de campos y acciones](docs/ideas/permisos-campos.md) se
administran desde Grupos; requieren su migración aditiva antes de usar esta fase.

## Aprender desde cero

La tutoría de **Tickets** está pausada y el módulo se retiró el 2026-11-18.
Su [guía](docs/tutorial-tickets.md) conserva el recorrido histórico y se retomará
desde cero cuando el usuario lo indique. La prioridad actual es consolidar
Partner/User nativos en `core` y la app **Ajustes**; fases 1–4 implementadas.
Fase 5 en curso: Contactos sobre `core.partner`, con revisiones compartidas
entre Usuarios y Perfil. `contactosextra` añade dirección básica, RFC y País/Estado;
Ubicaciones contiene País/Estado/Municipio/Localidad. Los dominios encadenados ya
están aplicados y Contactos utiliza inserciones de formulario y lista. Motor de
dominios: [contrato](docs/dominios-modelos.md); composición de vistas:
[inserciones](docs/inserciones-vistas.md). La lectura automática para usuarios
internos fue retirada el 2026-11-21: los catálogos se consultan mediante relaciones
publicadas desde un modelo autorizado. Estados de México importados por el
usuario; falta comprobar la
repetición sin cambios, después importar Municipios y Localidades.
[Estado y siguiente paso](docs/estado-proyecto.md#progreso-guardado-2026-11-21-grupos-por-módulo).

## Comandos del scaffold anterior, en orden

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
para su identificador, separados por caso. Ese flujo corresponde a aplicaciones
con `orm.config.ts`; los nuevos módulos siguen create:module → create:model →
orm:sync y usan eject:view sólo para personalizar. Flota está retirada; su
[tutoría](docs/tutorial-flota.md) queda como referencia histórica.

Continuidad: [avance actual y siguiente paso](docs/estado-proyecto.md).
Implementado el 2026-11-14:
[acciones como métodos del modelo y FormHeader/FormButton](docs/ideas/acciones-formulario.md),
incluidas transiciones Kanban autorizadas. Las
[colecciones unificadas](docs/colecciones-modelos.md) comparten contrato, proveedores
y consulta entre Lista/Kanban/Tarjetas; cada TSX define la presentación. Registro
independiente de vistas, selector en URL y eject:view para form/list/card/kanban.

| Caso | Guía |
| --- | --- |
| Crear una aplicación y enlazar su persistencia | [Crear aplicaciones](docs/crear-aplicaciones.md) y [Flujo del framework](docs/flujo-framework.md). |
| Añadir campos a una aplicación instalada | [Sincronizar aplicaciones](docs/sincronizar-aplicaciones.md), con el ID de tu módulo. |
| Cambiar vistas, menús, dominios o adaptadores | Casos 4–7 del README de cada módulo. |
| Instalar, actualizar o retirar una aplicación | [Gestor de Módulos](docs/gestor-modulos.md): UI y `module:manage` en desarrollo, con plan previo. |

La [retirada de aplicaciones](docs/retirar-aplicaciones.md) conserva datos por
defecto y permite reactivación desde su archivo local verificado. La purga requiere
SQL aprobado y respaldo restaurado. Producción y aplicaciones manuales necesitan
su procedimiento específico.

`orm:generate`, `orm:install` y `orm:bind` revisan sin escribir cuando omites
`--write`; no aplican SQL. Para cambios físicos, primero se crea la migración con
`--create-only`, se revisa su `migration.sql` y después se aplica con `db:migrate`.
Los README detallan dónde intervienen `db:generate`, el enlace y el reinicio de dev.

Los modelos admiten reacciones de borrador, restricciones, presentación y cálculos
de lectura con registro explícito o decoradores. [Guía de reacciones](docs/reacciones-modelos.md).

Los módulos pueden extender modelos declarativos ajenos con `extendModel`: campos
en tabla compañera, colecciones, vista propia dentro del formulario base y reglas
sobre el modelo extendido. [Herencia y límites](docs/modulos-declarativos.md#7-extender-un-modelo-de-otro-módulo-herencia).

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

País, Estado y Municipio permiten importar/exportar Excel/CSV desde Acciones de ListView, con plantilla,
revisión antes de confirmar y permisos por grupo/modelo. Requiere aplicar primero
las migraciones correspondientes: permisos, unicidad País+código de Estado y Estado+código de Municipio ya
aplicados con aprobación en desarrollo Windows; no asumirlo en otras máquinas.
[Contrato, claves externas y límites](docs/importar-exportar-listas.md).
La función es compartida: los modelos nuevos pueden declarar `transfer` manualmente
en el manifest para escalares/DateTime, Many2one, Many2many con modo explícito y
One2many por filas que conserva las líneas omitidas. El generador no lo activa
automáticamente. [Configuración](docs/importar-exportar-listas.md#configurar-otro-modelo).

Carga inicial de estados de México: `npm run ubicaciones:import -- TU_LOGIN`
revisa el plan; añadir `--aplicar` permite confirmarlo desde una terminal.
[Uso, fuente y pruebas](docs/importar-estados.md). No requiere migración.

```bash
npm run test:orm
npm run test:orm:install
npm run test:scaffold
npm run test:applications
npm run test:list-selection
npm run test:list-transfer
npx tsc --noEmit
npm run lint
```

`npm run test:framework:integration` comprueba persistencia, evolución, dominios,
permisos, concurrencia y eliminación con cuentas y un esquema PostgreSQL temporales.

## Otras guías

- [Gestor de Módulos](docs/gestor-modulos.md): catálogo administrativo en `Ajustes → Módulos` (`/erp/ajustes/modulos`), planes e instalación/actualización/desinstalación en desarrollo.
- [Estado actual y continuidad entre agentes](docs/estado-proyecto.md). Leer junto con [AGENTS.md](AGENTS.md) al retomar el proyecto.
- [Módulos declarativos](docs/modulos-declarativos.md) (prototipo: `defineModule`, opciones de Field y `eject:view`).
- [Aplicaciones y navegación](docs/desarrollo-aplicaciones.md).
- [Instalación de modelos y propiedad](docs/instalar-modelos.md).
- [Dominios de listas](docs/dominios-listas.md).
- [Nombres de presentación y Many2one declarativos](docs/nombres-presentacion.md).
- [Normalización, estado anterior y acciones de consulta](docs/ciclo-modelos.md).
- [Agrupación anidada de listas](docs/agrupacion-listas.md).
- [Auditoría de registros](docs/auditoria-modelos.md).
- [Historial de cambios y notas internas](docs/actividad-registros.md).
- [Vistas de colecciones](docs/vistas-colecciones.md).

Acciones con argumentos: [parámetros del modelo](docs/acciones-parametros.md), con `@action({ params: ... })`, validación de servidor y diálogo automático desde FormButton.

Folios automáticos: [secuencias del modelo](docs/folios-secuencias.md), con `Fields.Text({ sequence: ... })`, contador transaccional y presentación de sólo lectura.

Selección de registros compartidos: [Many2many declarativo](docs/relaciones-many2many.md), con FieldRelationTag, tabla intermedia y guardado autorizado en la transacción del dueño.

Líneas de documentos: [One2many declarativo](docs/lineas-one2many.md), con edición inline, lógica del hijo y guardado transaccional del padre. Demo local en `/sample#one2many-model`.
