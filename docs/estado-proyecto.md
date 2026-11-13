# Estado del proyecto

Última actualización: 2026-11-13.

Documento de continuidad entre agentes y máquinas. Leer primero [AGENTS.md](../AGENTS.md)
y [README](../README.md); contrastar este resumen con Git y el código relevante.
Actualizar el estado vigente, evitando acumular una transcripción de sesiones.

## Dirección y funcionalidades

- Metodología para modelos nuevos: create:model → personalizar campos/negocio y
  clientFields → create:views → orm:sync. Se generan conexiones y vistas TSX
  editables sin XML/renderizado automático. Lista/formulario por defecto, tarjetas,
  kanban y modo modal opcionales. Guía en [Modelo y vistas](modelos-y-vistas.md).
- Framework ERP en TypeScript, Next.js, React, Prisma 7 y PostgreSQL.
  Modelos/Fields declarativos, contratos Zod, vistas TSX editables y herramientas
  para crear aplicaciones, generar contratos, instalar esquemas y enlazar Prisma.
  Procedimiento y límites en [Flujo del framework](flujo-framework.md).
- Aplicaciones con manifest, dependencias y menús de navegación; servicios con
  autorización, validación, transacciones, concurrencia y hooks de negocio.
  Contactos y Usuarios son aplicaciones activas; Citas y Flota se retiraron el
  2026-11-13 mediante otro cambio específico autorizado. Mantienen alcances distintos;
  no asumir que todos usan el mismo adaptador o política de acceso.
- ListView con selección y eliminación por lote desde «Acciones»; dominios fijos
  de servidor combinados con filtros visibles. Los dominios filtran consultas y
  no sustituyen reglas de acceso. Ver [Dominios](dominios-listas.md).
- Auditoría de creador/fechas separada de los valores editables del formulario.
  Ver [Auditoría](auditoria-modelos.md).
- Historial de creación/cambios y notas internas por defecto en createModelService.
  Tracking explícito por Field y exclusión de sensibles; captura transaccional,
  lectura paginada autorizada y borrador independiente de RHF. Scaffold integrado;
  la aplicación Flota de esa etapa fue retirada. Contrato en [Actividad](actividad-registros.md).
- Agrupación anidada opcional de ListView, hasta tres niveles escalares autorizados,
  carga al expandir, conteos SQL, paginación y selección por rama. URL con prefijo;
  conserva dominios/filtros/permisos. Scaffold nuevo habilita Boolean, Selection y
  Many2one directos. Las aplicaciones
  existentes requieren configurar columnas y regenerar su adaptador, sin migración.
  Los grupos Many2one conservan ID y resuelven su etiqueta por proveedor autorizado.
  Contrato en [Agrupación](agrupacion-listas.md).
- Empaquetar como dependencia npm es una meta futura, conservando Next.js y Prisma.
  Primero madurar contratos y aplicaciones. Ver [Idea y alcance](ideas/aplicaciones-modulares.md).

## Tutoría anterior de Flota (histórico; retirada el 2026-11-13)

Este apartado describe la práctica anterior, posteriormente retirada; el nuevo
recorrido y su siguiente paso están en la sección siguiente. No recrearla por
anticipación.

Reiniciada por petición expresa el 2026-11-12. La aplicación anterior y sus datos
locales se retiraron; las migraciones anteriores y la de retirada se conservan.
Después el usuario ejecutó create:app -- Flota y limpió menús/rutas sobrantes.
Inspección del código: manifest admin con un enlace Flota a /erp/flota y modelo
FlotaRecord; Record.ts y orm.config.ts contienen/publican sólo name/active.
Permanecen lista principal, nuevo, [id] y layout; no están activos ni mis-registros.
El usuario creó Fabricante mediante create:model: Fabricante.ts declara name
obligatorio, maxLength 120 y tracking; active con default true y tracking.
Se verificaron su import/publicación name/active en orm.config y su registro en
manifest. El usuario ejecutó create:views para Fabricante; se verificaron la entrada
Fabricantes en manifest y el README de lista/formulario. En ese momento no había
Modelo/Vehicle; se crearon después (ver «Tutoría y pendientes de imágenes»).
El usuario compartió orm:sync exitoso (migraciones aplicadas, sin diferencias,
cliente/adaptadores y TypeScript correctos) y confirmó guardar/reabrir un fabricante.
Se verificó además la entrada flota del registro instalado. La prueba funcional
fue confirmada por el usuario; no se repitió en navegador ni se consultó la BD.

Objetivo acordado: Configuración con Fabricantes/Modelos, y menú Vehículos.
Cada modelo pertenece a un fabricante; cada vehículo referencia un modelo.

Las mejoras del framework y las demos /sample permanecen. El ejemplo histórico
FleetVehicle del generador no es la aplicación instalada. Las pruebas de related
se preparan ahora desde un fixture propio, sin depender de la nueva tutoría.

## Siguiente paso concreto

### Tutoría de Flota: pausa para cambiar de máquina (2026-11-13)

Rama `codex/flota`. Fabricante instalado con name/active y logo Image opcional
(folder flota/fabricantes, tracking). Modelo instalado con name/active y
fabricanteId obligatorio a FlotaFabricante, Restrict/tracking; conservar su nombre.
Su alias fabricante permite @displayName("name", "fabricante.name") y el formato
«Modelo / Fabricante». Manifest icon car y ambos modelos registrados; vistas,
lookup y uploader por convención, sin eject ni helpers de scaffold.

El usuario confirmó guardar/reabrir fabricante, subir/guardar/reabrir su logo y,
tras instalar Modelo/reiniciar/finalizar mantenimiento, crear/reabrir Modelo con
fabricante y presentación «Corolla / Toyota». Confirmación funcional del usuario,
sin repetición visual ni consulta independiente de BD por el asistente.
Al pausar se verificaron fuentes/esquema instalado, las tres migraciones del
recorrido y ausencia de marcador de mantenimiento. Sin suites/build nuevos;
git diff --check de la documentación. Detalle en [la tutoría](tutorial-flota.md).

**Próximo paso pendiente:** vehículos (punto 4 del recorrido). Confirmar nombre
con el usuario (Vehicle propuesto, no decidido), revisar create:model --dry-run
y después declarar la relación con Modelo. No se creó ese modelo ni se adelantaron
campos, relaciones, reglas o vistas. Mantener un ejercicio por vez.

**Cambio de máquina:** hay cambios locales sin commit en docs, src/modules/flota,
índice, prisma/models, propiedad y migraciones. Commit/push/pull requieren
autorización; no se ejecutaron durante este cierre. Para retomar, obtener esa
rama con sus cambios, preparar dependencias/configuración privada, generar cliente
y comprobar destino de BD/migraciones antes de aplicar SQL. No asumir que el código
compartido transporta datos, secretos, backups locales o procesos dev. Guía de
continuidad y nombres de migraciones en [la tutoría](tutorial-flota.md#continuidad-en-la-otra-máquina).

### Pendiente: desinstalación en producción (2026-11-13)

Registrado por petición del usuario. Diseñar el despliegue y mantenimiento
coordinados, las modalidades conservar/purgar, el gate de SQL destructivo,
respaldo/restauración y recuperación ante fallos. Alcance y criterios en
[el pendiente](ideas/desinstalacion-aplicaciones.md#pendiente-solicitado-desinstalación-en-producción).
El gestor sigue bloqueado en producción. Este incremento sólo modifica
documentación; sin cambios de ejecución, BD, procesos ni despliegues.
Verificación documental: `git diff --check` en los tres documentos afectados.

### Retirada de Citas odontológicas y Flota (2026-11-13)

Autorizada por el usuario; Demo y Contactos/Usuarios se conservan. Código, esquema,
propiedad/catálogo, fuente legacy de lista, pruebas y documentación retirados;
procedimiento y alcance en [Retirar aplicaciones](retirar-aplicaciones.md#retirada-de-citas-odontológicas-y-flota-2026-11-13).
Migración `20261113190000_remove_citas_flota` revisada y aprobada por el usuario,
aplicada a la base local: `migrate diff` sin diferencias; seis tablas y enum eliminados;
`record_activities` 14 → 7 (sólo Flota); users 2, partners 2, access_user_groups 1 y
Demo sin cambios. Verificación: tsc sin errores fuera de `.next`, suites unitarias
(scaffold 12/12 tras corregir `listRecords`), test:modules:integration y
test:legacy:integration y test:framework:integration completo aprobadas. El trabajo sin commit de la app Módulos (otro agente)
sigue en el árbol junto con esta retirada. Reiniciar `npm run dev` tras regenerar el
cliente Prisma: `.next/dev/types` conserva rutas retiradas hasta entonces.

### Aplicación Módulos: operaciones (2026-11-13)

Autorización posterior del usuario: conectar instalar, actualizar y desinstalar.
Implementado en la UI y el CLI compartido `module:manage`, sólo en desarrollo.
Plan persistido y recalculado con permisos/sesión vigentes, caducidad/huellas,
bloqueos de dependencias, migraciones pendientes/drift y herramientas activas.
El navegador no decide ejecutable, SQL, rutas, conexión ni actor.

Instalar/actualizar reutiliza orm:sync con SQL aditivo exacto. Keep retira código y
registro conservando esquema/propiedad/datos/accesos, reserva ID versionado y
permite reactivación desde archivo local verificado. Drop comprueba dependencias
SQL, crea/restaura un respaldo del schema en base temporal, elimina sólo alcance
propio con migración nueva y limpia actividad/accesos por identidades exactas.
Genera cliente y tipos Next antes de comprobar TS tras retirar rutas estáticas.

Mantenimiento compartido con accesos autenticados e inicio de sesión; la página de
trabajo permanece disponible al admin y permite cierre tras reinicio. Fallos antes
de preparar cambios permiten cierre verificado; después de efectos requieren
revisión manual. No hay rollback global, retirada en caliente ni coordinación
distribuida. Otros procesos/instancias deben detenerse por el operador.
Producción y aplicaciones manuales siguen fuera del ejecutor; infraestructura
protegida. Archivos remotos intactos. Contrato y recuperación:
[Gestor de Módulos](gestor-modulos.md).

Verificación vigente: gestor 20/20, módulos 20/20, scaffold 12/12, TypeScript y
ESLint de afectados aprobados. La ejecución inicial de módulos en sandbox falló
por permisos de rename/junction; repetida fuera de sandbox, 20/20 aprobadas.
test:modules:integration aprobado para ciclo declarativo completo: permisos,
planes obsoletos, SQL de JSON alterado ignorado, instalar/actualizar con registros,
keep/reactivación, bloqueo de vista SQL, falta de pg_tools recuperable y drop con
respaldo restaurado; recursos temporales eliminados. La extensión con scaffold
detectó que el retiro rechazaba sus propios archivos `.prisma`; corregido y cubierto
por regresión de artefactos gestionados/modificados y assets sin adaptador.
Se reutiliza artifactPlan para verificar propietario/hashes en lugar de duplicar
su validador. Tipos de rutas: se comprueban fuentes y `.next/types` recién generados,
omitiendo sólo raíces obsoletas de `.next/dev/types`; prueba verifica que errores
de fuentes y tipos actuales siguen fallando. Tras corregir el fallo, la corrida
focalizada `test:modules:integration -- --legacy-only` aprobó instalar, retirar y
reactivar una app scaffold nueva con su registro intacto, catálogo, repositorio,
accesos y tipos de rutas; proyecto/schema temporales eliminados. La corrida amplia
previa había completado el ciclo declarativo y se había detenido al encontrar el
archivo Prisma en el recorrido heredado; no se presenta como una corrida completa
aprobada de la versión final.
test:legacy:integration aprobado en copia/esquema temporales: build de producción,
trace sin .env/respaldos, auth, Contactos, tema y rutas admin/no admin.
No hubo operaciones del gestor sobre datos reales ni commit/push desde este chat.
Se detectó el commit concurrente `2e9ef45` con la retirada específica de Citas/Flota;
se respetó y se actualizaron las referencias documentales.

Pendientes: revisión visual de interacción; recuperación automática después de
efectos; adaptadores manuales y despliegue de producción. La reutilización de
sync/instalador evita tres motores de persistencia. Para ampliar recuperación,
exigir pruebas de interrupción y estado confirmado sin repetir SQL ni levantar
mantenimiento con versiones incompatibles.

### Catálogo inicial (comprobaciones históricas)

Por solicitud del usuario se inició la app nativa `/erp/modulos`, sólo para
administradores. Primera etapa implementada: lista con búsqueda/filtros/orden y
paginación, ficha por ID, tipos declarativo/scaffold/nativo, estados de instalación,
modelos y dependencias declaradas. Reutiliza ListView y FormViewLoader.

El inventario AST lee manifests disponibles aunque no estén registrados, sin
ejecutarlos, y contrasta esquema/propiedad con tablas/columnas del schema SQL
actual. Las consultas revalidan active/isAdmin/sessionVersion en RepeatableRead
readonly. No añade tablas ni modifica datos de negocio. TypeScript pasa a
dependencia de ejecución (misma versión) y Next incluye fuentes de catálogo en
los traces de las nuevas rutas. [Contrato y límites](gestor-modulos.md).

La primera etapa era de lectura; las operaciones actuales están descritas arriba.
Las dependencias
mostradas son `depends`, no todo el grafo de relaciones/imports. Tampoco se
certifican constraints/drift ni cambios de campos presentes sólo en clases TS.
Demo se conserva. No se hicieron commit/push/pull desde este chat.

Verificación de la etapa: test:module-manager 8/8, test:applications 10/10,
TypeScript y ESLint de afectados aprobados. Integración de módulos aprobada, incluida la corrida ampliada con módulo
disponible sin instalar, fuera del catálogo, estados y autorización contra schema
temporal; recursos eliminados. El último ajuste del parser se verificó con sus
6 pruebas puras (incluido el caso adicional de comentarios/literales); el conjunto
completo de 8 pruebas había pasado antes del ajuste. No se repitió su ejecución
con junctions después, al quedar indisponible la revisión automática de permisos. Build temporal y trace de producción aprobados;
test:legacy:integration aprobado (auth/Contactos/Citas/tema), con las rutas nuevas
permitidas al admin y denegadas al usuario ordinario. Recursos de esa corrida
eliminados. No se ejecutó SQL de instalación/retirada sobre la base del ERP.

Revisión visual pendiente: Computer Use se detuvo al no poder determinar con
confianza la URL de Edge; no se continuó la automatización. Las comprobaciones
HTTP no equivalen a verificar la presentación e interacción en navegador.

### Estrategia de desinstalación (diseño, 2026-11-13)

Solicitud posterior del usuario: planificar la retirada de aplicaciones, módulos
declarativos y aplicaciones heredadas. Diseño guardado en
[Desinstalación](ideas/desinstalacion-aplicaciones.md), inicialmente sin implementación.
Revisión inicial: rama `refactor/modulos-declarativos`, commit `beecf84`
(`Fase final terminada`) y árbol limpio; las herramientas de la tarea anterior
ya estaban versionadas. Esta tarea no hizo commit/push/pull.
Propone un planificador común con adaptadores por tipo; `keep` predeterminado
con esquema/datos/propiedad e identidad reservados, y `drop` con SQL/respaldo y
aprobación específicos. Dependientes y objetos compartidos bloquean; los modelos
Partner/User no se consideran purgables por figurar en un manifest de aplicación.
Incluye catálogos/hashes/inversas, historial/accesos exactos, recuperación por fases
y mantenimiento coordinado para cortar las acciones legacy. No promete retirada
en caliente ni rollback global; archivos remotos fuera de alcance.

En aquella etapa sólo se propuso revisar la fase 1 antes de ampliar escrituras;
el incremento autorizado e implementado después se describe arriba. El primer
paso del tutorial documentado más abajo no se ejecutó como parte de este gestor.

Verificación: lectura de código, registros y migración histórica; corrección en
la guía de retirada de la nota obsoleta que decía que el ID flota seguía libre.
`git diff --check` aprobado. Sin consultas a BD, pruebas de código nuevas,
migraciones ni modificaciones de los cambios de herramientas de la tarea anterior.

### Preparación del tutorial con módulos declarativos (2026-11-13)

Alcance autorizado: integraciones, herramientas y documentación, **sin retirar
Flota ni Demo**. No se migran sus fuentes ni se borran tablas/datos/asignaciones.
La rama es `refactor/modulos-declarativos`; las fases 3 y 4 están en los commits
`af14d66` y `5e77ef6`. El último punto de continuidad previo era `e058e69`.
La comprobación inicial encontró el árbol limpio; no se hicieron commit/push/pull.

Implementado en esta tarea:

- `create:module -- id [--dry-run]`: manifest mínimo (vacío, icono por nombre) e
  import/registro en `src/modules/index.ts` con edición AST.
- `create:model -- id Modelo [--dry-run]`: detecta módulos, crea la clase en
  `models/<clave>.ts` y añade su import/entrada al manifest. Las aplicaciones con
  `orm.config.ts` conservan su flujo anterior. No genera vistas/clientFields.
- `orm:sync`: preflight del índice; registro si falta después de esquema/cliente
  y antes de TypeScript; idempotente y visible en `--plan`, con aviso de reinicio.
  Rechaza el mismo ID con manifest de módulo y orm.config.ts a la vez.
- Módulos vacíos admitidos para el esqueleto: ocultos del cajón, ruta 404 y petición
  de crear un modelo antes de sincronizar. Permisos de módulos con modelos intactos.
- `test:legacy:integration` ejecuta las cuatro suites de autenticación, Contactos,
  Citas y tema en proyecto/esquema/servidor/cuentas temporales. El seed de auth se
  ejecuta sólo ahí; no depende del administrador real. El servidor usa build/start.
- Tutorial, README y reglas actualizados para el nuevo enfoque sin adelantar
  ejercicios. Guía técnica: [Módulos declarativos](modulos-declarativos.md).

Verificación final 2026-11-13:

- `test:modules`: 20/20; cubre AST, creación, dry-run, conservación de
  personalizaciones, colisiones, configuración doble, concurrencia y junctions.
- `test:modules:integration`: aprobado en proyecto/esquema temporales; recorrido
  CLI completo, `orm:sync --plan` sin escritura, registro faltante/idempotente,
  SQL aprobado exclusivamente por fixture, guardado/reapertura/lookup y compilación
  de las clases generadas. También repositorio/servicio, grupos/permisos/reglas y
  vistas expulsadas de ensayo. Recursos temporales eliminados.
- `test:legacy:integration`: las cuatro suites aprobadas (auth, Contactos,
  appointments-service y tema), con build/start de producción en un proyecto
  temporal. Esquema, cuentas y servidor eliminados. No usa el admin real.
- `test:scaffold`: 12/12; `test:applications`: 10/10; pruebas de sync: 3/3.
  TypeScript y ESLint de archivos afectados aprobados; `git diff --check` limpio.

Límites: sin revisión visual nueva ni build en el directorio real; el build se
comprobó en la copia temporal con las mismas fuentes, raíz Turbopack explícita y
base del scanner Tailwind acotada a src. El fixture usa localhost en ambos lados
porque Next normaliza loopback y Auth.js valida el origen del callback.
Las operaciones de BD/renombrado/junction necesitaron salir del sandbox. La primera
prueba HTTP con next dev agotó el tiempo; el resultado aprobado corresponde a
producción. Un timeout de tsc del scaffold durante compilaciones concurrentes se
resolvió al repetirlo; no se relajaron límites ni se omitieron pruebas. No se
repitieron test:orm, test:orm:install ni test:framework:integration completos.

En aquella preparación se propuso `flotaensayo` para evitar colisiones con la
aplicación entonces existente, sin crear sus modelos ni autorizar retiradas.
La situación cambió después: ver el inicio vigente en `codex/flota` y
[el primer paso actualizado](tutorial-flota.md).

Hallazgos abiertos: límite de contraseña máximo 8 frente al mensaje de UI,
aviso dev `instant-unrendered-segment`, breadcrumbs del formulario por defecto y
límites de reglas en etiquetas Many2one/displayName. No corregidos en esta tarea.

### Módulos declarativos y Control de accesos

Fases 0–4 implementadas y versionadas. El prototipo aporta ruta comodín,
despachador fijo autorizado, repositorio genérico, vistas por defecto/expulsadas,
opciones de colección en Fields y Control de accesos con grupos/CRUD/reglas.
Manifests conservan declaraciones; la BD guarda asignaciones, overrides y estados.
Las verificaciones anteriores de las fases, incluida instalación y revisión local
de Demo y Control de accesos, son históricas; no equivalen a pruebas de esta tarea.
Detalle y límites en [el plan](ideas/modulos-declarativos.md).

### Eliminación desde FormView (2026-11-12)

Implementado `deletion` opcional en el menú de FormView y conectado en los cuatro
formularios existentes de Flota y en el scaffold. CardView conserva su comportamiento
actual, sin selección añadida. Se reutiliza `deleteRecords` autorizado y su control
transaccional de revisiones/relaciones; no se añadieron migraciones ni nuevas reglas
de servidor. Confirmación única antes del efecto; cancelar o fallar conserva los
borradores. El éxito confirmado vuelve a la colección mediante returnTo validado
por rutas exactas, conservando query, o a un fallback explícito al abrir directamente.
Demo reversible RHF/Zod en `/sample#form-deletion`, sin datos reales.

Verificación de esta tarea: test:form-navigation (guard y eliminación) 12/12;
test:list-selection 8/8; test:scaffold 12/12; TypeScript y build aprobados. ESLint
de los componentes, helpers, demo y generadores modificados aprobado tras corregir
el acceso a refs en render. No se borraron registros reales ni se repitió
integración PostgreSQL; se reutiliza el servicio de borrado existente.

Verificación interactiva 2026-11-12 en `/sample#form-deletion` (dev en :3000 ya
servía el código vigente): cancelar cierra la confirmación y conserva el nombre
editado y «Tienes cambios sin guardar»; con la relación simulada aparece «No se
pudo eliminar» y el borrador se conserva; sin ella se muestra «Registro eliminado.»,
el enlace de retorno y se navega a `#form-deletion-result`. Sin errores de consola.
Datos ficticios en memoria. La prueba con un Fabricante desechable se omitió por
decisión del usuario (sin sesión en el navegador de pruebas); el retorno real a la
colección con returnTo/filtros sigue sin comprobar en navegador.
Contrato: [FormView](../src/components/ui/form/FormView.md#eliminación-opcional).

### Tutoría y pendientes de imágenes

Tutoría de imágenes 2026-11-12: Fabricante.logo Image opcional, carpeta
flota-fabricantes, ya está publicado, conectado al uploader y sincronizado en fuentes.
Revisión solicitada por el usuario: CardView consume listRecords, columnas name/logo,
recordHref, metadata canónica y helper firmado admin con carpeta fija. Se verificaron
logo en esquema instalado y select/dto/data del binding. Captura del usuario muestra
la tarjeta Volkswagen con miniatura; no se ejecutaron nuevas subidas ni consultas BD.
TypeScript y test:images 11/11 aprobados. ESLint de afectados: 0 errores y 3 avisos
por imports sin uso en FabricanteList (ListView, deleteRecords, recordFields).

Oportunidades registradas, sin implementación: CollectionImage usa object-cover y
el formulario widget avatar recorta 1:1; para logos no cuadrados conviene evaluar
contain/padding y preservar aspecto (aceptación: marcas anchas completas sin afectar
avatares). logo no tiene tracking: activar sólo si se decide auditar cambios de URL.
active existe en modelo/servicio pero no en columnas CardView: decidir badge/filtro
sin imponer dominio de negocio. Breadcrumbs ocupan basis-48 en CollectionShell y se
parten en escritorio; evaluar ancho adaptable conservando wrap móvil y acciones.
Limpiar imports sin uso y centralizar recordSearchFields, ya existente, para evitar
repetir la misma lista. Limpieza remota sigue pendiente según su guía, sin borrados.
Próximo ejercicio elegido por el usuario: related de Vehicle por name.fabricanteId.logo;
no añadirlo por anticipación. La ergonomía de conectar uploads al actualizar vistas
existentes puede mejorarse con una propuesta AST revisable, sin sobreescrituras.

La matrícula plate ya persistía según confirmación del usuario; se volvió a activar
required:true y se retiró un lock huérfano tras comprobar procesos. No se recibió
confirmación nueva del estado NOT NULL en BD; no confundirlo con la verificación
funcional de guardar/reabrir la matrícula opcional.

Tutoría: Fabricante y Modelo con vistas y relaciones completas; el usuario confirmó
sus guardados/reaperturas y validación del fabricante obligatorio. Vehicle también
se creó y sincronizó según el usuario, con captura de un registro guardado. Usa
name como Many2one obligatorio a FlotaModelo (label Modelo, Restrict/tracking),
active y clientFields name/active. No renombrar esa FK ni duplicar Fabricante.

Menú verificado: Vehículos y Configuración → Fabricantes/Modelos; /erp/flota redirige
a /erp/flota/vehicle. El cascarón FlotaRecord sigue instalado y conserva sus archivos;
no retirarlo automáticamente ni asumir que ya se sustituyeron todas sus rutas.

Convención de presentación ya unificada por petición expresa: displayName personalizado
→ name Text no sensible → ID. Servicios declarativos comparten read/save/lookup y
colecciones con metadata $displayName por página/rama. Card/Kanban usan el título
canónico por defecto y conservan titleField/renderCard explícitos; ListView permite
conservar un valor de columna con displayName:false. Scaffold crea el método
editable en modelos nuevos. Se adaptaron los formularios existentes de Flota sin
regenerarlos; Vehicle usa @displayName("nameRecord.fabricante.name",
"nameRecord.name") en vehicleLabel («Fabricante · Modelo»). No hay SQL nuevo.
Retomar con la comprobación del usuario en Flota y elegir el próximo ejercicio;
no añadir campos/reglas por anticipación. Los proveedores manuales externos al
servicio declarativo conservan sus propios contratos y se adaptan explícitamente.
[Recorrido](tutorial-flota.md).

Las verificaciones que siguen incluyen etapas históricas de la aplicación anterior,
retirada para reiniciar la tutoría; no confundirlas con los archivos nuevos.

## Último trabajo y verificaciones

- 2026-11-12: convención canónica de nombres en modelos, withDisplayName,
  read/save, lookup y colecciones declarativas. Personalizado vacío usa name Text
  público y después ID; respuestas no textuales siguen siendo error. Métodos
  reciben sólo dependencias declaradas, con fallback público cargado aparte.
  Colecciones publican $displayName separado de escalares, usando proyección por
  lotes <=100 de IDs de esta página/rama en la misma transacción autorizada.
  Sin SQL, caché global, consultas por fila ni publicación de objetos del formato.
- ListView aplica nombres a identidad textual name/id y controles accesibles;
  displayName:false conserva columna, renderCell tiene prioridad. No sustituye
  imágenes/números/fechas/Selection por defecto. Card/Kanban omiten titleField
  obligatorio y respetan titleField/renderCard explícitos. La metadata no autoriza
  búsqueda, orden, filtros o grupos SQL; IDs/revisiones/valores se conservan.
- create:app/create:model generan displayName(record: DisplayRecord<Clase,"name">)
  que devuelve record.name. Dependencia name implícita; el desarrollador modifica
  método/dependencias con los contratos existentes. No se sobreescribieron clases
  de Flota para añadir stubs. Se conectaron los formularios Fabricante/Modelo/Record
  a la metadata ya disponible, conservando sus personalizaciones y guardados.
- Verificación: 30/30 pruebas específicas de nombre/proyección/servicio/colecciones,
  24/24 de regresión de modelos/ciclo/etiquetas/grupos/kanban y scaffold 12/12.
  TypeScript, ESLint de afectados y build aprobados. En navegador, la demo pública
  /sample#image-collections mostró el mismo prefijo «Ficha · …» en tres filas de
  lista, tres tarjetas y tres tarjetas kanban, incluidos controles accesibles.
  Datos ficticios, sin sesión del ERP ni guardados reales. Integración SQL completa
  aprobada: nombres por página/rama sin consultas por fila, método generado de
  create:model y misma etiqueta en read/save/list/kanban, además de permisos,
  concurrencia, evolución, sync, force y vistas generadas. Proyecto y esquema
  temporales eliminados; sin escrituras ni SQL en datos reales para este alcance.
- Oportunidad pendiente: adaptar proveedores y vistas manuales restantes sólo con
  su contrato explícito, sin descubrimiento de clases/consultas desde el cliente
  ni regeneración de vistas personalizadas. Aceptación: mismos nombres en sus
  relaciones/encabezados/colecciones, sin mezclar metadata y valores de escritura.


- 2026-11-12: nombre de presentación conectado a formularios por petición expresa.
  read/save publica displayName separado de values, sin RHF/defaults/payload ni
  columna nueva. Proyección por ID con rutas/guardas del binding en la misma
  transacción autorizada; dependencias locales sin otra consulta. Save calcula
  después de hooks/lectura final; un fallo revierte el guardado. Callback tercero
  de FormViewLoader/onSaved compatible con consumidores anteriores. Scaffold
  mantiene el nombre guardado en el breadcrumb, sin reaccionar a borradores locales.
- Vehicle declaró @displayName("nameRecord.name") y displayRelations a Modelo
  (después ampliado a fabricante · modelo; ver arriba);
  VehicleForm consume el resultado al abrir/guardar. Se conservaron sus campos,
  tracking, rutas, permisos y decisiones del usuario. orm:generate sin cambios y
  orm:bind actualizó únicamente Vehicle mediante CLI; sin SQL ni datos reales.
- Verificaciones de esta etapa: pruebas de nombre de formulario/servicio 12/12,
  TypeScript, ESLint de archivos afectados, build y diff-check aprobados. Pruebas
  de scalar/fallback sensible, autorización antes de proyectar, binding viejo,
  ID ajeno y rollback, metadata fuera de values y rechazo de payload falsificado.
  Scaffold: 11 casos pasaron en la primera ejecución y uno agotó 90s bajo carga
  concurrente; el caso cancelado pasó al repetirse por separado (51s). Integración
  SQL completa aprobada: escenarios nuevos de abrir/guardar/reabrir y metadata
  falsificada, además de evolución, permisos/concurrencia, sync, force y vistas
  generadas. Proyecto y esquema temporales eliminados; sin escrituras en datos reales.
  No se hizo una inspección visual autenticada nueva; el navegador de pruebas
  disponible no comparte la sesión del navegador del usuario.
- Oportunidad aceptada en este alcance: reutilizar displayName en encabezados
  evita resolver etiquetas en cada vista. El siguiente límite es adaptar vistas
  personalizadas existentes sólo cuando se solicite, conservando sus fallbacks,
  borradores y navegación; no regenerarlas para adoptar la nueva metadata.

- 2026-11-12: retirada completa de la aplicación Flota por petición expresa, con
  confirmación adicional para borrar también datos/tablas locales. Copia del código
  previo en .tutorial-backups, ignorada por Git, sin configuración privada ni copia
  de datos. Retirados fuentes/rutas y artefactos apps/bindings/uploads; validada
  propiedad instalada antes de quitar su esquema/inversas/entrada. Registro del
  scaffold regenerado mediante sus helpers y manifiesto, sin hashes manuales.
  No se revirtieron las mejoras compartidas del framework ni los ejemplos.
- Migración 20261112173158_remove_flota_tutorial revisada y aplicada a la base
  local: cuatro tablas, enum y actividad sólo de sus cuatro modelos, en transacción
  y sin CASCADE/reset. Se conserva todo el historial anterior de migraciones.
  Verificados ausencia de tablas/actividad de Flota y conteos iguales del resto
  de tablas/actividad. Prisma Client regenerado y diff BD/esquema sin diferencias.
  No se eliminaron archivos remotos. [Procedimiento específico](retirar-aplicaciones.md).
- Independizadas las pruebas SQL: related-collection.fixture instala tres modelos
  propios exclusivamente en el proyecto/esquema desechables; el framework ya no
  importa Vehicle ni servicios de la aplicación de tutoría. Retirado un createHref
  obsoleto de una demo con Crear oculto. Documentación vigente y AGENTS actualizados
  para comenzar desde cero; no recrear automáticamente el ejercicio anterior.
- Verificación de la retirada: TypeScript, ESLint de archivos afectados, build de
  producción (sin rutas de Flota), applications 10/10 y scaffold 12/12 aprobados.
  create:app -- Flota --dry-run aprobado sin escribir archivos ni colisiones.
  Se regeneraron tipos de rutas tras descartar únicamente la caché dev/types
  obsoleta; no se inició ni reinició dev. Integración SQL completa aprobada, incluido
  el fixture independiente de related, evolución, permisos/concurrencia, force y
  vistas generadas con persistencia. Proyecto y esquema temporales eliminados.
  No se hizo una inspección visual autenticada nueva; el build verifica las rutas
  restantes y las pruebas SQL usan cuentas/datos desechables.
- Oportunidad de simplificación: un desinstalador revisable evitaría coordinar
  manualmente fuentes, catálogo, propiedad/inversas y migración. Aceptación:
  dry-run, dependientes bloqueantes, política explícita de conservación/borrado,
  integridad de artefactos y prueba de recreación sin afectar otras aplicaciones.
  Se documenta como pendiente; no se creó una API genérica para esta retirada.

- 2026-11-12: related Image/Text disponible en ListView, CardView y KanbanView.
  CollectionFields publica sólo persistentes y related autorizados; el servicio
  proyecta las salidas solicitadas por página y resuelve referencias únicas por
  raíz en lotes de hasta 100, en la misma transacción autorizada. Binding con
  delegates/rutas fijos; rechaza consultas SQL sobre salidas derivadas. Compute
  permanece limitado a formularios. Contrato en [Campos relacionados](campos-relacionados.md).
- Vehicle publica fabricanteAvatar en su lista y habilita agrupación por Modelo
  en vista y servicio, con etiquetas autorizadas y claves por ID. Scaffold nuevo
  publica CollectionFields y configura Many2one agrupables. Se preservaron las
  vistas personalizadas; contratos y bindings de Flota regenerados por CLI, sin
  migraciones ni cambios de datos reales.
- Verificación de esta etapa: 23/23 pruebas de servicio/related/agrupación/etiquetas
  y scaffold 12/12 aprobados; TypeScript, ESLint de archivos afectados, build de
  producción, diff-check y orm:generate --check de Flota aprobados. En navegador,
  /sample#image-collections mostró las seis imágenes relacionadas esperadas entre
  lista, tarjetas y kanban, sin errores; datos ficticios, sin sesión de Flota.
- La integración PostgreSQL alcanzó y aprobó los escenarios nuevos del fixture:
  imágenes por página, referencias compartidas, grupos Many2one con etiquetas
  iguales e IDs distintos y hojas filtradas por FK. También confirmó evolución y
  orm:sync. No se conservó el resultado final del proceso completo; no atribuir
  una aprobación nueva a sus etapas finales force/resource. Al cierre no quedó
  directorio .framework-test-* en el proyecto. La prueba usa un esquema exclusivo
  desechable; no escribe en las tablas del ERP.
- Oportunidad acotada: evaluar publicaciones explícitas de related adicionales
  cuando exista un caso real; conservar consultas por página/lote y políticas
  SQL separadas. No convertir el soporte de imágenes en permiso para agrupar
  por rutas o ejecutar compute por fila. Kanban mantiene columnas Selection.

- 2026-11-12: campos calculados virtuales Integer/Text/Image con compute en la
  clase y métodos @depends (forma corta o existente). Se infieren outputs de
  lectura y se separan de campos persistentes, defaults, tipos de captura, payload,
  auditoría y SQL. Un método de una salida devuelve el escalar; varias salidas
  exigen objeto completo. Backend valida tipos/límites y sólo recibe dependencias
  publicadas no sensibles, conservando la transacción readonly autorizada.
  Guía en [Campos calculados](campos-calculados.md).
- FieldText/FieldNumber añaden mode=display con presentación compartida y el mismo
  acceso a lectura que FieldImage, sin inputs/RHF. Scaffold genera estos controles
  para compute y related. Demo /sample#model-reactions migrada a total/resumen
  declarativos; Flota y sus reglas no se modificaron para este alcance. En una
  petición mixta, los compute activos consumen patches onchange ya validados,
  evitando resultados anteriores a la transformación sin una cascada de React.
- Verificaciones de esta etapa: 13/13 pruebas de compute/reacciones/related,
  13/13 de modelo/imagen/contratos generados/ciclo, formularios 5/5 y scaffold
  12/12 aprobados. TypeScript, ESLint de archivos cambiados, diff-check y build
  final de producción aprobados. No se repitieron suites globales con fallos
  históricos de symlinks de Windows para atribuirles una aprobación nueva.
- Navegador: total inicial 10, edición 3×20=60, resumen coherente con el patch
  uppercase y payload sólo name/quantity/unitPrice. Revertir vuelve a total 10;
  los controles display no tienen inputs. Integración PostgreSQL completa aprobada:
  incluye compute con servicio real y rechazo del valor falsificado en el contrato,
  además de evolución, permisos, concurrencia, force y scaffold existentes.
  Proyecto/esquema temporales eliminados, sin datos ni SQL de la base real.
- Límites: sólo borradores de formularios y dependencias locales persistentes,
  sin cadenas/ciclos, store/inverse ni proyección automática desde listas/read.
  La siguiente etapa es diseñar cálculos persistidos e invalidación, después de
  elegir un caso real con el usuario; no añadir cambios a Flota por anticipación.

- 2026-11-12: primer alcance de related Image/Text, declarado directamente en la
  clase y separado de persistencia/tipos de captura. Generación valida hasta tres
  saltos Many2one publicados/no sensibles del perfil; binding con delegates
  explícitos, guardas de metadata y proyección compartida por raíz. Reutiliza la
  transacción readonly autorizada de reacciones. No se reciben rutas/selects del
  navegador ni se crean columnas. Contrato en [Campos relacionados](campos-relacionados.md).
- Vehicle sustituyó el método fabricantePreview por dos Fields related. El avatar
  usa FieldImage mode=display con recordUI.readFields, sin RHF ni uploader; se
  conserva normalización, onchange de matrícula, displayName y formato local del
  usuario. Los componentes retirados siguen eliminados. Scaffold enlaza contratos
  de lectura y genera presentación de imágenes en vistas nuevas; no se regeneraron
  vistas personalizadas. orm:generate y orm:bind ejecutados por herramientas;
  generate --check sin diferencias. Esquema/SQL sin cambios, sin migraciones ni
  datos reales modificados. Prisma Client local regenerado por el build.
- Verificación: cuatro pruebas nuevas de related aprobadas (separación de tipos y
  payload, null/IDs, proyección mínima, publicación/sensibles/tipos, sesión/revisión);
  formularios 4/4, imágenes 11/11 y scaffold 12/12 aprobados. TypeScript, ESLint de
  los archivos modificados y build de producción aprobados. ORM global 59/60: el
  caso restante falla con EPERM al crear un symlink de archivo en Windows, incluso
  fuera del sandbox. Instalación 13/19: seis fixtures fallan al crear symlinks de
  directorio; no presentar esas suites como aprobadas ni omitir las protecciones.
- Integración PostgreSQL completa aprobada en proyecto/esquema temporales, con
  prueba del binding related real de Vehicle: avatar y nombre en una llamada al
  repositorio, rechazo de cuenta sin permisos/ID inexistente, null actualizado y
  ausencia de escrituras en Vehicle/actividad. También conserva las comprobaciones
  previas de persistencia, evolución, force, concurrencia y scaffold. Recursos
  temporales eliminados; la base real no se migró ni se usó para datos de prueba.
- Navegador en /sample#related-image: imagen pública cargada, payload sólo modelId,
  ningún input en el FieldImage display y reset a relación vacía con «Sin imagen».
  Se usó el dev existente. Los dos componentes dedicados de preview/estado no se
  recuperaron. Pendiente siguiente: validar Vehicle con el usuario y diseñar
  cálculos persistidos/proyecciones de colecciones sólo al retomar ese alcance.

- 2026-11-12: revertidos los componentes ModelPreviewImage y ModelReactionStatus:
  eliminado su archivo compartido y retiradas referencias en VehicleForm y la demo
  de reacciones. Se conservaron los cambios locales de formato del formulario,
  el motor/contexto de reacciones, las reglas de Vehicle y su contrato generado.
  El preview del fabricante sigue calculándose pero ya no se muestra en Vehicle.
  Guía y reglas de continuidad actualizadas. TypeScript y ESLint de ambos
  consumidores aprobados; sin nueva prueba visual, SQL ni cambios en BD.

- 2026-11-11: el instalador permite ampliar String VARCHAR(n) a un límite mayor
  conservando todos los demás atributos; las reducciones y otros cambios siguen
  bloqueados. Caso real: el usuario cambió FlotaModelo.name de 5 a 120 y orm:sync
  se detenía en la comprobación aditiva. Se corrigió el framework, sin editar el
  esquema instalado ni hashes manualmente. Plan `orm:install -- flota --update`
  comprobado sin --write: propone sólo ALTER TABLE flota_modelo ALTER COLUMN name
  SET DATA TYPE VARCHAR(120). No se ejecutó SQL, migración ni generación de cliente.
  Tres pruebas de evolución, TypeScript y ESLint aprobados; cubren ampliación
  requerida/opcional y rechazos de reducciones, cambios de nulabilidad, defaults,
  mapeos y textos que sólo contienen una apariencia de atributo Prisma.
  Próximo paso del usuario: repetir orm:sync -- flota y revisar/aprobar el SQL.

- 2026-11-11: presentación de Many2one en colecciones y encabezados agrupados.
  `resolveListLabels` reutiliza proveedores autorizados por lotes, conserva IDs
  y publica sólo nombres auxiliares. El scaffold conecta el `--lookup` también
  a listRecords/loadKanban; Modelo quedó conectado al lookup de Fabricante.
  `groupedPage` incluye groupField y los grupos admiten label independiente de
  value: no se fusionan IDs con nombres iguales. Selection muestra sus opciones
  también en tabla y grupos. ListView/vista rápida/CardView/Kanban comparten la
  presentación; no se amplió búsqueda/orden por etiquetas ni rutas agrupables.
  Contratos en [Colecciones](vistas-colecciones.md) y [Agrupación](agrupacion-listas.md).
- Verificaciones de esta corrección: 18/18 pruebas de etiquetas, agrupación y
  servicio, TypeScript, ESLint y diff-check aprobados. Comprueban grupos anidados, página de grupos,
  nombres iguales, null, referencia ausente, permisos/errores y claves intactas.
  En el trabajo inmediatamente anterior pasaron también 10/10 del scaffold,
  incluida compilación de vistas Many2one con lookup explícito en proyecto temporal;
  esta corrección sólo amplía el resolvedor compartido y el DTO/render de grupos.
  La comprobación visual anterior se detuvo porque Computer Use no pudo determinar
  la URL del navegador; no afirmar validación visual nueva. No se ejecutó SQL ni
  se modificaron datos del ERP. Siguiente paso: recargar la lista agrupada de Modelo
  y confirmar «Fabricante: Volkswagen» en el encabezado.

- 2026-11-11: `displayFields` admite rutas Many2one de hasta tres saltos, como
  `fabricante.name`, con método `displayName` síncrono. El generador verifica
  destinos del mismo perfil, publicación explícita y ausencia de sensibles en
  cada salto. Los bindings cargan proyecciones anidadas por página/lote; sólo
  ID/label sale del servicio. Relaciones vacías y copias anidadas congeladas
  soportadas. Agregar rutas exige `orm:bind` o `orm:sync`; no cambia SQL por sí
  solo. Contrato y límites en [Nombres de presentación](nombres-presentacion.md).
  La demo RHF/Zod ficticia `/sample#model-display-name` muestra fabricante y
  relación vacía; no se editó ni sincronizó la aplicación Flota durante esta mejora.
- Verificación de esta mejora: 10/10 pruebas específicas de displayName aprobadas,
  incluyendo privacidad, permisos/sesión, adaptadores anteriores, tres saltos y
  compilación de bindings con un Prisma Client real generado en un proyecto
  temporal sin conexión a BD. `test:scaffold` 10/10, `tsc --noEmit`, ESLint de los
  archivos afectados y `git diff --check` aprobados. No se comprobó esta demo
  nueva en navegador ni se ejecutaron migraciones o consultas contra el ERP.
- Suites amplias de esta sesión: `test:orm` 44/45 aprobadas antes de añadir las
  dos últimas pruebas (después aprobadas en la suite específica); queda el fallo
  histórico EPERM al crear un symlink de archivo en Windows, incluso fuera del
  sandbox. `test:orm:install` dentro del sandbox: 9/14; sus cinco fixtures fallan
  al crear symlinks de directorio. No presentar estas suites completas como aprobadas.
  Próximo paso de tutoría: declarar las dependencias en el modelo que el usuario
  elija y regenerar el binding cuando sus modelos/esquema estén sincronizados.

- 2026-11-11: aplicada la presentación compacta a CardView y al header compartido
  con KanbanView. Retirado bloque visible de icono/título/descripción/contador;
  title sigue accesible y los totales quedan en footer/columnas. Breadcrumbs
  opcionales y controles/acciones comparten barra; Fabricante los configura y
  scaffold nuevo los incluye en card/kanban. CardView usa padding exterior 8/12px
  y gap 8px; tarjeta predeterminada con padding 12px, sin detalles vacíos ni fila
  de apertura duplicada bajo el título enlazado. renderCard personalizado conserva
  su acceso adicional. Skeleton adaptado; filtros y búsqueda permanecen explícitos.
  Verificados TypeScript, ESLint de archivos afectados, build, dos pruebas existentes
  de vistas y prueba focalizada de plantillas. Navegador en /sample#image-collections:
  header de unos 49px, padding 12px y gap 8px en escritorio; búsqueda devuelve una
  tarjeta y limpiar restaura tres, filtros abren/cierran. A 375px, CardView mide
  318px sin overflow, usa una columna y Actualizar comparte fila con Filtros.
  Viewport restaurado y servidor temporal detenido. Revisión con datos ficticios
  del componente compartido; no se abrió Fabricante autenticado ni se escribieron
  registros, modelos o migraciones. Guía docs/vistas-colecciones.md actualizada.

- 2026-11-11: completadas miniaturas compartidas para ListView/vista rápida,
  CardView y KanbanView (tarjeta por defecto). widget image con sm/md/lg y
  rounded/squared, validación HTTPS, carga directa lazy sin referrer y fallback
  accesible al faltar/fallar. El servicio sólo lo admite para Image no sensible
  en columnas autorizadas; legacy no amplía whitelist. Scaffold genera esas
  columnas sin filtro/orden de URL por defecto y controles FieldImage.
  orm:generate/orm:sync generan uploaders y acciones admin bajo
  src/generated/orm/uploads con hashes y preflight; --check/--plan los incluyen.
  create:app los prepara inicialmente. Agregar Image a un modelo existente
  actualiza el helper sin tocar vistas; mapas vacíos revocan campos retirados.
  Configuración privada y defaults públicos centralizados; preset firmado
  opcional se incluye en la firma. Aplicado a Fabricante conservando avatar
  squared y personalizaciones: formulario usa imageUploads.avatar, lista añade
  miniatura squared/sm, acción anterior delega por compatibilidad. No se cambió
  su modelo ni se aplicó SQL sobre la base real; migrate status confirmó 14
  migraciones al día. La generación local de Flota pasó --check sin diferencias.
  Verificados TypeScript, ESLint de archivos afectados/generados, build producción,
  test:images (11), uploaders gestionados (2), sync (3), agrupación/servicio (12),
  vistas (2), selección (8) y scaffold completo (10). La primera ejecución de
  scaffold tuvo EBUSY al limpiar un fixture Windows; se corrigieron tiempo de
  espera del compilador y reintentos de limpieza. También se hicieron portables
  sus junctions/rutas/entrypoint TS, sin desactivar pruebas de enlaces.
  Integración PostgreSQL temporal aprobada: sync añade Image a modelo existente,
  conserva registro/formulario, genera helper y compila recurso/vistas; cubre
  persistencia, permisos, revisiones e historial. Recursos temporales eliminados.
  Navegador de producción en /sample#image-collections: nueve miniaturas, tres
  imágenes cargadas y seis fallbacks (ausencia/error), forma squared de radio 0,
  apertura/cierre de vista rápida y tarjetas; no se subieron archivos reales ni
  se probaron escrituras sobre Fabricante. Servidor temporal detenido al terminar.
  La limpieza remota no se implementa sin inventario/referencias; su contrato y
  aceptación están en [Limpieza de imágenes](ideas/limpieza-imagenes.md).

- 2026-11-11: diagnóstico de orm:sync detenido ante la retirada histórica de
  Fabricante. Se revisaron las tres migraciones y el historial/ausencia de tabla
  en transacción RepeatableRead de sólo lectura. Mejorado el error para mostrar
  SQL y nombre de la migración bloqueada sin relajar assertSyncSQL. Tres pruebas
  de sync y ESLint aprobados; TypeScript global falla por avatar ya generado en
  contrato y todavía ausente del binding, tras la sincronización incompleta del
  usuario. No se ejecutaron deploy, migraciones nuevas ni regeneración de bindings.

- 2026-11-11: implementado Fields.Image con folder explícito y metadata escalar,
  validación HTTPS compartida, defaults/null/inferencia, límite 2048 y Prisma
  String/VarChar. Generador de contratos y create:views reconocen Image: formulario
  FieldImage, uploader firmado y acción admin con modelo/publicación fijados en
  servidor. Helper de firma SHA-256 por solicitud, ID aleatorio sin sobrescritura,
  formatos jpg/png/webp y modo dynamic/asset_folder o fixed/folder. Se conservan
  uploaders unsigned/manuales de Partner; no se convirtió Fabricante ni avatarUrl.
  FieldImage añade shape rounded/squared conservando style CSS; las demos de
  imagen/avatar usan Fields.Image, RHF/Zod, firma autorizada y selector de forma.
  Contrato/configuración/límites en [Campos de imagen](ideas/campos-imagen.md).
  Verificados test:images (11), TypeScript, ESLint de archivos afectados, build
  de producción e integración PostgreSQL temporal. La integración cubre rechazo
  de URL inválida, guardar/reabrir URL, cambios auditados de imagen, modelo/vistas
  generados compilables y permisos existentes. Proyecto/esquema temporal eliminados;
  no se migró ni modificó el ERP. Transporte Cloudinary simulado: firma, carpeta
  fija/autorización por llamada, secretos fuera del resultado, progreso, fallos,
  compatibilidad unsigned y cancelación repetida/antes/durante la petición.
  Navegador de producción en /sample: image rounded (radio 4px) / squared (0),
  avatar circular / squared (0) y validación de imagen obligatoria vacía.
  Sin subida real: faltan las credenciales privadas de firma; el cloud name público
  ya existe. El servidor temporal de revisión se detuvo.
  Suites completas fuera del sandbox: test:orm 38/39 (symlink de archivo EPERM),
  test:scaffold 7/10 (dos fixtures con symlink EPERM y aserción de ruta con / en
  Windows), test:orm:install 7/12 (fixtures con symlink EPERM). No se presentan
  como suites aprobadas. La prueba CLI de recurso con Image sí compiló y pasó.
  El primer build en sandbox quedó sin progreso y se interrumpió; el build
  posterior fuera del sandbox pasó. No se desactivaron protecciones de enlaces.

- 2026-11-11: FieldText unifica variantes bajo `widget`: text por defecto,
  password, long, phone y email. Se retiran type y widget=input de la API pública;
  el componente deriva internamente el tipo HTML. Migrados login, Usuarios,
  cambio de contraseña de Perfil y muestra de password. Conservados revelado
  accesible, formato phone al blur, textarea, RHF y autocomplete off. Email usa
  type/inputMode email sin transformar contenido; nuevo ejemplo RHF/Zod en
  `/sample#field-text-email`. Contrato en
  [FieldText](../src/components/ui/form/FieldText.md). No se infieren widgets por
  nombre de campo ni se cambian modelos/scaffold: Text generado sigue usando
  la variante por defecto. Verificados TypeScript, ESLint de archivos afectados,
  pruebas phone (2), test:auth (9) y diff --check. Sin build ni revisión de navegador.

- 2026-11-11: política de contraseñas nuevas unificada en
  `src/schemas/password.schema.ts`: mínimo 4 y máximo 8 caracteres, libres de
  requisitos de símbolos/mayúsculas y sin transformar su contenido. Usuarios
  (alta/cambio) y Perfil reutilizan el esquema en cliente/servidor; contraseña
  vacía al editar conserva el hash. Login/contraseña actual aceptan credenciales
  anteriores bajo el límite existente de 72 bytes para no bloquear cuentas.
  Actualizados mensajes UI, fixtures y [Autenticación](authentication.md).
  Verificados test:auth (9), test:contacts (8), TypeScript y ESLint de archivos
  afectados. Cubiertos límites 3/4/8/9, valores sin símbolos/mayúsculas, confirmación,
  conservación al editar y compatibilidad de login anterior. No se modificaron
  credenciales reales ni se ejecutaron seed, migraciones, integración BD o navegador.

- 2026-11-11: FieldText añade `widget="phone"` para teléfonos mexicanos. Usa
  type/inputMode tel y formatea al perder foco: diez dígitos, con prefijo 52/+52
  opcional y separadores habituales, se convierten a `+52 33 2165 9874`.
  Actualiza RHF/onChange antes de onBlur; conserva texto incompleto/inválido para
  validación y respeta readOnly. Helper puro reutilizable y contrato en
  [FieldText](../src/components/ui/form/FieldText.md). Demo RHF/Zod obligatoria
  en `/sample#field-text-phone`, con normalización también al enviar.
  No se cambiaron formularios de las aplicaciones ni validaciones de Partner.
  Verificados dos tests de formato/validación (prefijos, separadores, idempotencia,
  vacíos, extensiones y entradas inválidas), ESLint de archivos afectados y
  TypeScript. El primer tsc detectó Prisma Client local sin Fabricante: se
  regeneró con db:generate y la segunda comprobación pasó. No se aplicaron
  migraciones ni se comprobó persistencia; sin nueva revisión visual o build.

- 2026-11-11: puesta en contexto en Windows leyendo AGENTS.md, README, estado,
  guías de modelos/vistas e imágenes, Git y fuentes/artefactos de Flota. Árbol
  limpio al inicio en `340be8e`. Detectado y corregido el resumen obsoleto de
  Fabricante retirado. Inspección de archivos únicamente; no se ejecutaron suites,
  generación, migraciones ni comprobaciones de servidor/base local. Las pruebas
  anteriores siguen siendo evidencia histórica de sus respectivos alcances.

- 2026-11-10: retirada de Fabricante solicitada para probar el scaffold desde cero.
  Copia de 11 archivos de la práctica y snapshots compartidos/gestionados en el
  respaldo local indicado arriba. Retirados clase, registro, UI y conectores;
  restauración coordinada de snapshots versionados y regeneración con herramientas.
  Verificada tabla con cero filas y ninguna FK entrante antes de preparar la
  migración inversa; sólo esa migración estaba pendiente y db:deploy la aplicó.
  No se borraron migraciones anteriores ni datos de vehículos. El SQL aborta si
  aparecen filas antes del DROP. Comprobaciones: Prisma Client regenerado,
  orm:generate --write sin diferencias, orm:bind --write compilado, adaptador de
  vehículos idéntico al previo, next typegen, TypeScript, ESLint de configuración,
  migrate diff sin diferencias y create:model -- flota Fabricante --dry-run aprobado.
  No se recreó Fabricante ni se repitió build/revisión visual en esta retirada.

- 2026-11-10: implementados create:model y create:views. Registro de modelos y menús
  con edición de AST sobre literales, sin reescribir personalizaciones; preflight,
  colisiones, nombres globales, symlinks, staging y lock compartido con create:app.
  Las vistas usan servicios/acciones existentes, RHF/Zod, loader, guards, historial,
  notas y mutaciones autorizadas. Selection comparte opciones desde el contrato
  cliente. Kanban necesita Selection requerido; Many2one custom requiere proveedor
  async explícito. Los comandos rechazan partial/sensitive y archivos existentes.
  No se ejecutaron create:model/create:views con escritura ni SQL sobre Flota;
  --dry-run de Fabricante confirmó rechazo de su ruta existente. Sus fuentes de
  aplicación se conservaron; sólo se añadió documentación a su README.
  Verificaciones: TypeScript, ESLint, scaffold (10 pruebas) y SQL aislado con el modelo Trabajo
  en la aplicación temporal Facil. Cubrió lista/card/kanban/modal compilables,
  creación/lectura/auditoría/borrado/movimiento autorizado, recarga de rutas, rechazo
  de no-admin, dry-run, conservación de fuentes y recuperación de sync. Recursos
  temporales eliminados. Build del proyecto actual aprobado.
  Límite: el intento de build del proyecto temporal agotó 90s después de completar
  sus comprobaciones SQL/TS; no se presenta como build aprobado de las vistas de
  prueba. La integración normal final pasó y el build del checkout actual pasó.
  No se realizó revisión visual nueva del modal en navegador.

- 2026-11-10: añadido `npm run orm:sync -- id` para reunir el flujo de desarrollo
  en una sola invocación interactiva. Detecta instalación/actualización aditiva,
  genera fuentes, revisa historial y SQL pendiente global, solicita escribir aplicar,
  prepara migraciones nuevas sólo si hay diferencias, genera cliente/bindings y
  comprueba TypeScript. --plan sólo revisa fuentes, sin escrituras ni consulta BD.
  Sin --yes/reset/push/seed; detiene pasos posteriores al error y no promete rollback
  global. Guía en [Sincronizar aplicaciones](sincronizar-aplicaciones.md), README
  raíz, README de Flota y plantilla de README actualizados sin reemplazar tutoría.
  No se ejecutó sync con escritura en Flota: allí sólo se verificó --plan.
  Verificados TypeScript, ESLint, instalación/generador (12), scaffold (5) e
  integración PostgreSQL desechable: cancelación sin aplicar SQL, continuación,
  evolución aditiva conservando registros, error de TS y repetición sin cambios.
  Recursos temporales eliminados. Reforzada la configuración explícita del schema
  temporal en los subprocesos de integración para no heredar una URL ajena.
  No se repitió build ni revisión visual para esta CLI de desarrollo.
  La siguiente tarea de Fabricante sigue siendo su configuración de lista/servicio;
  sus pasos de esquema, migración, cliente y binding ya se completaron.

- 2026-11-10: aplicadas las tres simplificaciones propuestas: normalize síncrono
  antes de Zod, ModelContext<T>.previous readonly (null al crear) y createQueryActions
  para compartir autorización por llamada y manejo de errores de consultas.
  Scaffold mantiene exports async explícitos y mutaciones/invalidation propios.
  Las clases/acciones actuales de Flota se conservaron para tutoría; ya pueden
  adoptar los contratos cuando se explique el ejercicio. No requiere migración,
  regeneración de bindings ni generar/instalar Fabricante.
  Guía y ejemplos en [Ciclo de modelos](ciclo-modelos.md).
  Verificados TypeScript, ESLint, test:orm (36), test:scaffold (5), build e integración
  PostgreSQL temporal. Cubre normalización antes de validar, snapshot en hooks,
  kanban, campos falsificados, revisión obsoleta, autorización por consulta,
  tracking/rollback y compilación del scaffold. Proyecto/esquema temporales eliminados;
  no hubo escrituras ni migraciones sobre datos del ERP ni revisión visual nueva.

- 2026-11-10: implementación de displayFields/displayName en modelos y lookup
  autorizado en el servicio, con proyección escalar y publicación sólo de ID/label.
  FieldMany2One admite load sin plantilla en la vista; sugerencias, modal e ID
  inicial usan el mismo proveedor. Scaffold añade lookupRecords; ejemplo ficticio
  RHF/Zod en `/sample#model-display-name`. Contrato, compatibilidad y propuestas de
  simplificación en [Nombres de presentación](nombres-presentacion.md).
  No se generó/instaló Fabricante ni se alteraron archivos de aplicación por esta
  mejora. El usuario ya completó clientFields y manifest antes de solicitarla.
  Se regeneró Prisma Client local porque aún no reflejaba RecordActivity; no se
  aplicaron migraciones locales.
  Verificaciones: TypeScript, ESLint, test:orm (33), test:orm:install (9),
  test:scaffold (5), integración PostgreSQL aislada y build aprobados.
  Integración ampliada con búsqueda por palabras, resolución por ID/lote, etiqueta
  compuesta y rechazo de configuración falsa/no-admin; recursos temporales eliminados.
  No se realizó revisión visual nueva en navegador. El primer build se interrumpió
  tras quedar sin progreso en sandbox; la ejecución fuera de sandbox pasó.
  Corregidos dos problemas de pruebas: conteo fijo obsoleto de acciones del scaffold
  (ahora comprueba autorización por acción) y ruta temporal no canónica en macOS
  (sin relajar protección de symlinks). Las limitaciones Windows anotadas abajo son
  históricas; esta ejecución en macOS no demuestra su resolución en Windows.

- 2026-11-10: puesta en contexto mediante AGENTS.md, README, este documento,
  guías de flujo/actividad/agrupación, historial Git y archivos de Flota.
  Árbol limpio al comenzar. Contrastados historial/notas y agrupación con código;
  detectada y documentada la fase inicial de Fabricante, ausente de este resumen.
  RecordForm contiene actualmente un solo FormGroup; las menciones de dos o tres
  grupos más abajo describen verificaciones históricas. Esta revisión sólo modifica
  documentación y verifica `git diff --check`; no ejecuta pruebas, migraciones,
  generación ni comprueba el servidor o la base de datos local.

- 2026-11-10: Fields inline usan columna de label de 7rem (112px) y gap de
  8px en field.styles.ts, sustituyendo proporción 1:2 y gap de 12px. Alineación
  izquierda/centro vertical y texto multilínea conservados; sin cambios en Fields
  block o sin label. TypeScript y ESLint aprobados. Navegador en `/sample#field-text`:
  label de 112px y gap de 8px en escritorio y a 375px, sin overflow del Field.

- 2026-11-10: FormGroup deja de expandirse automáticamente cuando es el único
  hijo (retirada only:col-span-full). Por defecto ocupa una columna; fullWidth
  sigue reservando toda la fila explícitamente. En móvil usa la única columna.
  ESLint del componente aprobado; ajuste CSS sin nueva prueba de navegador.

- 2026-11-10: retirado el límite max-w-5xl/7xl de la hoja en FormView page,
  que dejaba espacio vacío antes de la auditoría en pantallas amplias. Ahora ocupa
  todo su panel; los límites normal/wide se conservan sólo en content. Mantiene
  máximo dos columnas, gap de 8px y apilado móvil. TypeScript y ESLint aprobados.
  Navegador en `/sample#record-audit`: maxWidth none y hoja ocupando el ancho
  interior del panel, dos columnas; a 375px una columna, sin overflow horizontal.
  La demo tiene su propio ancho máximo exterior; no se midió Flota autenticada.

- 2026-11-10: separación entre FormGroup de FormView reducida de 16px a 8px
  en ambos ejes (`gap-2`). Conserva las dos columnas adaptables y el padding
  interior de los grupos. ESLint del componente aprobado; cambio de clase CSS,
  sin nueva comprobación de navegador.

- 2026-11-10: verificación del grid compartido en `/sample#form-view` con tres
  grupos: viewport de 1280px produce exactamente dos columnas de unos 491px;
  viewport de 375px produce una columna de unos 302px sin overflow horizontal.
  Flota contiene ahora tres FormGroup sin fullWidth: el tercero pasa a la segunda
  fila. No se cambió el grid. La ruta de Flota requiere sesión en este navegador;
  la medición se hizo en la demo del mismo FormView, sin acceder a datos reales.

- 2026-11-10: corregida la disposición de los dos FormGroup actuales de Flota:
  ambos declaraban fullWidth y por eso ocupaban filas completas. Se retiró esa
  opción en ambos, conservando sus campos y la grilla compartida de máximo dos
  columnas (una en anchos pequeños). Contrato de fullWidth aclarado en FormView.md.
  TypeScript y ESLint de RecordForm aprobados; sin nueva prueba de navegador.
  Los dos grupos repiten actualmente los mismos campos RHF, como en el código
  del usuario; no constituyen registros independientes.

- 2026-11-10: hoja de campos de FormView alineada a la izquierda, retirando
  mx-auto y reduciendo el padding exterior de 16/24px a 8/12px. Se conservan
  anchos normal/wide, padding interior de FormGroup y columna de auditoría.
  TypeScript y ESLint del componente aprobados; en `/sample#record-audit` el
  navegador confirmó margen cero de la hoja, separación de 12px y ausencia de
  overflow horizontal. Ajuste compartido, sin modificar formularios de aplicación.

- 2026-11-10: FormView adopta el header compacto: elimina icono, título,
  descripción y badge visibles; conserva título accesible, breadcrumbs, acciones,
  statebar y estado del footer. Props icon/description aceptadas por compatibilidad
  y excluidas del HTML. TypeScript y ESLint del componente aprobados. En
  `/sample#record-audit` se comprobó la presentación estrecha y el header a 1280px
  sin overflow horizontal; la acción adicional de la demo conserva su fila.
  Cambio visual sin modificar guardado, validación, navegación ni auditoría.

- 2026-11-10: header de ListView compactado eliminando el bloque visible de icono,
  título, contador y descripción. Breadcrumbs y controles comparten fila en escritorio;
  skeleton adaptado y title conservado para accesibilidad. Total disponible en footer,
  description/icon aceptados por compatibilidad. Navegador en `/sample`: header de
  unos 57px; a 375px, breadcrumbs/controles y agrupación se adaptan sin overflow.
  TypeScript, ESLint de los tres componentes y `git diff --check` aprobados.
  Ajuste visual; consultas, selección y acciones conservan sus contratos.

- 2026-11-10: compactadas las filas de registros de ListView, incluidas las hojas
  agrupadas: padding vertical reducido de py-4 a py-2; skeleton ajustado. Conserva
  avatares, casillas, texto multilínea y encabezados. ESLint de ambos archivos y
  `git diff --check` aprobados. Navegador en el ejemplo de auditoría: padding de
  8px por lado y filas con avatar de unos 48px. No cambian datos ni consultas.

- 2026-11-10: con actividad, FormAuditPanel elimina el resumen superior redundante
  y sitúa las notas arriba; sin actividad conserva la auditoría básica. FormActivity
  muestra PartnerAvatar junto al autor de cada evento, con fallback de iniciales.
  Verificado en `/sample#record-audit`: resumen ausente, una sola cabecera,
  publicación de nota y avatar alineado con el autor. TypeScript, ESLint de ambos
  componentes, dos pruebas existentes de avatar y `git diff --check` aprobados.
  Ajuste de presentación; no cambia consultas, permisos, datos ni refresco.

- 2026-11-10: simplificada la creación a «Registro creado» con autor/fecha, sin
  snapshot ni lista de campos iniciales. Las entradas antiguas de creación ocultan
  sus valores al consultar y renderizar; no se reescribieron datos históricos.
  Sólo las ediciones guardadas muestran diferencias anterior/nuevo. Retirado el
  sondeo de veinte segundos: se consulta al abrir, tras guardar/publicar notas o
  por acciones manuales. No se necesitan migraciones ni regenerar adaptadores.
- Verificación de este ajuste: TypeScript, ESLint de los archivos modificados y
  cinco pruebas de actividad aprobados. Navegador en `/sample#record-audit`:
  creación compacta, historial intacto al escribir y diferencias tras Guardar.
  Integración PostgreSQL temporal aprobada, incluida creación sin valores almacenados
  y comparación de ediciones después de hooks; recursos temporales eliminados.
  No se repitió build para este ajuste.

- 2026-11-10: implementada actividad compartida (creación, cambios y notas), opciones
  tracking/sensitive de Fields, acciones/servicio, FormActivity y conexión de Flota y
  scaffold. Migración `20261110213022_record_activity` creada sin aplicar, revisada
  (sólo tabla/índices/FK), aplicada a la base local; Prisma Client y artefactos de
  Flota sincronizados. No se escribieron notas ni registros reales para probarlo.
- Verificación de la implementación inicial: TypeScript, ESLint completos y build de producción aprobados; pruebas focalizadas
  de modelo/actividad/contratos/servicio (17), selección (8) y vistas (2) aprobadas.
  `test:orm` tiene 27/28 aprobadas: la restante sigue fallando por EPERM al crear
  un symlink de archivo en Windows. No se omite ni se presenta como suite aprobada.
- Integración PostgreSQL temporal aprobada: actividad después de hooks, notas sin
  cambiar revisión, idempotencia, rechazo de actor/modelo falsificados, privacidad,
  lectura por cursor, permisos, aislamiento, carrera de guardados, kanban, rollback
  incluso ante fallo posterior y rechazo del acceso tras borrar el registro.
  Proyecto/esquema temporales eliminados y scaffold completo compilado.
- Navegador en `/sample#record-audit`: nota literal (HTML escapado) sin ensuciar RHF,
  confirmación al salir con borrador, anterior/nuevo al guardar, conservación de nota
  sin publicar al guardar campos. Columna de 384px y alto igual al body; a 375px se
  apila sin overflow horizontal. Se renovó el dev del proyecto tras generar Prisma.

Comprobaciones anteriores a la actividad (históricas para esos alcances):

- 2026-11-10: ajustada la presentación compartida de FormView/FormAuditPanel a una
  columna derecha continua que cubre el alto del body, sin tarjeta flotante; scroll
  independiente en escritorio y disposición apilada en móvil. Se mantienen datos y
  comportamiento de auditoría/RHF. TypeScript, ESLint de ambos componentes y
  `git diff --check` aprobados. Navegador en `/sample#record-audit`: alto del aside
  igual al body en escritorio (295px en el ejemplo); a 375px, una columna con borde
  superior y scroll compartido. No se modificaron archivos de Flota, modelos ni
  adaptadores para este ajuste. Se usó el dev existente; no se inició otro servidor.

- 2026-11-10: implementados contrato, UI, adaptador generado, ejemplo público ficticio
  y documentación de agrupación. Filas reutilizadas entre tabla normal y agrupada;
  recarga tras borrar incluso si la rama se cierra con una petición en curso.
- TypeScript, ESLint y build de producción aprobados. `test:list-grouping` (11), `test:list-selection` (8)
  y pruebas de filtros/consulta (23) aprobados. Integración PostgreSQL del framework
  aprobada con proyecto/esquema temporales: persistencia, tres niveles SQL, valores
  opcionales, dominios, filtros, permisos y revisiones. Los recursos se eliminaron;
  no se migraron ni modificaron registros reales del ERP.
- Navegador: tres niveles Activo → Asegurado → Disponible con conteos 48 → 16 → 12,
  segunda página de la hoja con dos registros, selección de diez filas y limpieza
  al cambiar página, filtro Activo=No (48) y limpieza del filtro (96) conservando
  los tres niveles en la URL. Revisión visual realizada con datos ficticios.
- Ajustes de portabilidad necesarios para esa integración en Windows: junction de
  dependencias y ejecución de los entrypoints de Prisma/TypeScript con Node.
  Hashes gestionados toleran CRLF de Git, conservando rechazo de cambios de contenido
  e inversas duplicadas; dos pruebas específicas aprobadas. No se borraron hashes.
- `test:orm`: 24/25 aprobadas fuera del sandbox; la restante requiere crear un
  symlink de archivo y falla con EPERM de Windows. `test:scaffold`: 1/3 aprobadas;
  dos fixtures requieren symlinks de directorio y fallan con EPERM. No presentarlas
  como suites aprobadas. El flujo completo se comprobó con la integración aislada.
- Se restauró el árbol exacto de dependencias del lockfile versionado, tras detectar
  `@dnd-kit/core` ausente y un desajuste del compilador CSS durante la reparación.
  El error CSS quedó resuelto con las versiones fijadas; `/sample` respondió 200 y
  dev se reinició en localhost:3000. Los cambios previos de `package-lock.json`
  se conservaron byte por byte. No se realizaron commit/push/pull.
- El estado de los procesos es local; no asumir que dev continúa en ejecución
  al retomar el proyecto en otra sesión o máquina.
- 2026-11-10: registrada como pendiente, sin implementación, la agrupación por
  rutas Many2one/uno a uno, incluso de varios saltos, con claves de identidad y
  etiquetas autorizadas. Alcance y aceptación en [Agrupación](agrupacion-listas.md#pendiente-agrupación-por-rutas-de-relaciones).
  Esta anotación sólo cambia documentación; verificada con `git diff --check`.
  Las pruebas de código anteriores son históricas y no se repitieron para esta nota.

## Oportunidades de mejora pendientes

- **Unificar escrituras de eject:view:** el comando aún tiene su propia secuencia
  de creación/edición/restauración, mientras los nuevos generadores reutilizan
  `writeResource`. Motivo: compartir preflight, lock y rechazo de cambios
  concurrentes. Aceptación: conservar vistas y comentarios personalizados,
  `--dry-run` sin escrituras, rechazo de enlaces y restauración ante fallos
  ordinarios, sin reescribir el manifest entero. Pendiente independiente,
  sin implementación en esta tarea.


- **Revisión de Fabricantes/CardView**, registrada por petición expresa el
  2026-11-12. Pendientes sin implementación; priorizar logos y decisión de auditoría:
  1. **Logos sin recortes:** evaluar contain/padding en miniaturas y proporción
     del editor, frente a object-cover y avatar 1:1. Aceptación: logos cuadrados y
     rectangulares completos, sin deformación y sin alterar los avatares existentes;
     documentar opciones y comprobar los ejemplos de formulario/colecciones.
  2. **Auditoría del logo:** decidir activar tracking:true en Fabricante.logo.
     Aceptación: cambios de URL guardados aparecen en historial, sin eventos por
     borradores/cancelaciones ni snapshot de campos en creación. No implica borrar
     archivos remotos, cuya limpieza conserva su pendiente independiente.
  3. **Fabricantes inactivos:** decidir indicador visual y/o filtro de active en
     CardView. Aceptación: distinguir activos/inactivos y consultarlos con política
     de servidor; no imponer un dominio que oculte registros sin decisión de negocio.
  4. **Breadcrumbs adaptables:** revisar basis-48 del contenedor compartido.
     Aceptación: aprovechar el ancho de escritorio para evitar saltos innecesarios,
     conservando texto completo, wrap móvil y espacio para búsqueda/acciones.
  5. **Limpieza de la vista:** retirar imports sin uso de ListView, deleteRecords
     y recordFields en FabricanteList, y reutilizar recordSearchFields existente.
     Aceptación: ESLint sin esos avisos y mismo comportamiento de CardView,
     navegación, búsqueda y permisos; no retirar acciones de servidor por estar
     ausentes de esta vista.
  Esta anotación sólo modifica documentación; no autoriza ejecutar estos cambios
  por adelantado durante la tutoría. Verificación de la nota: git diff --check.

- **Simplificar relaciones y vistas**, registrado el 2026-11-11, sin implementación:
  incluye también Fields de formulario enlazados al contrato cliente del modelo
  para heredar etiqueta, required, maxLength, opciones y lookup configurado,
  manteniendo componentes y props explícitos. Control automático FormView.Field
  sólo como alternativa posterior por evaluar.
  ampliado con columnas JSX `ListView.Field` dentro de la vista, `foo.list.ts`
  opcional y política de consultas independiente fijada en el servidor.
  Conservar `columns` y personalizaciones; los hijos JSX no conceden permisos.
  priorizar proveedores lookup por convención y etiquetas centralizadas en el
  servicio. Después evaluar presentación derivada de Fields, tipado de
  displayName y propuestas de actualización de vistas que preserven
  personalizaciones. Motivo, orden y criterios de aceptación en
  [el pendiente específico](ideas/simplificar-relaciones-y-vistas.md).
  Esta anotación sólo modifica documentación; verificada con `git diff --check`.
  Próximo paso al retomarlo: diseñar los dos primeros puntos con ejemplos de
  código antes/después; no se inicia su implementación con esta anotación.

- **Retirada segura de archivos remotos:** falta inventario de assets y referencias
  de todos los consumidores. Motivo: no se puede deducir propiedad/ausencia de uso
  de una URL al quitarla de un formulario. Alcance y aceptación en
  [Limpieza de imágenes](ideas/limpieza-imagenes.md); sin borrado automático hoy.
- Evaluar si declarar nuevas listas con dominio requiere demasiados cambios entre
  servicio, acción, variante, página y menú. Motivo: el ejercicio muestra pasos
  repetitivos. Criterio de aceptación: reducir código o pasos conservando TSX
  editable, autorización de servidor, tipado, manejo de errores y personalizaciones.
  Es una oportunidad por estudiar; no hay una API nueva decidida ni implementada.
- Implementar agrupación por rutas Many2one/uno a uno autorizadas en servidor,
  incluidos varios saltos. Motivo: agrupar por creador u otras entidades mostrando
  etiquetas legibles sin mezclar identidades con nombres iguales. Criterios y
  exclusión inicial de One2many/Many2many en [el pendiente de agrupación](agrupacion-listas.md#pendiente-agrupación-por-rutas-de-relaciones).
- Evaluar agrupaciones por periodos de fecha con un contrato de zonas horarias,
  claves y consultas autorizadas. Criterio: preservar conteos SQL, ramas paginadas
  e igualdad exacta sin descargar el dataset completo.
- Completar portabilidad de fixtures con symlinks en Windows sin desactivar pruebas
  de protección de enlaces ni requerir privilegios del sistema para pruebas comunes.

## Mantenimiento

Al cerrar una tarea, actualizar lo completado, evidencia de comprobación, pendientes
y siguiente paso; trasladar decisiones duraderas a AGENTS.md y detalles a sus guías.
Compartir estos archivos junto con el código mediante Git cuando el usuario lo
indique. No copiar secretos, datos del ERP ni identificadores de procesos locales.
