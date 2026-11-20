# Estado del proyecto

Última actualización: 2026-11-20.

Documento de continuidad entre agentes y máquinas. Leer primero [AGENTS.md](../AGENTS.md)
y [README](../README.md); contrastar este resumen con Git y el código relevante.
Actualizar el estado vigente, evitando acumular una transcripción de sesiones.

## Progreso guardado (2026-11-20, punto de continuación)

### Cierre vigente: País, Estado y Municipio operativos (2026-11-20)

Rama `codex/importexport`, HEAD `d48aef1` (Merge branch codex/partner). Todo lo de
importación/exportación, Municipio y el arreglo de orm:sync sigue **sin commit**
(~50 rutas), incluidas tres migraciones nuevas: `20261120210000_list_transfer_permissions`,
`20261120223000_estado_country_code_unique` y `20261120223001_sync_ubicaciones`.
Las tres están aplicadas en desarrollo Windows (`migrate status` al día); no asumirlas
en otra máquina. Commit/push los hace el usuario. El maxRows 100 de País es suyo.

**Completado:**

- ListView estándar: plantillas, importación/exportación Excel/CSV, permisos
  import/export por grupo/modelo, revisión por fila + simulación del lote con
  rollback, plan firmado y aplicación atómica.
- País (`codigo`) y Estado (País+código, `paisId.codigo`): confirmados por el usuario.
- Municipio (fase 3): referencias Many2one con clave compuesta del destino y saltos
  anidados (máx. 2): columnas `estadoId.paisId.codigo` + `estadoId.codigo`. El usuario
  declaró `uniqueTogether` y `transfer`; índice único aplicado; integración temporal
  completa («✓ Municipio») y probado por el usuario en la ListView. Contrato en
  [transferencias](importar-exportar-listas.md#municipio-referencia-con-clave-compuesta-fase-3).
- orm:sync: un diff que sólo agrega índices únicos (simples o `uniqueTogether`) ya no
  se bloquea en el aviso de Prisma; se prepara desde `migrate diff --script` tras
  comprobar duplicados por grupo y se aprueba con «aplicar». Usado por el usuario
  para `20261120223001_sync_ubicaciones`. [Guía](sincronizar-aplicaciones.md).
- Etiquetas en Contactos: ver «Etiquetas en Contactos» más abajo.

**Verificaciones vigentes:** `test:list-transfer` 8/8, `test:list-transfer:integration`
completo, `test:modules` 62, unique-indexes + sync.test 5/5, `test:orm:install` 15/21
(6 fallos = EPERM previo de symlinks en Windows), `tsc` y ESLint de lo tocado.

**Pendientes, en orden propuesto:**

1. Commit del usuario de todo lo anterior (con las tres migraciones juntas).
2. Carga inicial de Municipios INEGI (~2.470; Oaxaca ~570): por CLI como Estados,
   porque la ListView admite 200 filas por archivo y 2.000 por exportación. Diseñar
   y presentar el importador antes de escribirlo; no ejecutar cargas reales por el
   agente. Antes, confirmar que repetir el de Estados sin `--aplicar` da 32 sin cambios.
3. Localidad: misma receta (identidad Municipio+código, `uniqueTogether`, `transfer`
   con tres saltos). Hoy el límite es 2 saltos: Localidad→Municipio→Estado→País
   necesita 3; decidir ampliarlo o una clave distinta antes de tocar Localidad.
   Volumen (~300 mil) exige CLI/lotes. No editar Localidad todavía.
4. Comprobaciones reales del usuario: repetición sin cambios y exportar→reimportar
   de País/Estado/Municipio con filtros/selección y una cuenta no admin.
5. Prueba de integración para el error «columnas juntas» (referencia fuera de la
   clave); hoy sólo la cubre el código.
6. Siguientes capacidades del importador: Many2many (agregar frente a reemplazar),
   One2many, Date/DateTime, mapeo de encabezados y lotes grandes con idempotencia.
7. Planes firmados para varias instancias (hoy efímeros por proceso, 15 min); no
   habilitar multiworker sin contrato compartido. Estrategia de producción pendiente.
8. Contactos: enlace «Etiquetas» en Configuración, `drawer: false` en Ubicaciones y
   Notebook opcional (detalle en su sección).
9. Portabilidad de pruebas: EPERM de symlinks en `test:orm`/`test:orm:install`; no
   omitir protecciones ni presentar esas suites como aprobadas por completo.

**Oportunidad de simplificación:** revisión por fila + simulación del lote repite
trabajo deliberadamente para conservar errores localizados y detectar efectos
acumulados. Evaluar una revisión única por lote sólo si el volumen lo justifica;
aceptación: mismas validaciones/hooks/permisos, errores por fila, rollback completo,
límites y concurrencia, sin confirmar escrituras durante la revisión.

Este cierre sólo actualiza documentación y verifica `git diff --check`; no repite
suites, consultas de BD, importaciones ni migraciones. Las verificaciones de código
registradas abajo corresponden a sus respectivos alcances ya ejecutados.

### Límite acumulado al importar Estados: revisión corregida (2026-11-20)

Usuario recibió rechazo al confirmar en fila 154. Causa en código: País.estadoIds
es One2many editable con maxRows=50; varias filas del mismo País podían validar
individualmente y exceder el total al aplicarse juntas. No se relajó el guardado.
Corregido el importador: después de revisar filas simula el lote completo con el
mismo flujo de aplicación, en Serializable con rollback obligatorio; un rechazo
acumulado marca la fila y no entrega token de confirmación. Sin mutar modelos,
permisos o límites. El error de límite ahora indica el máximo y se distingue de
lectura parcial; primero se verifica acceso a la colección, sin filtrar conteos
de registros restringidos.

El usuario eligió explícitamente **conservar líneas editables** frente a convertir
a consulta paginada; después aumentó maxRows de 50 a 100 en Pais y confirmó que
la importación funcionó (2026-11-20). Cambio contrastado con el código; éxito de
la carga real confirmado por el usuario, sin comprobación independiente del agente.
Mantener maxRows=100, acceso heredado, escritura y revisión del País.
Archivos separados no permiten superar 100 Estados
totales por País. El importador rechazará cualquier lote que exceda ese contrato.
No cambiar a readonly ni aumentar el máximo sin una decisión posterior.

Reproducción histórica con maxRows=50 en esquema temporal: 51 Estados del mismo País validan por separado,
pero la revisión completa marca la fila 52, sin confirmar Estados, revisión del
padre ni historial. Integración de País/Estado aprobada y esquema eliminado;
TypeScript y ESLint focalizado aprobados. Sin nuevas migraciones ni escrituras
en registros del ERP. Contrato en [importar/exportar](importar-exportar-listas.md).
Regresión final: list-grouping 17 y build aprobados, con los mismos tres avisos
de tracing del gestor; sin nueva revisión visual en navegador.
Tras el aumento del usuario a 100: la prueba de límite usa el maxRows declarado;
integración temporal aprobada con 101 Estados y rechazo en revisión de la fila 102,
sin filas/revisiones/historial confirmados. Esquema eliminado; ESLint del script
y git diff --check aprobados. El modelo fue editado por el usuario.

### Estado: fase 2 de transferencias implementada e índice único aplicado

Autorizada por el usuario tras el plan; rama codex/importexport, conservados todos
los cambios sin commit de fase 1. Estado publica key [paisId,codigo] y campos
paisId/codigo/name/active, con relations.paisId.key=codigo. Plantillas/exportaciones
usan paisId.codigo; se normaliza/resuelve País con lectura/reglas, sin crear
relacionados, aceptar IDs ni buscar por nombres. La identidad compuesta permite
repetir un código en países distintos. Municipios no se modificó ni habilitó.

Framework: uniqueTogether en la clase de modelo (sólo campos persistentes públicos
obligatorios, sin extensiones), propagado al contrato/generador como @@unique.
Validación de contratos de transferencia al componer módulos. El servicio busca
claves simples/compuestas bajo autorización; resolver País sólo lee sus escalares,
sin cargar todas sus líneas. Las referencias se firman y revalidan antes de todas
las escrituras; la revisión del padre avanzada por hermanos del mismo lote no
invalida falsamente el plan. Resultado y dominios finales se revalidan; la caché
de referencias de exportación es sólo del snapshot readonly de esa petición.
Contrato y límites en [importar/exportar](importar-exportar-listas.md).

`orm:install -- ubicaciones --update --write` generó esquema/registro gestionados
(incluido reordenamiento de inversas User, sin cambio funcional); Prisma Client
regenerado. Migración `20261120223000_estado_country_code_unique` aplicada el
2026-11-20 en desarrollo Windows con aprobación explícita del usuario:
CREATE UNIQUE INDEX ubicaciones_estado_pais_id_codigo_key en pais_id,codigo.
Preflight: era la única pendiente, sin migraciones fallidas y 0 grupos duplicados.
`migrate deploy` terminó correctamente. Verificados historial finalizado e índice
único válido sobre pais_id,codigo en pg_index; ninguna migración pendiente.
No se importaron ni editaron registros del ERP para probar esta fase. No asumir
esta aplicación en otras máquinas.

Verificación: test:list-transfer 7, integración temporal de País y Estado aprobada,
incluidos tres Estados de dos países, hermanos en un lote, revisión del padre,
noops, unicidad de BD fuera del importador, Excel/CSV→reimportación, referencias
faltantes/IDs/duplicados, renombrar y reasignar código del País, permisos heredados,
revocación, dominio y exportación histórica legible, fallo tardío de afterSave con
rollback de Estados/padres/historial. Esquema temporal eliminado. TypeScript,
ESLint focalizado, modules 62, list-grouping 17 y build aprobados (tres avisos de
tracing previos del gestor). test:orm 115/116: EPERM previo al crear symlink de
archivo; test:orm:install también limitado por EPERM de symlinks en fixtures de
Windows, no presentarlo como aprobado. Sin revisión visual nueva.

Continuación de esta fase: el usuario ya confirmó la importación de Estado tras
aumentar maxRows a 100; no repetirla como efecto de ponerse en contexto.
Destinos Many2one con clave compuesta y
referencias de varios saltos, necesarios para Municipio, siguen pendientes;
no adelantar su aplicación ni eliminar el importador específico INEGI.

### Importar/exportar ListView: fase 1 implementada y migración aplicada en desarrollo

Rama `codex/importexport`, árbol limpio al iniciar. Opt-in `transfer` en el manifest;
País publica codigo/name/active, con codigo único. Aunque declara estadoIds, sus
líneas no se transfieren y se conservan al actualizar. Menú Acciones sólo en la
ListView estándar: plantillas Excel/CSV, revisión por filas, confirmación firmada,
altas/cambios/sin cambios, exportación de seleccionados o todos los filtrados.
Permisos import/export en grupos y Ajustes → Accesos, además de CRUD y reglas.
Detalle, límites, semántica de vacíos y siguientes fases en
[el contrato](importar-exportar-listas.md).

La revisión prueba el servicio completo por fila en una transacción que siempre
se revierte; la aplicación revalida el plan y guarda el lote en Serializable,
sin reintentos automáticos. Se comprueban documento/revisión, permisos y resultado
aprobado; fallo tardío revierte filas e historial. Plan efímero por proceso,
15 minutos, sin persistir archivos ni nuevas credenciales. Date/relaciones,
mapeo alternativo de columnas y trabajos grandes siguen pendientes.

Migración `20261120210000_list_transfer_permissions` aplicada el 2026-11-20 a
desarrollo local Windows con aprobación explícita del usuario: sólo agrega
can_import/can_export NOT NULL DEFAULT false a access_model_overrides. Prisma
Client generado previamente. Preflight confirmó que era la única pendiente y
que no había migraciones fallidas; `migrate deploy` terminó correctamente.
Verificados historial con finished_at y ambas columnas Boolean NOT NULL DEFAULT
false en information_schema. No se importaron países ni se cambiaron permisos
o datos de negocio. No asumir esta aplicación en otras máquinas.

Verificaciones actuales: test:list-transfer 5 (formatos/límites/contratos), integración PostgreSQL en
esquema list_transfer_test_<aleatorio> eliminado (crear/cambiar/noop, autor/historial,
conservación de Estados, rechazo de duplicados/errores, rollback tardío, planes
alterados/repetidos/obsoletos y revocación de permisos; exportación por filtros y
selección en ambos formatos, afterSave rechazado y sesión desactivada); access 6, modules 62, list-selection 8,
list-grouping 17, lifecycle 2, TypeScript y ESLint focalizado aprobados. Build
aprobado fuera del sandbox con tres avisos de tracing en el gestor de módulos;
la ejecución en sandbox se detuvo tras quedar sin progreso. Modules pasó fuera
del sandbox tras EPERM en fixtures temporales dentro de él. Sin revisión visual
nueva del diálogo en navegador. `git diff --check` aprobado. Los siguientes pasos enumerados más abajo son
históricos de Contactos y no sustituyen esta prioridad.

Siguiente: reiniciar dev si seguía abierto y comprobar Acciones de País con plantilla, revisión/cancelación,
confirmación y exportación. No aplicar migraciones ajenas automáticamente.

Revisión posterior de contexto (2026-11-20): rama `codex/partner`, HEAD `c7e14da`
(Implementación de etiquetas). El framework descrito abajo ya está en Git. Cambios
locales al retomar: este documento y PartnerInsertions (Notebook `extras` insertado
tras `group:contacto`, con páginas Contactos/Venta/Compra y contenido provisional).
En código ya existen `tagIds` con `create: true`, FieldRelationTag en el formulario,
Column en la lista, `drawer: false` en contactosextra y la migración
`20261120174528_sync_contactosextra` de la tabla de vínculos. No se comprobó su
aplicación en la BD ni el comportamiento visual/persistencia en esta revisión.
El nombre PartnerTags se conserva. El menú Etiquetas de Contactos y su dependencia
contactosextra se añadieron después en esta jornada: Configuración → Etiquetas
abre `/erp/contactosextra/partnertags`, sujeto a lectura efectiva del catálogo,
sin ampliar accessModels ni conceder permisos. Siguen pendientes la decisión
de ocultar Ubicaciones y la guía de dirección. La lista siguiente conserva el plan
anterior: no repetir los pasos ya presentes en código ni asumir SQL pendiente.
Verificación del enlace: `test:applications` (14), ESLint del manifest y
`git diff --check` aprobados; sin nueva revisión visual ni consultas de BD.
Revisión de fuentes/Git únicamente, sin pruebas, consultas de BD ni migraciones;
`git diff --check` aprobado para esta actualización documental.

### Etiquetas en Contactos (revisado 2026-11-20)

Framework de esta línea terminado y ya en commits del usuario (`c7e14da`, `161d61c`, merge
`d48aef1`): inserciones en formularios y colecciones, Many2many en extensiones,
`drawer: false`, `create: true` en Many2many, FieldRelationTag sin textos de ayuda (sólo
estados excepcionales) y Many2many en colecciones. Detalle en las secciones de abajo.

Hecho por el usuario (comprobado en el código; `prisma migrate status` al día, `tsc` limpio;
sin revisión en navegador por el agente):

- Tabla `contactosextra_core_partner_tag_ids_rel` creada por sync (`20261120201830`).
  `PartnerTags` conserva el nombre plural: renombrarlo ya implicaría migración.
- `tagIds` con `create: true` y `maxSelected: 20`; `FieldRelationTag name="tagIds"` en
  `PartnerInsertions`; `<Column field="tagIds" label="Etiquetas" />` en
  `PartnerListInsertions`.
- `drawer: false` en contactosextra; Contactos ya tiene `contactosextra` en `depends`.

Pendiente del usuario, a su ritmo:

1. Enlace «Etiquetas» en Configuración de Contactos (`/erp/contactosextra/partnertags`, model
   `contactosextra.partnertags`): aún no está en el manifest de Contactos.
2. Decidir `drawer: false` en Ubicaciones.
3. Pestañas (opcional): Notebook con `id` estable en `ContactForm` (recomendado `id="extra"` si
   varios módulos agregarán páginas) o insertado por la extensión tras `group:contacto`.
   Destinos `notebook:<id>` (inside sólo NotebookPage) y `page:<id>/<name>`; las páginas
   insertadas no son destino. Contrato en [inserciones](inserciones-vistas.md).

La guía de dirección continúa con el cierre de importación/exportación de arriba (Municipio
como siguiente piloto).

## Many2many en colecciones: columnas y filtros (2026-11-20)

Pedido por el usuario («poder filtrar por etiquetas»), sin orden ni agrupación (acordado).
Widget `tags` en columnas, filtro alguna/todas/sin/con (1–10 IDs legibles), IDs legibles y
nombres por fila. Repositorio declarativo: `many2manyWhere`/`many2manyIds` (propios y vía fila
compañera). Inserciones de lista aceptan Many2many. Verificado: `test:modules` 62, `test:orm`
115/116 (EPERM previo), list-grouping/relation-filter/collection-load/list-selection y filtros
de lista, `test:extensions:integration` completo en temporal, `tsc`, ESLint (aviso previo) y
demo `/sample#tag-collections` en navegador (chips, filtro «tiene todas» con nombres en la
cabecera y en la URL sólo IDs). Contrato en
[Many2many](relaciones-many2many.md#many2many-en-colecciones-etiquetas). Siguiente del usuario:
`<Column field="tagIds" />` en `PartnerListInsertions` tras el `orm:sync` pendiente.

## Crear desde el selector de Many2many (2026-11-20)

Pedido por el usuario, sólo Many2many. `Fields.Many2many(target, { create: true })` ofrece
«Crear "texto"» en FieldRelationTag; `modelQuickCreate`/`relationQuickCreate` reutiliza un
nombre existente o crea con sólo `name` por el servicio del destino; la opción sólo se publica
a quien puede crear en el destino. Al componer exige destino declarativo con Text `name` y sin
otros obligatorios sin default. Cambio respecto a la propuesta: `create` no se combina con
`domain` (rechazado al declarar) en lugar de validar el dominio al crear. Verificado:
`test:orm` 115/116 (EPERM previo), `test:modules` 60, `test:form-model` 25,
`test:extensions:integration` completo en temporal, `tsc`, ESLint (aviso previo) y demo
`/sample#many2many-model` en navegador. Contrato en
[Many2many](relaciones-many2many.md#crear-desde-el-selector-create-true). Siguiente del usuario:
`create: true` en `PartnerExtra.tagIds` (no requiere orm:sync: no cambia el esquema).

## Opción `drawer` del cajón de aplicaciones (2026-11-20)

Pedido por el usuario: contactosextra apareció en el cajón al añadir su catálogo
`PartnerTags`, porque todo módulo con modelos propios se registra como aplicación.
`defineModule({ drawer: false })` (y `drawer` en `ApplicationManifest`) oculta sólo la tarjeta:
la página del cajón usa `applications.drawerFor(user)`; navegación, rutas, enlaces desde otras
aplicaciones y permisos siguen con `forUser`. Por defecto `true`, sin cambios en módulos
existentes. Verificado: `test:applications` 14 y `test:modules` 60 (pruebas nuevas), `tsc` y
ESLint (sólo el aviso previo de `erp/page.tsx`). Sin navegador. Contrato en
[módulos declarativos](modulos-declarativos.md#1-declarar-el-módulo). Siguiente del usuario:
`drawer: false` en contactosextra (y decidir si también en Ubicaciones), enlace «Etiquetas» en
Configuración de Contactos, y renombrar/unificar carpetas antes de `orm:sync`.

## Many2many en extensiones: implementado (2026-11-20)

Autorizado por el usuario con las tres decisiones del [diseño](ideas/many2many-extensiones.md):
vínculos colgados de la fila compañera, `core.user` fuera de la primera versión y grupo del
módulo en el formulario automático. Contrato en [Many2many](relaciones-many2many.md#many2many-en-extensiones).
Sin commit.

- Código: `extensionMany2many` (extend.ts); el modelo compañero incluye los Many2many (el
  generador crea la tabla del extensor); `compose` valida destino/dependencia, nombres, límite
  de 4 y repositorio propio, y publica `ModelExtensionInfo.many2many`; el repositorio lee y
  escribe los vínculos dentro de la fila compañera; ModelForm los ubica en el grupo del módulo.
- Verificado: `test:modules` 59 (nueva prueba de extensiones con Many2many), `test:form-model`
  25, `test:orm` 114/115 (EPERM de symlinks en Windows, previo), `tsc`, ESLint.
  `test:extensions:integration` en temporal: instalación con SQL de la tabla y sus FK, y el
  bloque Many2many completo (alta, lectura ordenada, cambio sólo de vínculos con revisión e
  historial, inexistentes/repetidos, destino ilegible, Restrict y Cascade) **aprobados**.
- **Arnés de integración corregido (mismo día, autorizado):** desde `91862ee` Contactos declara
  `depends: ["ubicaciones"]` y los modos que reemplazan `src/modules/index.ts` y dibujan páginas
  del ERP respondían 500 («No está registrada la dependencia ubicaciones»).
  `scripts/modules.integration.ts` ahora calcula, leyendo los manifests de las aplicaciones
  manuales y de sus módulos, las dependencias declarativas requeridas y las registra junto a
  los módulos de ensayo (`renderIndex`) en los modos de extensiones y principal. Sin nombres
  fijos; sus tablas ya existen porque el esquema temporal aplica todas las migraciones.
- Verificado tras la corrección: `test:extensions:integration` completo (incluido render Next y
  retirada del extensor con `DROP TABLE "soporte_taller_equipo_marcas_rel"`) y
  `test:modules:integration` completo, ambos en proyecto/esquema temporales eliminados.
- Retirar Ubicaciones en el ERP real **ya está bloqueado** por el gestor: su inventario lee
  también los manifests de aplicaciones manuales (`inspectManifest`), Contactos aparece en
  `dependents` de Ubicaciones y la revisión de retirada añade «Aplicaciones dependientes». Una
  nota anterior lo daba como riesgo abierto por error. Fijado con prueba en
  `catalogue.test.ts` (`test:module-manager` 21/21). Sin cambios de código del gestor.
- Siguiente del usuario: declarar `tagIds` en PartnerExtra con destino
  `ContactosextraPartnertags`, `orm:sync -- contactosextra` (revisar el SQL) e insertarlo con
  `<FieldRelationTag name="tagIds" />`.

## Pendiente: Many2many en modelos extendidos (2026-11-20) — implementado arriba

Solicitado por el usuario al consultar cómo declarar una relación para presentarla
como tags en una extensión de modelo, como PartnerExtra. Actualmente `extendModel`
rechaza Fields.Many2many; FieldRelationTag ya presenta las relaciones declaradas
en modelos propios. Registrar este pendiente no inicia su implementación.

- Objetivo: permitir declarar Many2many desde una extensión y presentar el campo
  con FieldRelationTag en vistas personalizadas o inserciones, reutilizando el
  contexto y guardado del formulario base.
- Diseñar antes de implementar propiedad y ciclo de vida de la tabla intermedia
  del módulo extensor, composición de extensiones y compatibilidad con modelos
  nativos como core.partner. No duplicar Partner ni escribir vínculos desde la vista.
- Aceptación: generación/instalación/bindings y retirada coherentes con la propiedad
  del módulo; defaults/esquemas/tipos y lookup autorizados; permisos del dueño y
  destino, revisión compartida, hooks, constraints e historial conservados;
  vínculos y registro guardados en una transacción con rollback. Verificar en
  proyecto/esquema temporales y demo RHF/Zod, incluyendo inserciones y rechazo
  de destinos inexistentes o no accesibles.
- Contrato y alcance actual: [Many2many](relaciones-many2many.md). No se modifican
  modelos, migraciones ni datos con esta anotación.
- **Diseño propuesto (2026-11-20):** [many2many-extensiones](ideas/many2many-extensiones.md): vínculos colgados de la fila compañera del módulo extensor (generador y propiedad existentes), escritura anidada en su upsert, `core.user` fuera de la primera versión. Pendiente de decisiones del usuario y de autorización.

## Stack: tres columnas adaptables (2026-11-20)

- Stack distribuye Fields en una columna por debajo de 24rem de ancho propio,
  dos desde 24rem y tres desde 42rem. Conserva dirección block, separación,
  anclas de inserción y contexto del formulario. Contrato en [Stack](../src/components/ui/form/Stack.md)
  y demo RHF/Zod existente en `/sample#stack` actualizados.
- Cambio de presentación compartida; no modifica modelos ni BD. La guía sigue
  pausada en la comprobación de repetición de estados descrita abajo.
- Ajuste posterior: cuadrícula con `auto-fit` para colapsar columnas vacías;
  dos campos ocupan mitades y uno todo el ancho. Admite inserciones sin contar
  hijos React. En varias filas mantiene las columnas alineadas.
- Verificación: ESLint de Stack y SampleForms, 11 pruebas existentes de
  modelFields (incluido contexto/dirección de Stack) y `git diff --check`
  aprobados. Sin nueva revisión visual en navegador.

## Importación y exportación desde ListView: alcance de fases siguientes

Solicitado por el usuario el 2026-11-19. Fase 1 de campos simples implementada el
2026-11-20, con activación en la BD del ERP pendiente (ver arriba). El alcance
original de abajo conserva las capacidades previstas para fases posteriores;
no implica que relaciones, mapeo interactivo o trabajos grandes ya existan.

- Integrar en Acciones de ListView la exportación Excel/CSV de seleccionados o
  de todos los registros que coincidan con los filtros, respetando permisos de
  registros y campos en el servidor.
- Importación Excel/CSV: mapear columnas a Fields y resolver creación o
  actualización mediante claves únicas declaradas (folio/código, no nombres).
- Mostrar antes de confirmar un plan con altas, actualizaciones, registros sin
  cambios y errores por fila/campo. Revalidar permisos y datos al aplicar para
  detectar cambios posteriores a la revisión; reutilizar servicios, validaciones,
  folios y lógica de negocio del ORM, sin escrituras directas que los omitan.
- Many2one: resolver por clave única del modelo destino; señalar referencias
  inexistentes, ambiguas o no accesibles. No crear relacionados automáticamente
  por defecto; cualquier creación deberá habilitarse expresamente por modelo.
- Many2many: resolver varias claves y distinguir explícitamente entre agregar
  relaciones y reemplazar las existentes.
- One2many: agrupar líneas por clave del padre y guardar cada padre con sus
  líneas en una transacción, ejecutando la lógica de ambas clases.
- Fases propuestas: campos simples y Many2one primero; Many2many y líneas
  después. Para cargas grandes, lotes con reporte y reintentos idempotentes,
  explicitando qué lotes se aplicaron si la importación queda incompleta.
- Dependencias de catálogos: importar en orden (países, estados, municipios).
  Aprovechar la experiencia de la importación de estados, conservando su CLI
  específico hasta que exista el flujo general.

## Corrección posterior: dropdowns de relaciones (2026-11-19)

- FieldMany2One y FieldRelationTag comparten RelationDropdown: calculan espacio
  visible en viewport y contenedores con scroll, abren arriba si conviene y
  limitan altura con scroll interno. Conservan el subárbol del Field para
  funcionar dentro de diálogos nativos; recalculan en scroll/resize.
- Ejemplo local RHF/Zod sin BD en `/sample#relation-dropdown`, con selector
  superior/inferior, etiquetas y modal. Verificados en navegador apertura en
  ambos sentidos, altura de scroll del contenedor sin crecimiento, selección
  por teclado y selección con ratón dentro del modal.
- Validación: TypeScript, ESLint de archivos afectados y `test:form-model`
  (25 pruebas, incluidas tres de geometría). Sin migraciones ni escrituras de BD.
- La guía sigue pausada en la comprobación de idempotencia de estados descrita
  abajo. Se preservaron cambios previos del usuario en importar-estados.ts y
  el manifest de Ubicaciones.

## Progreso guardado (2026-11-19, Contactos e importación de estados)

**Pausa solicitada por el usuario.** Rama comprobada `codex/partner`, HEAD
`7e6d64b` (sistema de insertions implementada), con cambios locales y archivos
nuevos sin commit. Este cierre no ejecutó commit/push/pull, consultas de BD,
importaciones ni suites nuevas. Preservar código/vistas/migraciones del usuario.
Leer este punto antes de los resúmenes históricos inferiores.

**Punto exacto al retomar:** el usuario ejecutó la importación real de estados de
México y confirmó «sí funcionó». Falta su comprobación de repetición sobre esos datos:

```sh
npm run ubicaciones:import -- TU_LOGIN
```

Sin --aplicar, esperar 0 crear, 0 actualizar, 32 sinCambios y 0 conflictos si no
hubo cambios posteriores. No dar esta comprobación por hecha ni repetir la carga
como efecto de ponerse en contexto. Después diseñar importación de Municipios,
por Estado y con revisión/idempotencia/servicios; Localidades después.

### Completado en esta sesión

- Ubicaciones concede sólo lectura de sus cuatro catálogos a core.internal.
  Administración sigue admin. Usuario confirmó consulta y bloqueo de crear,
  editar y eliminar con cuenta no admin.
- Contactos declara depends ubicaciones y Configuración con Países/Estados/
  Municipios/Localidades. Framework permite enlaces a modelos publicados de una
  dependencia directa y ruta exacta /erp/<dependencia>/<clave>; visibilidad por
  lectura del destino, sin snapshot se oculta. AccessModels de Contactos conserva
  core.partner: el menú no concede acceso ni CRUD. Usuario confirmó navegación.
  Los enlaces abren Ubicaciones; no se ocultó su tarjeta ni se incrustaron rutas.
- Importador INEGI completo: scripts/importar-estados.ts y helper
  src/modules/ubicaciones/imports/estados-inegi.ts. Plan por defecto; --aplicar
  exige TTY y la palabra aplicar, aborta conflictos y termina sin escribir si no
  hay cambios. Admin/versión/País MX/plan/revisiones revalidados en Serializable;
  servicios transaction.persist/snapshot conservan validación, hooks, auditoría y
  revisión del propietario. Sin reintentos automáticos, borrados ni reset de activo.
  No consulta INEGI desde Fields ni durante la transacción de escritura.
- Fuente, uso y operación en [Importar estados](importar-estados.md). Consultados
  fuente/documentación/términos INEGI; claves geográficas, sin equivalencia SAT asumida.
  El agente sólo aplicó datos de prueba en esquema exclusivo; la carga real fue
  ejecutada y confirmada por el usuario. No hubo verificación independiente propia
  de esa carga real.

### Verificaciones realizadas antes de la pausa

- test:applications 13 y test:modules 58 para navegación de dependencias; tsc y
  ESLint focalizado aprobados.
- test:ubicaciones:import aprobado en esquema import_states_test_<hex>, eliminado:
  32 altas, autor/historial, repetición sin escrituras, actualizaciones preservando
  activo, registros manuales conservados, revisiones/actores/País inválidos y
  conflictos; rechazo tardío con rollback de filas/país/historial; concurrencia.
- CLI probado en procesos con fuente/TTY ficticios: plan, cancelar, confirmar,
  sin cambios, flags inválidos, no TTY, no admin y producción bloqueada.
- TypeScript, ESLint focalizado y git diff --check aprobados al cerrar la
  implementación. En esta petición de guardar progreso, sólo revisión documental.

### Pendientes posteriores

1. Confirmar revisión sin flag tras la importación real; después Municipios y
   Localidades (importadores aún no existen). Revisar fuentes, claves por padre,
   volumen, conflictos, concurrencia y preservar lógica/auditoría; no cargar todo
   automáticamente ni crear código de ejercicios por adelantado.
2. Unicidad compuesta/identidad geográfica y mantenimiento de catálogos ante cambios
   de fuente se revisan al ampliar importadores. Estado/Municipio/Localidad no tienen
   clave global única. No asumir equivalencia con catálogos SAT/Carta Porte.
3. Lista Contactos publica máximo 12 campos; Localidad queda fuera hasta ajustar
   list.fields. Reglas CP/RFC actuales son mexicanas: revisar política antes de
   habilitar domicilios extranjeros.
4. Limpieza opcional: PartnerExtraForm.tsx ya no tiene consumidores; existe además
   un archivo vacío src/modules/ubicaciones/scripts/importar-estados.ts. El comando
   npm usa scripts/importar-estados.ts en la raíz. No se borraron estos archivos.
5. Pendientes previos 3–6 de la sección histórica siguiente siguen vigentes:
   ventas/facturación, residuo de secuencias de Tickets, limpieza legacy y mejoras
   anteriores. Tickets sigue retirado; no restaurarlo.

Guía general: [Catálogos de dirección](catalogos-direccion.md). La próxima sesión
comienza con revisión de Git/documentación y la comprobación pendiente del usuario;
no asumir procesos dev activos ni estado remoto/BD de otra máquina.

## Progreso guardado (2026-11-19, cierre de sesión anterior)

Rama `codex/partner`; revisión de continuidad posterior: HEAD `07949eb`
(incluye el cierre documental), árbol limpio al comenzar. El código de la sesión
está guardado en `80173dc` y `ae16fd4`.
Sin push/pull comprobado en esta revisión.

Revisión de contexto del 2026-11-19: contrastados AGENTS, README, este estado,
Git, PartnerExtra, Ubicaciones y los puntos de entrada del motor de líneas y
colecciones hijas. Corregida la guía de catálogos, que aún presentaba anidados y
domain País→Estado como pendientes. Sólo documentación y `git diff --check`;
sin nuevas suites, navegador, consultas de BD, generación ni migraciones.

**Hecho en la sesión (detalle en las secciones siguientes):**
- One2many anidados (fase B): documento → línea → sublínea, árbol en una transacción,
  límites 100 por relación/500 por documento, sublíneas expandibles en FieldOne2many.
- Relaciones de consulta (fase A): `Fields.One2many(..., { readonly: true })`, colección
  paginada del hijo en el formulario del padre, «Nuevo» con padre preasignado. Regla del
  usuario: hijos numerosos se crean desde su propio formulario.
- Colecciones sin `<form>` propios (búsqueda y filtro de columna) para poder embeberse.
- Filas de One2many compactas (corregido el `table!` que hacía !important el padding de
  daisyUI) y celdas sin línea inferior en reposo (visible en hover, foco y error).
- Ubicaciones (usuario): `Estado.municipioIds` ya es relación de consulta; `Pais.estadoIds`
  sigue como líneas editables (`maxRows: 50`). Contactosextra: `estadoId` ya declara
  `domain: d => d.eq("paisId", d.draft("paisId"))`, conservando `validarPaisEstado`.

**Verificado por el agente:** suites e integraciones listadas en las secciones de fase A/B y
filas compactas (incluido build en proyecto temporal); medición en navegador sólo sobre
`/sample`. **Confirmado por el usuario el 2026-11-19:** lista/búsqueda de municipios
desde Estado, «Nuevo» con estado preasignado, creación y regreso; dominio País→Estado
en Contactos, aviso al cambiar país, corrección/guardado/reapertura y búsqueda sin
candidatos con País vacío. El agente no repitió estas pruebas en navegador.

**Inserciones de vistas extendidas implementadas el 2026-11-19** ([contrato](inserciones-vistas.md)).
**Colecciones (2026-11-19, autorizado con 4 decisiones):** `insertions.list|card|kanban` con `<Column>`; destinos `column:<campo>` (before/after/replace), `columns:end` (inside) y `card:title|body|footer`; sólo campos publicados de la extensión o de sus dependencias; 12 columnas máx. (se omiten las de los últimos módulos); lista sin `columns` no aplica inserciones; ancho/alineación del `<Column>`. Contexto de extensiones ahora con id de modelo y tipo de vista. Verificado: test:modules 58 (collection-insertions.test.ts), test:form-model 22, test:collection-load 4, test:extensions:integration (build Next en temporal), tsc, eslint completo (sólo aviso previo de erp/page.tsx); navegador en `/sample#collection-insertions` (lista, error/omitidos, tarjetas y kanban sin duplicados, sin issues de Next). Aplicado a Contactos (guiado, escrito por el usuario): `PartnerListInsertions.tsx` inserta RFC y Estado después de `column:email`; manifest con `insertions.list`. El usuario confirmó la lista en el navegador. La política derivada de core.partner publica 12 campos: `localidadId` queda fuera de la colección.

Contactosextra ya migró a inserciones (guiado, escrito por el usuario): ContactForm publica
`group:contacto`, `stack:identidad` y `stack:medios`; `PartnerInsertions.tsx` coloca el RFC
después de `field:name` y el grupo `direccion` después de `group:contacto`; el manifest usa
`insertions.form`. El usuario confirmó en el navegador valores guardados, cadena de dominios,
guardado/recarga y ausencia de avisos. `PartnerExtraForm.tsx` queda sin referencias, pendiente
de que el usuario lo borre. Siguiente: se
retoma la guía de dirección (permisos de catálogos, navegación, importación).

**Avance de dirección y pendientes posteriores:**
1. `PartnerExtra.municipioId` opcional ya añadido por el usuario y revisado en fuentes:
   destino UbicacionesMunicipio, Restrict, tracking y dominio por `estadoId` correctos.
   El usuario indicó terminado el paso de sincronización. Migración
   `20261119205510_sync_contactosextra` revisada: columna municipio_id nullable,
   índice y FK Restrict correctos; esquema Prisma actualizado y selector ya conectado
   en PartnerExtraForm. Sin consulta propia de migrate status ni nueva prueba de
   ejecución del agente. Usuario confirmó filtro Estado→Municipio, aviso al cambiar
   Estado, corrección/guardado/reapertura y ausencia de candidatos sin Estado.
   Localidad también añadida por el usuario: declaración opcional/Restrict/tracking,
   dominio por municipioId y selector revisados. Migración
   `20261119210420_sync_contactosextra` correcta (nullable, índice y FK Restrict).
   Usuario informa sincronización y funcionamiento correctos; sin repetición propia
   de pruebas de navegador/BD ni confirmación desglosada de casos de Localidad.
2. Ejercicio de dirección: lectura de catálogos para no administradores y navegación
   desde Configuración de Contactos; importación oficial después.
3. Para ventas/facturación (cuando se inicie ese módulo): tipo `Decimal`/dinero,
   compute/onchange dentro de filas de One2many, Many2many en hijos de líneas (impuestos) y
   revisar el límite de 100 conceptos por relación.
4. Residuo de Tickets: fila `TicketsTicket.name` en `model_sequences` y corrección de
   `cleanupSQL` para limpiar contadores al retirar módulos (ambas pendientes de aprobación).
5. Limpieza: retirar `lib/users/service.ts`, `user.schema` y proveedores legacy
   `user`/`partner` cuando dejen de usarse en pruebas y `/sample`; aviso de lint previo
   (`ChartColumnBig` sin usar en `erp/page.tsx`).
6. Pendientes previos sin cambios: extensión de User probada (`extendModel(User)`), related
   a través de Partner/User, sincronización de `core`, permisos por campo, compute
   persistido, distribución de módulos, estrategia de entornos y Tickets (pausado).

## Pendiente prioritario: inserciones en vistas extendidas (2026-11-19)

Petición del usuario: registrar este trabajo como siguiente pendiente, antes de
retomar permisos/navegación de la guía de dirección. Sólo propuesta acordada;
no implementada y esta anotación no autoriza cambios de código.

Motivo: distribuir campos y composición de una extensión entre elementos del
formulario base sin editarlo ni limitarse al bloque actual de ModelExtensions.

Semántica acordada:

- El manifest registra un único archivo de inserciones por extensión/formulario
  mediante `insertions: { form: () => import("./views/PartnerInsertions") }`, dentro
  de la entrada `extends` del modelo base.
- El archivo exporta un componente con `<Inserter target="field:email"
  position="after">...</Inserter>`; sus hijos pueden ser Fields, grupos o notebooks.
- Sólo posiciones `before`, `after`, `inside` y `replace`.
- Un Inserter por combinación destino + posición dentro del archivo; puede contener
  varios elementos. Esto no impide que varios módulos extiendan el mismo modelo.
- `inside` sólo para contenedores identificados; un único `replace` por destino.
- Destinos inexistentes y conflictos entre extensiones deben producir errores
  claros, con reglas deterministas de resolución.
- Destinos explícitos y estables (por ejemplo `field:email`, `group:contacto`),
  resueltos por el framework; no XPath arbitrario sobre el DOM.

**Implementado el 2026-11-19** con autorización del usuario y sus tres decisiones (fallback en producción, gana el dependiente en replace, sólo formularios). Contrato [inserciones-vistas](inserciones-vistas.md), diseño [ideas/inserciones-vistas](ideas/inserciones-vistas.md). Anclas en FieldVisibility (todo Field* de primer nivel), FormGroup/Stack con `id`, Notebook/NotebookPage con `id` y `group:general` en ModelFields; registro durante el render y re-registro en efecto de layout (StrictMode); manifest `insertions.form` exclusivo con `views.form`; `config.extensions` publica `depends`/`insertions`. Verificado: test:form-model 22 (incluye insertions.test.tsx: orden, replace por dependencia/conflicto, inside sobre reemplazado, publicador, ausentes/duplicados, render SSR con RHF y Notebook), test:modules 53, test:extensions:integration y test:core:integration (proyecto/esquema temporales, con build Next; fixture extension-check actualizado por `depends`), tsc y eslint (sólo los 2 avisos previos); navegador en `/sample#insertions` (orden, error en página insertada revela su pestaña con contador, envío con valores insertados, escenario de conflicto con avisos y fallback). Contactos real comprobado por el usuario tras migrar contactosextra (el agente no lo abrió: requiere sesión).

Siguiente paso al retomarlo: revisar ModelExtensions, composición de ModelForm y
Fields/contenedores; presentar un diseño concreto para destinos, orden/conflictos
entre módulos y compatibilidad con vistas personalizadas/condicionales antes de
implementar. No asumir que React puede reubicar componentes sólo por su nombre.

Criterios de aceptación: inserción declarada en TSX sin edición del formulario base,
un solo contexto RHF/formulario/guardado, locks y dirty guard conservados, errores
revelables en grupos/notebooks, autorización y validación de servidor intactas.
`replace` cambia presentación, sin eliminar obligaciones del modelo. Conservar las
vistas personalizadas existentes y definir convivencia con `views.form` y el fallback
de ModelExtensions, sin migrarlas automáticamente. Añadir demo ficticia en `/sample`
y comprobaciones de posiciones, destinos ausentes, duplicados/conflictos y contexto.

Verificación de esta anotación: `git diff --check`; sin implementación, suites,
navegador, SQL ni cambios en aplicaciones. Los cambios actuales del usuario en
ContactForm y PartnerExtraForm se conservan.

## Relaciones de consulta: fase A implementada (2026-11-19)

Autorizada por el usuario, con la regla: hijos numerosos se crean desde su propio formulario.
Sin commit.

- `Fields.One2many(target, { inverse, readonly: true })` devuelve un tipo distinto
  (`ChildCollectionField`); `defineModel` lo separa en `childCollections`, fuera de
  documento, defaults, Zod y guardado. `defineModule` exige hijo del mismo módulo con
  Many2one inverso al padre.
- Servidor: `childCollectionList` (registry) y la Server Action fija `modelChildren`: lee al
  padre con su servicio (permisos/reglas), lista el hijo con `defineListAction` y dominio
  `<inverse> = id`. `ModelClientConfig.collections` publica la config del hijo (un nivel).
- Cliente: `<ModelChildCollections />` en ModelForm (por defecto en ModelFields);
  ModelCollection con `embedded` y `createDefaults`; ModelForm aplica `default_<campo>` de
  Many2one al crear. CollectionToolbar y ColumnFilter ya no usan `<form>` (Enter conserva el
  comportamiento con onKeyDown).
- Verificado: test:nested:integration con 2,500 hijos (página, total, búsqueda, filtro
  manipulado sin efecto, reglas del hijo, lectura del padre exigida, campo no declarado),
  test:modules 52 (nested.test.ts), tsc y lint (sólo el aviso previo de erp/page.tsx). Regresión:
  test:orm 114/115 (EPERM), form-model 14, collection-load 4, list-grouping 17, list-selection 8,
  relation-filter 1 e integraciones one2many, domains, capabilities, core y legacy (con build).
  Sin navegador: la sección de consulta y el «Nuevo» con padre no se revisaron visualmente.
- Siguiente del usuario en Ubicaciones: declarar `Estado.municipioIds` con `readonly: true`
  y crear municipios desde su formulario (o «Nuevo» en la lista del estado).

## One2many anidados: fase B implementada (2026-11-19)

Autorizada por el usuario tras el diseño. Sin commit.

- Servidor: `owned()` carga documentos completos con sus líneas; `validateLines` acepta
  sublíneas; un cambio de sublínea guarda su línea; `countDocumentRows` ≤ 500 por documento;
  quitar una línea elimina sus sublíneas con `withLines` (abajo hacia arriba); borrado suelto
  conserva Restrict. `defineModule` admite hasta 3 niveles y rechaza ciclos.
- Cliente: `ModelLineConfig.lines` recursivo, esquemas/createRow recursivos, `lineAt`/`lineField`
  en useModelField, FieldVisibility y dominios de fila; FieldOne2many con sublíneas expandibles.
- Verificado: test:nested:integration (proyecto/esquema temporales) con árbol de 3 niveles,
  revisión por rama, rutas de error, rollback de afterSave/constraint, maxRows, IDs/inversas
  manipulados, concurrencia desde la sublínea, baja de abajo hacia arriba, Restrict suelto y
  acceso heredado; test:modules + nested.test.ts, test:form-model 14, tsc y lint.
  Regresión aprobada: test:modules 51, test:orm 114/115 (EPERM de symlink en Windows),
  integraciones one2many, domains, capabilities, extensions, core y legacy (con build).
  Lint: sólo queda un aviso previo (ChartColumnBig sin usar en erp/page.tsx, ya en Git).
  Sin navegador: la UI expandible no se revisó visualmente.
- Ubicaciones: el guard ya no rechaza `Pais.estadoIds` + `Estado.municipioIds`, pero un estado
  con más filas que su `maxRows` impedirá abrir el País; para ese catálogo sigue indicada la
  fase A (consulta paginada). No se modificaron sus modelos.

## Progreso guardado y pendiente urgente: One2many anidados (2026-11-19) — resuelto

> Resuelto el mismo día con las fases B (anidados) y A (relaciones de consulta); se
> conserva como historial.

Por petición del usuario, guardar este punto y registrar como urgente el soporte
de varios niveles de líneas. Rama revisada codex/partner, HEAD 35adbf9; cambios
locales de dominios, aplicaciones y ajuste visual conservados, sin commit/push/pull.
Caso real: Pais.estadoIds → Estado.municipioIds → Municipio. Las dos declaraciones
siguen presentes en fuentes y el manifest queda rechazado por el límite vigente
de un nivel. No se retiraron campos ni se eliminó el guard para ocultar el problema.

Siguiente pendiente urgente: diseñar y presentar [One2many anidados](ideas/one2many-anidados.md),
con límites, transacción, permisos, concurrencia de ancestros y UI inline; esta
anotación no inicia implementación. Distinguirlo de añadir hasta cuatro One2many
hermanos, capacidad ya disponible. Al retomar, revisar Git y acordar el diseño o
la variante temporal de un nivel antes de ejecutar sincronizaciones o pruebas
de la app; no asumir que Ubicaciones abre actualmente.

Avance conservado: filas One2many compactas (4px por lado en tabla), motor de
dominios implementado y PartnerExtra.estadoId ya declara domain por paisId en
fuentes, con validarPaisEstado conservado. No se comprobó en navegador la aplicación
del dominio en Contactos debido al rechazo del manifest; no marcarla verificada.
Municipio/Localidad en PartnerExtra, lectura/navegación de catálogos e importaciones
siguen pendientes. Esta tarea sólo actualiza documentación; diff --check aprobado,
sin suites, BD, SQL ni cambios de código.

## Filas compactas de One2many (2026-11-19)


Diagnóstico posterior de Ubicaciones: el usuario añadió Pais.estadoIds y
Estado.municipioIds como One2many. defineModule rechaza Pais.estadoIds porque
Estado, su hijo, ahora declara líneas propias. El contrato vigente admite un
solo nivel de documento; paisId de Estado es required/no único/Restrict correcto.
Para recuperar esa variante, conservar Pais.estadoIds y retirar municipioIds
de Estado, manteniendo Municipio.estadoId y su catálogo separado; una navegación
filtrada es una alternativa a líneas anidadas. Sin cambios en sus modelos ni
ampliación del motor por este diagnóstico. No eliminar el guard para habilitarlo.

Ajuste visual posterior (2026-11-19): por petición del usuario, FieldOne2many
reduce de 12px a 4px por lado el padding vertical de las celdas del body en
disposición de tabla, incluyendo índice y acciones. Controles, encabezados,
padding lateral y disposición apilada conservados. Cambio compartido; no modifica
vistas/modelos de Ubicaciones ni el siguiente ejercicio de dominios. Verificación
focalizada de ESLint y git diff --check; sin pruebas de lógica, BD ni medición
nueva en navegador para este ajuste CSS.

## Dominios compartidos implementados (2026-11-19)

Autorización posterior del usuario: implementar el constructor acordado
`domain: d => ...`. [Contrato vigente](dominios-modelos.md). Motor existente
ampliado con eq/neq/in/notIn/comparaciones/texto y all/any/not; dependencias
explícitas d.draft en Many2one/Many2many y dominio base de la entrada del modelo
en manifest para Lista/Card/Kanban. No se envían funciones/where/modelos destino
desde el navegador. Fuente de relación fija por dueño/campo, sesión y lectura
revalidadas, scopes combinados con AND. Conteos/páginas/grupos/columnas Kanban
comparten el dominio del servidor.

Dependencias vacías dejan todo el dominio sin candidatos; false/0 se conservan.
Las selecciones legibles incompatibles se resuelven por ID con domainValid:false,
se avisan y se conservan para corregirlas. Sin limpieza automática de IDs ni
vínculos. Guardado comprueba selecciones finales antes de escribir y después de
hooks, dentro de la transacción; acciones/movimientos y extensiones comparten
esa validación. Los parámetros y bindings legacy rechazan dominios de relación.
Relaciones dentro de One2many usan su propia fila; no se filtran líneas.

Verificaciones en Windows: integración test:domains:integration aprobada en
proyecto/esquema PostgreSQL temporales, eliminados; cubre candidatos, ID/lote,
reglas/permisos/sesión, payload manipulado, vacíos, selección antigua, Many2many,
extensión de core.partner, hooks/acciones con rollback y colecciones/grupos/Kanban.
TypeScript, ESLint focalizado, 22 pruebas de dominios/servicio, 13 form-model y 48
de módulos aprobados. test:orm: 114/115; la restante falla por EPERM al crear un
symlink de archivo en Windows incluso fuera del sandbox. No se omitió ni se
presenta como aprobada. Build de Next aprobado, con tres avisos de tracing de
filesystem en inventory/operation-lock existentes; el primer intento quedó sin
progreso en sandbox y se detuvo. El build permitió corregir el proveedor de
formulario de la demo antes de la aprobación final.

Demo ficticia RHF/Zod en /sample#domains. No se modificaron modelos, vistas ni
migraciones de Contactosextra/Ubicaciones; tampoco configuración privada, permisos
o datos del ERP. Sin commit/push/pull. Siguiente ejercicio: usuario aplica
País→Estado en PartnerExtra, conservando por ahora validarPaisEstado; después
seguir Municipio/Localidad, lectura de catálogos y navegación acordada.

Comprobación en navegador de esa demo: cambio México→Canadá ofrece sólo Ontario/
Quebec, conserva selección/chip mexicanos con aviso, y País vacío produce «Sin
coincidencias» en Estado. Comboboxes con autocomplete off. No se realizó una nueva
medición responsive ni una prueba de interacción de relaciones dentro de líneas.

Oportunidad pendiente: inferencia TS de campos/valores entre clases referidas por
nombre Prisma. Hoy los Fields validan referencias al componer módulos; los
servicios tipados limitan nombres de campos en defineListAction. Aceptación y
otros límites en el contrato enlazado, sin abstracciones adicionales anticipadas.

## Punto de continuación anterior (2026-11-18)

El usuario pidió registrar el progreso y continuar después. Revisión de continuidad
del 2026-11-19: rama `codex/partner`, HEAD `35adbf9` (`primera fase terminada`),
árbol limpio al comenzar. Ese commit ya incluye los cambios de dirección,
Ubicaciones, vistas y documentación descritos abajo; las menciones posteriores a
cambios sin commit corresponden al cierre anterior. Preservar sus personalizaciones.
Se contrastaron README, AGENTS, las guías de dirección/dominios y las fuentes de
PartnerExtra, Ubicaciones, ContactForm y ModelExtensions. Sin nuevas pruebas de
ejecución, inspección de BD, migraciones ni commit/push/pull en esta revisión.

**Pendiente de aquel cierre, ya implementado el 2026-11-19:** [dominios de relaciones y colecciones](ideas/dominios-relaciones-colecciones.md).
Domain en Many2one/Many2many con dependencias del borrador, AND/OR/NOT mixtos y
reutilización del motor para fuentes de Lista/Card/Kanban. One2many exige distinguir
relaciones seleccionables de filtros visuales que no deben borrar líneas ocultas.
Declaración junto al modelo/fuente, validación y consultas en servidor, conservando
permisos y paginación. Caso inicial: Estado filtrado por País. El contrato y
autorización posteriores sustituyen la propuesta de esta pausa; ver sección actual.

**Guía actual:** [Catálogos de dirección](catalogos-direccion.md). Tickets sigue
retirado. Core/Ajustes y Contactos ya estaban consolidados en fuentes. El usuario
extendió core.partner desde contactosextra con street, exteriorNumber,
interiorNumber, zip y vat; validaciones de CP y formato básico de RFC, sin consulta
SAT/validación de fecha/checksum. PartnerExtraForm personalizado y registrado.
ModelExtensions se ajustó por petición del usuario: vista propia en Fragment sin
FormGroup/legend automáticos; fallback automático conserva FormGroup.

Ubicaciones creado con Pais, Estado, Municipio y Localidad, jerarquía de Many2one
obligatorias/Restrict; claves Text conservan ceros. País tiene código único de dos
letras, normalize trim/mayúsculas y constraint de formato; claves de los demás
modelos no son globalmente únicas. Usuario confirmó sincronizaciones y pruebas
propuestas; agente revisó clases/esquemas/SQL, sin repetir pruebas en navegador.
Se conserva Ubicaciones como módulo compartido. Navegación futura desde
Configuración de Contactos acordada, todavía no implementada.

Contactosextra declara depends ubicaciones. PaisId y estadoId opcionales/Restrict/
tracking ya añadidos y sincronizados por el usuario. Ambos FieldMany2One verificados
en su vista. Constraint validarPaisEstado comprobada: exige País si hay Estado y
consulta select paisId bajo scope de lectura autorizado, usando context.tx/actor
con import dinámico de access/engine. El usuario confirmó la prueba propuesta de
selección/guardado/reapertura, rechazo sin País y ambos vacíos. No hay domains de
lookup ni limpieza automática al cambiar País. Municipio/Localidad aún no están
relacionados con PartnerExtra.

Migraciones revisadas de esta práctica (confirmación de aplicación por el usuario;
no se consultó nuevamente migrate status en esta sesión):

- contactosextra: 20261119023507 exterior_number, 023729 interior_number,
  023945 zip, 030718 vat, 040019 pais_id y 041214 estado_id.
- ubicaciones: 20261119032428 País, 033221 Estado, 034226 Municipio y 035126 Localidad.

Verificaciones propias realizadas durante la sesión: tsc --noEmit y ESLint de
ModelForm tras el cambio de layout, después tsc y ESLint de PartnerExtra con su
constraint. Sin nueva verificación visual ni SQL ejecutado por el agente.
Verificación de este cierre: fuentes del selector Estado y notas contrastadas,
enlaces documentales nuevos y git diff --check limitado a documentación.

Después de resolver domains: aplicar País→Estado en el ejercicio, continuar
relaciones a Municipio/Localidad y coherencia de dirección; revisar lectura de
catálogos para no administradores (ahora admin por defecto), navegación acordada,
e importación oficial más adelante. Condicionar reglas mexicanas CP/RFC antes de
aceptar países extranjeros. Carta Porte/traslado requiere homologación explícita
SAT; no asumir equivalencia de codigo con claves INEGI/SAT. Sin integración fiscal,
catálogos externos, importadores, ni despliegues implementados por esta sesión.

## Prioridad actual: Partner/User nativos y app Ajustes (2026-11-18)

**Guía de extensión Partner iniciada:** el usuario pidió hacer los pasos él mismo.
`contactosextra` ya creado por el usuario con models vacío y registrado en
src/modules/index.ts, verificado en fuentes. Usuario decidió avanzar primero con
dirección básica y después catálogos/APIs. Paso actual: crear models/partner.ts con
PartnerExtra = extendModel(Partner, ...), sólo street Text opcional/maxLength 160/
tracking. Ya creado por el usuario en model/partner.ts (carpeta singular válida),
registrado en extends core.partner y generado en Prisma. Revisada migración
20261118225040_sync_contactosextra: tabla compañera con street nullable, recordId
único/Cascade a Partner, auditoría/FK Restrict a User; sin cambios de columnas en
partners/users. No se consultó migrate status ni se comprobó la persistencia.
Sigue probar Calle en Contactos: guardar/reabrir con texto y luego vacío. La vista
conserva ModelExtensions, así que el campo se presenta automáticamente. Después
exteriorNumber/interiorNumber/zip uno por uno.
No ejecutar create:model para duplicar Partner. No se crearon archivos de aplicación por el agente;
El usuario pidió campos de dirección: calle (street), número, número exterior y
código postal (zip), más ciudad/estado/país seleccionables. Confirmó alcance
principalmente México y números interior/exterior separados.
Investigadas fuentes oficiales: catálogo CP de Correos de México, servicio JSON
geoestadístico INEGI v2 y GeoNames (API/descarga internacional). Recomendación
presentada: catálogos locales reutilizables y Many2one, con códigos/números como
Text; distinguir municipio/localidad si se usa México. Catálogos sin implementación:
no hay modelos geográficos, importaciones, SQL ni llamadas externas desde UI.
Revisión documental: diff --check.

**Vistas de Usuarios personalizadas (2026-11-18):** petición posterior a la base
de fase 5. UserForm/UserList en ajustes/usuarios/views, registrados en core.user;
no se modifica eject:view. Campos explícitos con ModelForm/ModelCollection,
password writeOnly, último acceso readOnly y extensiones futuras conservadas.
ModelExtensions admite excludeFields para no duplicar el contacto delegado que
UserForm ya presenta. Sin SQL ni cambio de permisos. tsc, ESLint focalizado y 13
pruebas form-model y build/HTTP de regresión aprobados: campos delegados una sola
vez, input password y permisos admin; auth/Contactos/tema intactos en su proyecto/
esquema temporal eliminado. Sin revisión visual nueva; git diff --check aprobado. La edición previa
del usuario en ContactForm se conserva. Detalle en [core/Ajustes](ideas/core-ajustes.md#vistas-personalizadas-de-usuarios-2026-11-18).

**Fase 5 iniciada por el usuario.** Contactos ya usa core.partner con ModelRoute,
ModelForm/Collection y permisos efectivos; protección cruzada de revisión con
Usuarios/Perfil implementada. El usuario eligió añadir campos propios mediante
extendModel: dirección básica elegida y street ya declarado en contactosextra.
Sigue número exterior tras confirmar las pruebas de Calle. Detalle y evidencia
actual en [fase 5](ideas/core-ajustes.md#fase-5-en-curso-contactos-declarativo-2026-11-18).
30 pruebas focalizadas, 48 de módulos, 11 de aplicaciones, tsc/ESLint e integración
core temporal aprobados. Build y regresión legacy (auth/Contactos/tema, HTTP
autenticado admin/lector) aprobados; proyectos/esquemas temporales eliminados.
Sin inspección visual nueva. git diff --check aprobado; sin SQL ni consultas
a datos del ERP. Avance actual sin commit; cambios/documentación previos conservados.

Decisión del usuario: pausar Tickets y priorizar un módulo declarativo **nativo**
`core` con Partner y User, sin icono en el cajón, y una app nueva **«Ajustes»** donde
Usuarios será un menú. Motivo: `createBy` legible/agrupable, Many2one a personas desde
cualquier módulo y fase 3 de herencia dependen de que User/Partner sean declarativos.

- **Tickets retirado** por el usuario con «Eliminar datos»: commit `71d3358`, migración
  `20261118165807_uninstall_tickets` (historial y overrides limpios; DROP de tickets_*
  y enums), `src/modules` vacío, ID `tickets` libre. Avance previo en Git en `68a31d5`.
  Comprobado por el agente con consultas de sólo lectura: sin tablas `tickets_*` ni
  actividad, última migración aplicada.
- **Residuo detectado:** `model_sequences` conserva `TicketsTicket.name` (2026, valor 3).
  La retirada no limpia contadores de folios (`cleanupSQL` en operation-engine.ts).
  Pendiente: corrección del framework y limpieza de esa fila, ambas con aprobación.
- **Fase 0 hecha:** inventario y plan en [Partner/User nativos y Ajustes](ideas/core-ajustes.md).
  Decidido por el usuario: Ajustes con Usuarios, Accesos y Módulos; Contactos después como
  app propia que extiende `core.partner`; contacto creado automáticamente al crear usuario;
  Perfil en el avatar. Enfoque A aprobado (adaptador nativo, sin DDL sobre users/partners).
  Decisiones provisionales implementadas: lectura de Partner para cuentas activas,
  User sólo admin y contacto automático en altas. Revisarlas con el caso de Contactos.
- **Fase 1 de core implementada** (rama `codex/core`, commit `dae4f6e`): módulo nativo `core`
  con `core.partner` sobre `partners`, grupo implícito «Usuario interno» con lectura,
  Many2one y `extendModel` hacia Partner desde cualquier módulo sin `depends`. Sin DDL en
  el ERP. Detalle y verificación en [core-ajustes](ideas/core-ajustes.md#fase-1-implementada-2026-11-18-rama-codexcore).
- **Fase 2 implementada** (commit `dae4f6e`): `core.user` sobre `users` con contacto delegado
  (`inherits`), contraseña `writeOnly` hasheada, revocación de sesión, `beforeRemove` y
  Many2one a User. [Detalle](ideas/core-ajustes.md#fase-2-implementada-2026-11-18-rama-codexcore).
- **Fase 3 implementada** (commit `dae4f6e`): app Ajustes con Usuarios (`core.user` vía
  `ModelRoute`), Accesos y Módulos; rutas antiguas redirigen; «Usuario interno» implícito.
  [Detalle](ideas/core-ajustes.md#fase-3-implementada-2026-11-18-rama-codexcore).
- **Fase 4 implementada** (commit `dae4f6e`): `createBy` «Creado por» con etiqueta, filtro y
  agrupación por creador mediante `creatorLookup`. [Detalle](ideas/core-ajustes.md#fase-4-implementada-2026-11-18-rama-codexcore).
  Fase 5 iniciada; ver avance y siguiente campo pendiente arriba.
- Concurrencia User/Partner corregida durante fase 5: Contactos invalida la revisión
  de la cuenta vinculada; Usuarios y Perfil avanzan ambas. Verificaciones nuevas
  en esquema temporal, distintas de las pruebas históricas de fases 1–4.
- En la Mac, `migrate deploy` de la retirada borrará sus datos de Tickets.

## Auditoría en ModelCollection: implementada (2026-11-18)

Esta sección describe la primera implementación. La fase 4 de core, arriba,
la amplió: createBy ya se publica como creador legible, filtrable y agrupable;
no sigue vigente su rechazo descrito en las notas históricas siguientes.

Implementada a petición del usuario antes de retomar Tickets. Caso real:
`{field:"createBy"}` en TicketList se rechazaba por no estar publicado.

- Opción explícita por modelo en el manifest: `{ model, audit: true }`. Publica en la
  política de lista del servidor tres columnas fijas: `createByUser.partner.name`
  («Creado por», contacto con avatar), `createdAt` y `updatedAt`, ordenables y
  filtrables, no buscables ni agrupables. Sin `list.fields`: 9 campos + 3 de
  auditoría (límite 12); con `list.fields` explícito se ubican a mano.
- `ModelClientConfig.audit`; `modelCollection` usa descriptores fijos
  (`auditCollectionColumns` en `src/lib/orm/audit.ts`): sólo label/ancho/orden
  personalizables. `createBy` (ID de User) se rechaza en manifest y vista con mensaje
  que indica la columna legible. Sin `audit: true` no se publica nada.
- El servicio y el repositorio ya soportaban la auditoría (`audit: true` del registro);
  no hubo cambios de SQL, esquema ni migraciones.
- Verificado: test:modules 41/41 (prueba nueva de publicación, columnas fijas, rechazos y
  ubicación explícita), tsc, ESLint y test:capabilities:integration en proyecto/esquema
  temporales con `ensayo.categoria` (`audit: true` en el fixture): orden por
  `createdAt`, filtro por creador, proyección con nombre y fecha sin `createBy` ni
  credenciales, y rechazo de orden por auditoría en un modelo sin la opción. Sin
  navegador ni cambios en archivos de Tickets.
- Siguiente en la tutoría: el usuario añade `audit: true` a `ticket` en su manifest y
  cambia `{field:"createBy"}` por `{field:"createByUser.partner.name"}` en TicketList
  (más fechas si las quiere); después, filtro de Categoría y relación con Técnico.
  Contrato en [Auditoría](auditoria-modelos.md#colecciones-de-módulos-declarativos-audit-true-2026-11-18).

## Historial Many2one: etiquetas autorizadas (2026-11-18)

Corrección autorizada por el usuario tras ver el ID de Categoría en historial.
readActivity resuelve displayName actual por destino/lotes <=100 en la misma
transacción RepeatableRead. Registry usa el lookup del servicio destino con
autorización y reglas vigentes mediante lookupInTransaction, compartido con lookup.
Incluye eventos antiguos sin reescribirlos. Nulos conservan Sin valor; destinos
eliminados/restringidos/no declarativos muestran Registro no disponible sin ID ni
etiqueta antigua. Errores de sesión/consulta conservan el fallo de actividad.
No se modificaron vistas/modelos de Tickets, SQL ni datos del ERP para este fix.
Servicios manuales requieren activityLabels autorizado explícito. Contrato y
semántica de nombres actuales en [Actividad](actividad-registros.md).

Verificación focalizada: 22 pruebas de actividad/servicio/presentación, TypeScript
y ESLint de los archivos modificados aprobados. Incluye deduplicación/lotes,
renombrados, valores vacíos, destinos no disponibles, no reescritura de eventos,
errores y lookup bajo autorización en la transacción proporcionada. test:modules
40/40 aprobado fuera del sandbox (la primera ejecución falló por EPERM de fixtures
temporales). test:capabilities:integration aprobado con PostgreSQL: cambios,
renombrado, regla por registro, denegación CRUD, borrado del destino previo y
revisión intacta. Incluye compilación de rutas/vistas/fixture; proyecto y esquema
temporales eliminados. El intento inicial quedó bloqueado por red del sandbox;
fuera de él, la primera pasada detectó un tipo opcional en una aserción nueva,
corregida, y la repetición completó todas las comprobaciones. Sin comprobación
visual nueva ni build de producción. git diff --check del alcance aprobado.

Simplificación aplicada: lookup y lookupInTransaction comparten autorización,
proyección y displayName; el historial evita duplicar reglas o abrir una transacción
por relación. El avance de tutoría sigue pendiente en el filtro de Categoría.

## Tickets: selector y columna de categoría conectados; sigue filtro (2026-11-18)

El usuario creó Categoria y se verificó su clase generada con name/active y
displayName(name), import y registro categoria en el manifest, conservando las
vistas de Ticket. Siguiente paso del ejercicio 6: añadir minutosRecomendados
Integer obligatorio/min 0/default 0/tracking. Campo ya añadido y revisado: el
primer plan compartido tenía minutosRecomendado en singular; el usuario lo corrigió
a minutosRecomendados y se confirmó en fuentes. Categoria ya aparece en Prisma
y en 20261118155543_sync_tickets: CREATE TABLE con minutos_recomendados,
defaults, índice y FK de creador esperados. El usuario confirmó sincronización y
pruebas propuestas de guardar/reabrir y rechazo de minutos negativos. El agente
revisó esquema/SQL, sin navegador ni consulta de migrate status. El usuario creó
Tecnico: revisados clase con name obligatorio/maxLength 120/tracking,
active default true/tracking y displayName(name), import y registro en manifest.
Tecnico ya aparece en Prisma y la migración 20261118155906_sync_tickets crea
tickets_tecnico con defaults/índice/FK de creador esperados. El usuario confirmó
sincronización y prueba de guardar/reabrir un técnico. Agente revisó esquema/SQL,
sin repetir navegador ni consultar BD. Menú ya declarado con Tickets y grupo
Configuración (Categorías/Técnicos), verificado en fuentes y confirmado por el
usuario. categoriaId Many2one opcional a TicketsCategoria con label Categoría/
tracking true ya añadido y sincronizado según confirmación del usuario. Revisados
clase, Prisma y 20261118160359_sync_tickets: columna nullable, índice y FK Restrict.
El usuario conectó FieldMany2One en TicketForm y confirmó las pruebas propuestas
de búsqueda, selección, guardar/reabrir y limpiar. Fuentes revisadas: selector
categoriaId y columna `{field:"categoriaId"}` ya presentes en TicketList.
Sigue comprobar etiqueta legible en lista y filtro de categoría (seleccionar,
ver resultados, quitar filtro); no crear tecnicoId antes de esa comprobación. Sin consultas
a BD ni pruebas nuevas; revisión de fuentes y git diff --check de documentación.
El chequeo global anterior detectó espacios al final de línea en el manifest;
el usuario lo formateó después. No se modificó ese archivo durante esta revisión.

El usuario continuó tras las instrucciones de recuperación del fallo de colors;
no hay comprobación nueva del navegador del agente que certifique su resolución.

## Tickets: fallo de carga al editar colors (2026-11-18)

El usuario reportó ChunkLoadError al cargar TicketList desde el manifest. El log
local de Next muestra primero `[Server HMR] Update failed, full reload needed:
SyntaxError: Invalid shorthand property initializer`, seguido del fallo de chunk.
La fuente actual `{field:"estado", colors:{nuevo:"neutral"}}` es válida:
TypeScript aprobado, proyección modelCollection con Ticket real acepta la columna
y node --check del chunk indicado pasa. No se cambió código por este diagnóstico.
El error inicial de sintaxis ya no está en el archivo actual; queda por confirmar
recuperación del runtime con recarga completa o reinicio de dev. No se borró .next
ni se iniciaron procesos adicionales. Consulta HTTP local impedida por el sandbox;
sin comprobación autenticada de navegador. No atribuir el fallo a colors ni cambiar
el import dinámico del manifest sin evidencia. Retomar Categoria después de resolver.

## Tickets: ejercicios 4–5 completados; sigue Categoría (2026-11-18)

El usuario añadió compromisoAt DateTime opcional/tracking y compartió el plan:
añadir compromiso_at TIMESTAMPTZ(3) nullable. Después indicó que terminó orm:sync.
Revisión de fuentes confirma clase y Prisma, con migración
20261118145412_sync_tickets que sólo añade esa columna. No se consultó migrate
status ni se verificó persistencia desde navegador del agente. El usuario confirmó
terminar las pruebas de guardar/reabrir fecha y hora y después el campo vacío.
Ejercicio 4 completado por esa confirmación. El usuario completó después el paso
de presentación del ejercicio 5; fuentes verificadas: import displayName,
@displayName("name", "asunto") y retorno folio · asunto con DisplayRecord tipado.
La comprobación visual corresponde a la confirmación del usuario, sin navegador
del agente. No cambió el formato de la serie ni se renumeraron datos.
Sigue ejercicio 6: crear sólo Categoria con create:model, revisar antes de añadir
minutos recomendados o sincronizar. No crear Tecnico ni relaciones por adelantado.

Se encontraron también manifest modificado y vistas locales en tickets/views;
la anotación previa «sin vistas expulsadas» describe el punto del 2026-11-17.
TicketForm usa header para name e incluye FieldDate/compromisoAt type datetime,
comprobado por lectura de fuentes. El manifest también registra TicketList local.
No se editaron esos archivos. Sin pruebas de código nuevas en esta revisión.
El avance nuevo de Tickets sigue sin commit. Revisión documental: git diff --check
aprobado; sin pruebas de código nuevas.

## Sequence: readOnly explícito en la vista (2026-11-18)

Por solicitud del usuario, `sequence` ya no añade `readOnly` al descriptor ni
fuerza esa prop desde useModelField. Los folios persistidos recuperan búsqueda,
filtros y orden con la política de colecciones habitual. FieldText permite
`readOnly` explícito en TSX. Por aclaración posterior del usuario, los campos
con secuencia se presentan con `widget="header"` en formularios: ModelForm lo
elige por convención y eject:view lo declara en las nuevas vistas. La demo
`/sample#model-sequences` usa header, sin input editable. Las vistas personalizadas
existentes no se regeneran. Se conservan
placeholder Nuevo, borrador vacío, required/unique persistidos y protección del
folio en servidor frente a cambios del cliente/hooks/acciones. Sin SQL ni cambios
en Ticket o sus vistas. Contrato actualizado en [Folios](folios-secuencias.md).

Verificación: 10 pruebas focalizadas de secuencias/colecciones y 12 de
test:form-model aprobadas; incluyen consultas de folios, readOnly omitido/false/true
y rechazo de folios falsificados/cambios desde hooks. TypeScript, ESLint de los
archivos de código modificados y git diff --check aprobados. Para la convención
header posterior: 7 pruebas de eject:view, TypeScript y ESLint focalizado aprobados.
Sin navegador ni integración
PostgreSQL nueva; estas pruebas de servidor usan un repositorio simulado.

## Tickets: punto de continuación guardado (2026-11-17)

El usuario pidió guardar el avance para continuar después. Rama revisada:
`codex/tickets`. No crear más campos ni avanzar ejercicios hasta que retome.
Guía vigente: [Tickets desde cero](tutorial-tickets.md).

**Completado:** ejercicios 0–3 y parte del 4. El usuario creó el módulo y Ticket;
manifest/import/registro verificados. El modelo contiene name (folio
TCK/{year}/, padding 6, reset anual), asunto obligatorio/maxLength 160/tracking,
descripcion opcional/maxLength 4000/list false, prioridad baja/normal/alta
(default normal), estado nuevo/enProceso/enEspera/resuelto/cerrado (default nuevo),
estimacionMinutos (min 0/default 0), presupuestoMinutos (min 0/default 120),
requiereVisita (Boolean/default false) y active (default true). Los campos de
prioridad, estado, minutos, visita y activo llevan tracking. displayName devuelve
name; todavía no se expulsaron vistas ni se añadieron reglas de negocio propias.

**Base y migraciones:** el usuario autorizó explícitamente eliminar Flota local.
El agente aplicó las tres pendientes de Flota/core de folios con db:deploy,
regeneró Prisma Client y comprobó entonces migrate status sin pendientes.
Después, el usuario ejecutó los planes y sincronizaciones de Tickets. Verificados
clase, esquema y SQL de estas migraciones (creación o adición aislada esperada):

- 20261118045907_sync_tickets: tabla Ticket, índice único name, creador y FK.
- 20261118050452_sync_tickets: descripcion opcional.
- 20261118051154_sync_tickets: enum/columna prioridad, default normal.
- 20261118051444_sync_tickets: enum/columna estado, default nuevo.
- 20261118051747_sync_tickets: estimacion_minutos, default 0.
- 20261118052138_sync_tickets: presupuesto_minutos, default 120.
- 20261118052359_sync_tickets: requiere_visita, default false.

**Evidencia:** usuario confirmó altas/reapertura y folio, descripción fuera de lista,
persistencia de prioridad/estado, límites de minutos y última prueba de visita.
El agente revisó fuentes/esquemas/SQL; no repitió esas pruebas en navegador ni
consultó nuevamente migrate status tras cada sincronización. Última revisión:
requiereVisita coincide en clase, Prisma y SQL. git diff --check aprobado.
No se crearon registros de práctica desde el agente ni se ejecutaron suites nuevas.

**Siguiente paso al retomar:** continuar ejercicio 4 con `compromisoAt`, DateTime
opcional (fecha y hora de compromiso, instante UTC). Explicar el concepto, pedir
al usuario añadir sólo ese campo y compartir `orm:sync -- tickets --plan`; revisar
antes de aplicar. Después probar guardar/reabrir. No introducir Date sin hora.
Revisar Git y estado real de la máquina al retomar; no asumir que dev sigue activo.
Código, esquemas y migraciones están versionados en `408b593`, comprobado el
2026-11-18. El estado remoto no se comprobó; esta revisión no hizo commit ni push.
El resto del recorrido y los pendientes están en la guía. Flota no se restaura.

## Acciones con parámetros implementadas (2026-11-17)

Autorizado por el usuario. @action admite params declarados con Fields; se derivan
Zod estricto, defaults y metadatos serializables. ActionParams infiere tipos. Firma
nueva record/params/context y legacy record/context conservada. Validación en la
transacción tras permisos/grupos/reglas/revisión; Many2one verifica lectura del
destino. No se invocan getters/toJSON del input. Parámetros inmutables y patch por
el guardado existente, sin mezclar argumentos con valores ni historial del modelo.

ModelForm y FormButton abren ActionParametersDialog, con RHF/Modal separados del
formulario principal. Cancelar no guarda; confirmar valida parámetros, guarda el
documento si corresponde y ejecuta la acción con revisión actual bajo un lock.
ActionParameterError/parameterErrors separados; argumentos confirmados se conservan
en memoria para reintentar mientras viva la instancia. No se reintentan mutaciones.
Sin parámetros durante transiciones Kanban; declaración se rechaza. Sin User/Partner
manuales, uploads, arrays, virtuales ni sequence en parámetros. [Contrato](acciones-parametros.md).

Demo /sample#action-parameters (memoria, sin BD): comprobados en navegador cancelar
sin llamadas, nota obligatoria, orden guardar → acción, rechazo con «rechazar»,
conservación de nota al reabrir y corrección exitosa. Se preserva el título editado y
los parámetros no aparecen en RHF del documento. Sin crear Tickets ni tocar Flota.

Verificación: test:orm 106, test:modules 38, test:form-model 12 y ESLint aprobados.
La integración PostgreSQL test:action-parameters:integration verificó defaults,
tipos, campos extra, actor/grupos/reglas, IDs de destino, revisiones, sesión,
contexto inmutable, firma legacy, errores de negocio y rollback de hooks/historial,
en un proyecto/esquema temporal eliminado. Build y regresiones de One2many/folios
aprobados; cancelación, validación, rechazo y reintento comprobados en navegador. No requiere
migración nueva; la migración de folios y las pendientes de Flota siguen sin aplicar
en la base real. Sin commit ni push; cambios previos conservados.

## Folios por modelo implementados (2026-11-17)

Autorización del usuario tras revisar el ejemplo de `name = Fields.Text({sequence})`.
Text deriva required/unique/readonly y permite borrador vacío mediante formSchema;
ModelForm/FieldText muestran Nuevo sin exigir el número antes de guardar. El
servidor asigna el folio antes de normalize/beforeSave/constraints, rechaza valores
falsificados y protege el resultado tras hooks y acciones. Ediciones conservan
el folio. Contadores compartidos ModelSequence por modelo.campo/período, BIGINT,
upsert atómico y hash de formato dentro de la transacción del documento; cinco
intentos sólo ante P2034 de altas con secuencia. Reinicio anual UTC opcional.

Migración `20261117233000_add_model_sequences` revisada: sólo crea model_sequences.
Prisma Client regenerado. Consulta de status real (sin SQL de escritura): tres
pendientes en localhost:5433/liteerp4_dev/public: 20261117154411_sync_flota,
20261117190856_uninstall_flota y la nueva. **No ejecutar deploy sin revisar las de
Flota: la retirada borra sus tablas en esta Mac.** No se aplicaron migraciones en
el ERP, ni se cambiaron secretos/entornos. No se creó Tickets ni se restauró Flota.

Verificados test:orm (103), test:modules (38), test:form-model (12),
test:orm:install (19), TypeScript, ESLint y build Next 16.4.6 (tres avisos conocidos).
Integraciones sequences, Many2many y One2many aprobadas en proyectos/esquemas
propios, eliminados. Secuencias verificó cinco altas simultáneas, serie por campo,
reinicio UTC, permisos, datos falsificados, cambios de formato, edición/acciones,
fallos en normalize/beforeSave/constraint/afterSave y rollback de contador/documento.
Navegador local: demo RHF/Zod mostró Nuevo/readonly, recibió TCK-2026-000001 del
servidor y volvió al borrador; simulación sin contador ni persistencia real.

[Contrato, migración y límites](folios-secuencias.md). Sin asignación diferida al
confirmar, series por empresa/sucursal, reset manual o nuevos campos sequence en
extensiones/bindings legacy. No se hizo commit ni push. Las piezas previas de
Many2many y su ajuste visual se conservaron en el árbol local.

## FieldRelationTag: etiquetas dentro del control (2026-11-17)

Por solicitud del usuario, etiquetas y buscador comparten un flujo flex con salto
de línea; se retiró la distribución fija en dos bloques verticales. Los botones
Limpiar/Buscar más permanecen dentro y pueden saltar en contenedores estrechos.
Se conservan lista accesible, nombres completos, autocompletado off, RHF, lookup,
validación y callbacks. Demo Many2many añade Cargar ejemplo con dos IDs ficticios.
Verificados TypeScript/ESLint y navegador local: muestra seleccionada, distribución
compacta a 1200 px y salto en ancho de 320 px, Retroceso elimina la última etiqueta
y cargar ejemplo restaura ambas. En controles inline muy estrechos, los nombres
largos ocupan varias líneas. Sin cambios de BD, permisos, commit ni push.

## Many2many declarativo implementado (2026-11-17)

Autorizado por el usuario con «implementa». Declaración Fields.Many2many, tipado,
formSchema/defaults, tabla intermedia gestionada con PK compuesta y FK, repositorio
runtime y validación transaccional de IDs/acceso antes/después de hooks. Revisiones,
rollback y acciones conservados; cambios sólo de vínculos registran un resumen de
actividad. ModelForm, buildModelUI, FieldRelationTag con load autorizado y eject:view
comparten el contrato. Catálogo/retirada reconocen las tablas intermedias mediante
marca interna en el esquema instalado verificado por hashes.

Caso conservador explícito: vínculos existentes a destinos no legibles bloquean
apertura/edición para no publicar IDs ni perder vínculos ocultos. Sin Partner/User,
inversa editable, extensiones, hijos One2many, consultas de colecciones ni reacciones
sobre el arreglo; ver [alcance, ejemplos y límites](relaciones-many2many.md).
Demo ficticia RHF/Zod /sample#many2many-model. No se creó Tickets ni se restauró Flota.

Verificación local Mac: test:orm 99, test:modules 38, test:form-model 11,
test:orm:install 19 y test:module-manager 20 aprobados; tsc, ESLint y build
Next 16.4.6 aprobados (tres avisos previos de trazado). Integraciones Many2many y
One2many aprobadas con proyectos/esquemas temporales, eliminados. La primera incluye
SQL real, permisos/reglas, IDs falsificados, snapshots/actions, rollback tardío,
concurrencia, FK, historial, plan de retirada, eject:view y TS del formulario.
La regresión de extensiones comprobó servicios y Next/RSC por HTTP, pero no terminó:
la retirada con respaldo requiere pg_dump/pg_restore, ausentes en esta Mac. No se
omitió ese requisito ni se ejecutó una retirada sin respaldo. Sin interacción visual
de navegador, SQL en el ERP, cambios de entorno privados, commit ni push.

## Pendiente urgente: capacidades restantes del ORM (2026-11-17)

Prioridad elevada por petición expresa del usuario. Quedan estas capacidades para
incorporar cuando una aplicación concreta las necesite:

- **Permisos por campo:** lectura/escritura autorizadas en servidor y presentación
  por grupo; alcance y criterios en [el diseño pendiente](ideas/permisos-campos.md).
- **Compute persistido:** store:true, recomputación y evolución de datos;
  alcance y criterios en [el diseño pendiente](ideas/compute-persistido.md).

Registrar urgencia no inicia su implementación ni la tutoría de Tickets. Los
contratos pendientes se diseñarán con el caso real, conservando permisos,
transacciones y concurrencia. Esta actualización sólo cambia documentación;
verificada con git diff --check, sin nuevas pruebas de código ni consultas a BD.

## Herencia de modelos: fase 2 (2026-11-17)

Implementada por autorización posterior del usuario, sin esperar a Tickets. La fase
1 permanece en `dd70ff9`; la fase 2 está versionada en `0c0e945`.

- Colecciones publican campos extendidos, con búsqueda/filtros/dominios/orden/grupos
  traducidos a la compañera. Los grupos se paginan en SQL, incluido un grupo vacío
  final, sin descargar registros ni enumerar IDs. Sin compañera: null en consultas,
  reglas y colecciones; defaults sólo al abrir formulario y persistidos al guardar.
  Compute con dependencia obligatoria extendida ausente queda vacío. Añadidos
  filtros vacío/no vacío para numéricos/booleanos y falso SQL explícito para
  filtros vacío sobre campos no anulables.
- `extends` conserva la forma corta y admite `{model, views:{form:()=>import(...)}}`.
  La ruta servidor entrega contenido React mediante ModelExtensionViews;
  ModelExtensions lo monta bajo el mismo RHF/FormView, sin formularios anidados ni
  pasar loaders del manifest al navegador. Sin vista propia conserva el grupo automático.
- El extensor declara reglas para sus destinos explícitos; el catálogo de permisos
  usa contratos compuestos y traduce el alcance antes de usarlo incluso en relaciones.
  CRUD sigue siendo el del base y los grupos locales de @action pertenecen a su
  módulo declarante. Related puede proyectar campos extendidos del destino, con
  enmascarado de registros no legibles. Image reutiliza las firmas autorizadas;
  unique sólo opcional sin default, con índice en la compañera y rollback conjunto.
- Límites conservados: sin Partner/User (fase 3), One2many/líneas ni sensitive en
  extensiones; sin unique obligatorio/con default. Contrato y ejemplos en
  [Módulos declarativos §7](modulos-declarativos.md#7-extender-un-modelo-de-otro-módulo-herencia).
- Verificación en esta máquina Windows: test:modules 38/38, test:orm 92/93 (único
  fallo: EPERM de symlink de archivo en generator.test.ts, ya conocido); filtros
  12/12, comprobaciones focalizadas de servicio/compute/dominios/accesos aprobadas,
  tsc, lint y build aprobados (tres avisos de trazado conocidos).
  test:extensions:integration, test:one2many:integration y test:modules:integration
  aprobadas en sus proyectos y esquemas temporales, incluido el ciclo del gestor.
  test:form-model 10/10. Next/RSC por HTTP autenticado: vista diferida propia,
  Fields enlazados y un solo formulario base. Sin inspección visual ni interacción
  de navegador. La primera comprobación HTTP agotó 90s durante la compilación;
  con margen mayor pasó. El fixture ahora copia .gitignore y acota Tailwind a su
  src para no escanear salidas/respaldos/junctions. No hay subidas externas reales.
- No se instalaron módulos en el ERP, no se creó SQL para sus datos ni se modificó
  Flota. Las pruebas de imagen firman con configuración ficticia, sin subir archivos.

Oportunidad acotada pendiente: compartir el resultado puro de composeModules entre
registro de servicios y catálogo de acceso, que hoy lo construyen por separado.
Motivo: evitar ejecutar los mismos mixins dos veces al iniciar. Aceptación: una
composición inmutable compartida, sin ciclos de importación ni caché de permisos
privados; mismas pruebas de extensiones, módulos y capacidades. No impide usar la fase 2.

## Flota retirada (2026-11-17)

Decisión del usuario tras ensayar el flujo: desinstaló Flota en desarrollo con
«Eliminar datos», hizo merge a `main` y en la base de producción de prueba ejecutó
db:deploy, db:generate y build sin errores (confirmación del usuario).

- Commit `e11bfd8` «flota:remove», en `main` y `codex/flota` (ya en origin): borra
  `src/modules/flota`, deja `src/modules/index.ts` vacío y añade la migración
  `20261117190856_uninstall_flota` (limpia historial, asignaciones, overrides y
  estados de reglas de Flota; DROP de flota_fabricante/modelo/vehicle/mantenimiento).
- `prisma/.app-retirements.json` vacío: el ID `flota` queda libre.
- Código recuperable desde Git en `882a2c8`. Respaldo de la base previa en
  `.module-operations/backup-66282816ac5e6492a681d8c9719f7041/database.dump`, sólo en
  Windows (ignorado por Git); conservarlo si se quieren recuperar esos datos.
- **Mac:** al hacer pull y `migrate deploy`, la migración borrará sus datos de Flota.
- Comprobado por el agente en Git/archivos (rama main al día con origin); sin
  consultas a la BD. La tutoría de Flota queda cerrada; la siguiente guía es
  [Tickets de servicio interno](ideas/tickets-servicio.md).

## Pendiente urgente: distribuir módulos entre proyectos (2026-11-17)

Prioridad elevada por el usuario. Llevar un módulo a otro proyecto mediante ZIP de
fuentes, con exportar/importar y validaciones (compatibilidad, dependencias, choque
de ID, limpieza, seed opcional, extracción segura). La prueba manual del concepto
(copiar carpeta, desinstalar con eliminar datos, pegar e instalar) se razonó con el
gestor actual, sin ejecutarla. Sólo documentación; diseñar y presentar antes de
implementar. [Estrategia](ideas/modulos-distribuibles.md).

## Entornos: separación revertida (2026-11-17)

A petición del usuario se revirtió la separación por ambientes del 2026-11-15
(commits cdb164b y 89513f6) para planear otra estrategia. Motivo: en la máquina
Windows, `.env.local` apuntaba a la base de producción y varios scripts lo leen
directamente (module:manage, prisma/seed.ts, integraciones). Además `npm run build`/`start`
no tenían guarda de rama, ambas bases compartían servidor y rol superusuario, y la
guía describía la configuración de la Mac.

- Código: prisma7.config.ts vuelve a `.env.local`. Se retiraron los scripts
  db:check, db:check:production, db:status:production, db:deploy:production,
  build:production, start:production y test:database-environment, además de
  scripts/database-environment.ts, src/lib/database-environment(.test).ts,
  docker/compose.production-db.yml y docs/entornos-y-bases.md. AGENTS.md y README
  se actualizaron. Se conserva la entrada `/.environment-backups/` de .gitignore.
- Archivos privados (Windows): respaldados en
  `.environment-backups/revert-2026-11-17T15-24-56-386Z/`; `.env.local` usa ahora
  la URL de desarrollo (localhost:5433/lite-erp4); `.env.development.local` y
  `.env.production.local` se retiraron de la raíz.
- No se borró ninguna base ni contenedor: `lite-erp4-production` (vacía, 0 tablas)
  sigue en el servidor local; en la Mac, los contenedores/volúmenes de producción y
  sus archivos privados siguen como estaban. **Al abrir la Mac hay que aplicar el
  mismo ajuste en sus archivos privados** (`.env.local` hacia la base de desarrollo
  y retirar los dos `.env.*.local`), porque Git no los transporta.
- Verificado: `prisma migrate status` contra lite-erp4 (40 migraciones, al día),
  tsc, lint y `npm run build` con Next 16.4.6 (tres avisos de trazado conocidos).
  Sin SQL, sin cambios de datos, sin commit.
- Estrategia acordada el 2026-11-17: bases por entorno, producción con Docker
  Compose sólo en la máquina Windows (carpeta aparte con `main`), Mac sólo
  desarrollo, `APP_ENV` y helper único de configuración. Implementación pendiente
  de autorización. [Estrategia y plan](ideas/entornos-bases.md).

## Relaciones con reglas del destino (2026-11-17)

Corrige la fuga de etiquetas Many2one: lookup y etiquetas de lista ya aplicaban el
alcance del destino, pero las rutas de `@displayName` (p. ej. Modelo →
`fabricante.name`) y los campos `related` (formulario y colecciones) se proyectaban
sin las reglas del modelo destino. Ahora `createModelService` acepta
`relationAccess` y el registro de módulos lo resuelve con `authorizeModel` (lectura
y reglas, superusuario sin restricción) en la misma transacción, por lotes y con
caché por operación (`src/lib/orm/relation-access.ts`). El repositorio declarativo
carga el ID de cada salto y enmascara como null lo no legible y lo que cuelga de él.
Decisión del usuario: lo no legible se muestra **vacío**; también se cambiaron
«No disponible»/«Selección no disponible» por vacío en celdas, grupos y FieldMany2One.
El ID guardado se conserva. User/Partner no tienen reglas de módulo. Repositorios
generados por orm:bind (scaffold legacy, sólo admin) ignoran el parámetro.

Pendiente conocido: asignar al guardar una referencia que el actor no puede leer
todavía no se rechaza (autorización de referencias).

Verificado: tests nuevos de enmascarado (4) y etiquetas (5), test:orm 91/92 (el fallo
es EPERM de symlinks en Windows), modules 28, list-grouping 16, list-selection 8,
form-model 10, relation-filter 1, access 5; test:modules:integration completa con la
regla nueva del fixture (categorías activas para usuario y related categoriaNombre:
formulario, lista, etiqueta vacía e ID conservado) y test:one2many:integration; tsc
y lint. Sin navegador ni cambios en Flota o datos reales. Sin commit.

## Política de contraseñas: mínimo 8, máximo 72 bytes (2026-11-17)

Decisión del usuario: sustituye la política 4–8 del 2026-11-11. `newPasswordSchema`
exige al menos 8 caracteres y como máximo 72 bytes UTF-8 (límite de bcrypt), sin
reglas de símbolos/mayúsculas ni recorte. Aplica a altas y cambios en Usuarios y
Perfil; las credenciales guardadas (incluido el admin del seed con `1234`) siguen
entrando, porque login y contraseña actual no cambian. Corregida la inconsistencia
de UserEditor y el texto de ChangePasswordForm; docs/authentication.md actualizado.
Verificados test:auth (9) con límites 7/8/72/73 y multibyte, test:auth:integration
en proyecto/esquema temporales, tsc y ESLint. Sin cambios de datos ni de hashes.

## Idea inicial de Tickets (2026-11-17; sustituida por la guía)

El usuario autorizó después preparar el recorrido completo desde cero. Seguir
[tutorial-tickets.md](tutorial-tickets.md) y el punto de continuación al inicio de
este estado. Los ejercicios aún no comienzan. Folios, parámetros y Many2many ya
existen; Date sin hora, adjuntos y avisos después del commit siguen pendientes.

## Herencia de modelos entre módulos: fase 1 (2026-11-17)

Implementada a petición del usuario en la rama `codex/herencia`, commit `dd70ff9`.
Equivalente al `_inherit` de Odoo con mixin `extendModel` y `super`:

- `src/lib/modules/extend.ts` (API), `define.ts` (`extends`, validación y modelo
  compañero; compilación por modelo extraída a `compileModuleModel`), `compose.ts`
  (composición en el registro por dependencias), `repository.ts` (select/create/upsert
  anidados, defaults sin fila), `ModelForm.tsx` (`<ModelExtensions />` y grupo por
  extensión), plantilla de `eject:view`, inventario del gestor (`extends` → modelo
  compañero) y `onDelete: "Cascade"` interno en FieldMetadata.
- Hallazgo: los decoradores legacy no admiten clases anónimas; la clase se declara con
  nombre dentro del mixin.
- Verificado: test:modules 34 (6 nuevas), test:extensions:integration en proyecto/esquema
  temporales (instalar base y extensión, SQL con Cascade/único y sin tocar la tabla base,
  registro previo con defaults, guardado/creación/revisión, super, acción e historial,
  accesos del base, cascada, desinstalar base bloqueado, eliminar extensión con respaldo),
  test:modules:integration y test:one2many:integration (regresión), tsc, lint y build.
  Sin navegador: la UI del grupo de extensión no se revisó visualmente.
- La fase 2 se dejó pendiente al cerrar este commit y posteriormente fue autorizada
  e implementada: ver la entrada de fase 2 al inicio de este documento. Fase 3: Partner/User.
  [Diseño y criterios](ideas/herencia-modelos.md).

## Flota: intervalo recomendado con @onchange (2026-11-17)

Ejercicio completado por el usuario: Modelo.intervaloServicioKm (migración
20261117154411_sync_flota, sólo ADD COLUMN con default 10000), FieldNumber en
ModeloForm y @onchange proponerIntervalo en Vehicle con tx de sólo lectura.
Validado por el usuario en el navegador (proponer, cambiar, ajuste manual
conservado, existente sin cambios, rechazo de 0). Agente: revisión de fuentes y
SQL, tsc y carga de reactionRules; `prisma migrate status` al día. Sin commit.
Detalle en [tutorial](tutorial-flota.md). Se conserva la consulta explícita con tx; las rutas en reads quedan como
[sugerencia condicionada](ideas/rutas-reads.md), no como pendiente activo.

## Cierre de Flota y siguiente ejercicio pendiente (2026-11-17)

Usuario pidió guardar el progreso y dejar el próximo ejercicio sin implementar.
Vehicle declara intervaloServicioKm (Integer obligatorio, default 10000, min 1,
tracking); VehicleForm lo muestra con FieldNumber dentro de Stack. La migración
20261117020637_sync_flota añade únicamente intervalo_servicio_km INTEGER NOT NULL
DEFAULT 10000. SQL y fuentes revisados; el usuario indicó que terminó orm:sync,
sin comprobación independiente de aplicación en BD por el agente.

finalizarMantenimiento exige estado mantenimiento y una línea con el kilometraje
actual del vehículo; devuelve disponible y proximoServicioKm = kilometraje +
intervaloServicioKm. Usuario confirmó rechazo sin la línea y éxito al registrarla,
y cálculo con intervalo personalizado. También dio por terminado el bloque tras
la prueba propuesta desde Kanban; no hubo repetición independiente en navegador.
El acceso heredado de Mantenimiento según Vehicle quedó confirmado por el usuario.

**Pendiente al retomar:** intervalo recomendado por Modelo, aplicado a Vehicle al
seleccionar modeloId mediante @onchange, permitiendo ajuste individual. Aún no se
añadió el campo a Modelo ni se implementó la reacción. Revisar primero el contrato
actual de decoradores/reacciones y el acceso autorizado a la relación; distinguir
la ayuda del navegador de la validación definitiva en servidor. No sobrescribir
el intervalo personalizado en cada guardado. Guiar un paso cada vez: campo en
Modelo → revisar sincronización → presentación en su formulario → reacción en
Vehicle → pruebas de selección/cambio y ajuste manual. No adelantar sus archivos.

Git observado al cierre: HEAD 2f0707f (cambios de acceso revertidos), cambios locales
del ejercicio en Vehicle/VehicleForm, esquema/registro de instalación, migración
y tutorial. Este cierre sólo actualiza documentación; sin commit, push, SQL ni
pruebas nuevas de ejecución. Next 16.4.6 conserva la verificación del bloque anterior.

## Actualización de seguridad de Next.js (2026-11-16)

Revisión del 2026-11-17 en otra máquina: `next upgrade --agent=security` volvió a
proponer 16.4.3 → 16.4.6 porque node_modules local no se había reinstalado; fuentes,
lockfile y agentUpgrade ya estaban en Git (2f0707f, origin/codex/flota). Con dev
detenido se ejecutó `npm ci`: next --version 16.4.6, npm audit --omit=dev sin
vulnerabilidades (7 moderadas sólo en dependencias de desarrollo), tsc, lint y
`next build` aprobados con los tres avisos de trazado conocidos. Esa máquina no tenía
`.env.development.local`: `npm run build` falla en `prisma generate` por falta de
DATABASE_URL; se generó el cliente con una URL ficticia sólo para el proceso (no
conecta). Crear ese archivo privado por máquina según [estrategia de entornos vigente](ideas/entornos-bases.md).
GitHub no se consultó: gh no está instalado.

Ejecutado `next upgrade --agent=security`: objetivo seleccionado 16.4.6 desde
16.4.3. Next y eslint-config-next quedan fijados en 16.4.6; lockfile actualizado
y experimental.agentUpgrade="security" en next.config.ts. Commit 9e52b62 en
codex/next-security-16-4-6, verificado en worktree aislado; los mismos tres archivos
están aplicados en el checkout codex/flota, conservando la reversión de Accesos.
Verificados instalación npm ci, next --version, ESLint, 113 pruebas de access,
applications, form-model y orm, y build con TypeScript en el checkout actual.
Persisten tres avisos previos de trazado del gestor de módulos. No se ejecutó SQL.
Sin push ni PR: gh no está disponible para consultar duplicados abiertos.

## Accesos ampliado: revertido y pendiente (2026-11-16)

El usuario pidió retirar las ampliaciones recientes de Accesos por dudas sobre su
funcionamiento y retomarlas más adelante. Se eliminan catálogo de modelos/Fields,
editor de menús, filtros de navegación por ocultación y sus refactors auxiliares.
Se recupera la versión básica de grupos, miembros, ajustes CRUD y reglas.
[Alcance futuro pendiente](ideas/access-manager.md).

El commit ffe0e9f mezcla estas ampliaciones con Flota/One2many: reversión selectiva
en el árbol de trabajo, sin revertir todo el commit ni reescribir Git. Se conservan
Flota, cambios visuales de formularios, One2many, validaciones y acceso de líneas
por el padre. Las asignaciones y permisos básicos de la base no se modifican.

Se conserva la migración ya aplicada 20261116221339_add_menu_visibility y se añade
20261117013335_revert_menu_visibility (DROP sólo de access_menu_hidden), aplicada
con aprobación en localhost:5433/liteerp4_dev/public. Había 0 filas. Respaldo JSON
privado verificado en .environment-backups/access-menu-revert-2026-11-17T01-42-59-566Z.json;
no versionarlo. El comando comprobó el checksum de la migración original y que sólo
la reversión estaba pendiente; deploy confirmó todas aplicadas. Producción intacta.
Prisma Client regenerado y rutas retiradas de la compilación.

Verificados test:access (5), test:applications (10), test:module-manager (20),
test:capabilities:integration y test:one2many:integration en esquemas temporales,
Prisma validate, TypeScript, ESLint y build (repetido tras el aviso de seguridad
conocido de Next.js). Pruebas temporales limpiadas. Git confirma que esta reversión
no modifica src/modules/flota, src/lib/orm, src/lib/modules ni src/components.
Reiniciar dev si algún proceso conserva el cliente/rutas anteriores. Trabajo en el
árbol local; no se creó commit ni se reescribió el historial Git.

## Flota: acceso heredado a las líneas (2026-11-16)

El usuario confirmó validaciones de fecha futura y kilometraje del padre, también
desde la vista independiente del hijo. Confirmó pruebas de los grupos consulta,
operador y responsable con cuentas no administradoras: lectura, creación/edición y
eliminación según lo declarado en manifest. Eligió que Mantenimiento sólo vea
registros de vehículos a los que el actor tiene acceso.

El núcleo de accesos ahora deriva el propietario desde One2many y combina con
AND el alcance de lectura actual del padre. Protege consultas directas, listas,
lookups y escrituras; no enumera IDs ni duplica domains. La lectura del padre no
otorga CRUD al hijo. Capabilities niega el hijo si falta permiso de lectura del
padre. No requiere regla adicional en manifest de Flota ni cambios de BD.
Verificados test:access (5), test:modules (28), test:one2many:integration,
test:capabilities:integration, TypeScript y ESLint. Build aprobado al repetirlo,
con los avisos previos de trazado y un aviso de seguridad de Next.js instalado:
la primera ejecución se detuvo por ese aviso después de compilar; no se actualizaron
dependencias entonces; actualización a 16.4.6 verificada en la sección anterior. Las integraciones
eliminaron sus proyectos/esquemas temporales, sin datos reales modificados.

## Flota: líneas operativas y ajuste visual (2026-11-16)

El usuario añadió mantenimientos (One2many con inversa vehicleId) a Vehicle y
sus columnas name/fecha/kilometraje dentro de NotebookPage en VehicleForm.
Confirmó crear, editar sin duplicados, quitar/revertir y guardar líneas. Añadió
@constraint("fecha") en Mantenimiento para impedir fechas futuras; código revisado,
falta confirmación explícita de su rechazo en una prueba funcional.

A petición del usuario, NotebookPage ya no añade padding al contenido y
FieldOne2many anidado omite su borde exterior para conservar sólo el del Notebook.
FieldOne2many elimina el encabezado con contador; Agregar línea queda debajo de
las filas, conservando límites, permisos y bloqueo durante el guardado. Aplicado a
los componentes compartidos. TypeScript, ESLint y test:form-model (10) aprobados.

## Mantenimiento: primera creación confirmada (2026-11-15)

Usuario confirmó creación real de Mantenimiento. Dev fue reiniciado por el usuario:
el agente detuvo el proceso previo de este repo pero se rechazó permiso para el
nuevo arranque fuera del sandbox. No asumir sesión de proceso activa del agente.
Usuario confirmó reapertura/edición del hijo con «LISTO». One2many declarativo
ya está implementado en el framework: contrato Fields.One2many, columnas JSX,
servicios de padre/hijo en una transacción, permisos/reglas/revisiones y rollback.
[Guía y alcance](lineas-one2many.md). Demo local sin persistencia en
/sample#one2many-model. La integración posterior del usuario en Vehicle/VehicleForm
ya está confirmada (ver estado superior). Mantenimiento
ya existe, está sincronizado y fue probado por el usuario; aún sin menú ni permisos
no admin. La inversa vehicleId es required/Restrict. No hay que crear otro modelo.

Validación del bloque: test:orm (88), test:modules (28), test:form-model (10),
test:orm:install (19), integración PostgreSQL aislada test:one2many:integration y
regresión test:capabilities:integration aprobadas; TypeScript/ESLint aprobados.
Build aprobado con los tres avisos previos de trazado dinámico del gestor de
módulos. Revisado en navegador agregar/quitar/validar/revertir, autocomplete off,
filas adaptadas al móvil y columnas en escritorio; marcadores Column estables en
Fast Refresh. Sin SQL en el proyecto real ni datos de Flota modificados por el agente.

## Pendiente: Módulos distribuibles (2026-11-15)

Usuario pidió registrar el alcance refinado: ZIP de fuentes para descomprimir y
colocar en src/modules, comando de validación/registro y posterior despliegue
normal. No instalación dinámica en producción. Sintaxis de empaquetado sugerida
orm:build -- <modulo> --dist, aún no implementada; reconocimiento/versiones y
colisiones por diseñar. [Alcance y criterios](ideas/modulos-distribuibles.md).
Sólo documentación, comprobada con git diff --check. No ZIP, registro, cambios de
aplicación, SQL ni despliegue; continúa pendiente el inicio guiado de Mantenimiento.

## Tutoría: inicio de Mantenimiento como líneas (2026-11-15)

Usuario confirmó continuar con cabecera/líneas después de validar el flujo de
finalizar mantenimiento. Primer paso guiado: create:model -- flota Mantenimiento;
usuario ya lo creó: mantenimiento.ts con name/active/displayName e import/registro
en manifest verificados. Rama observada ahora codex/flota. Siguiente paso guiado:
vehicleId añadido con required/Restrict/tracking, destino corregido a FlotaVehicle y verificado. Siguiente: fecha DateTime
obligatoria con tracking para fecha/hora del servicio ya añadida y verificada.
Kilometraje Integer required/min 0/tracking sin default ya añadido y verificado;
label Kilomegraje requiere corrección a Kilometraje. Siguiente: personalizar name
name como Trabajo realizado required/maxLength 300/tracking ya verificado,
con displayName conservado. La errata Kilomegraje del label persiste; corregirla.
Siguiente: usuario ejecuta orm:sync -- flota y comparte SQL antes de aprobar
(nueva tabla de mantenimiento y FK, sin eliminaciones). Usuario compartió SQL 20261116032204_sync_flota (nueva tabla, índices, FK
Restrict a vehículo/autor), se revisó y usuario confirmó sincronización terminada.
Esquema y SQL verificados en archivos; sin consulta independiente de BD. Próximo:
reiniciar dev y probar crear/guardar/reabrir Mantenimiento con administrador en
/erp/flota/mantenimiento. Aún sin menú ni permisos de usuarios para este modelo.
Agente no ejecutó SQL ni modificó sus fuentes. No se crearon archivos de Flota por el agente ni se sincronizó el modelo.
La ampliación de Fields.One2many y guardado anidado ya está implementada y
verificada; queda conectarla a Vehicle durante la tutoría (ver estado superior).
Desarrollo en liteerp4_dev; no retirar Flota ni desplegar
producción todavía. La retirada del piloto se hará al final con revisión/respaldo,
y el usuario hará el merge a main después. Ningún cambio de app/SQL por esta nota.

## Separación de bases y entornos (2026-11-15, continuación vigente)

Usuario pausó tutoría para configurar producción (main) y desarrollo (staging_v1,
staging_v4, codex/flota u otras). Rama real observada staging_v1. Eligió producción
vacía. Se creó liteerp4_production con imagen postgres:18.3, volumen nuevo
liteerp4_production_data y puerto loopback 5434; DB lite_erp4_production y rol propio,
credenciales nuevas sólo en archivos ignorados. Sin migraciones, seed ni tablas.
Se preservaron postgres18, postgres_postgres_data y el volumen previo de nombre
similar lite_erp4_production_data. Desarrollo conserva liteerp4_dev_data y su BD
liteerp4_dev en 5433; el contenedor estaba desconectado de red, se reinició y se
reconectó a bridge sin recrearlo ni alterar sus datos.

.env.production.local actualizado a producción nueva; .env.development.local
conservado, .env.local alineado con desarrollo para scripts legacy y retirada la
URL ficticia de .env. Copias privadas locales en .environment-backups/ ignorado.
Compose versionado sólo para producción; no contiene contraseñas. Nuevos comandos
Prisma de conexión/status/deploy por ambiente y build/start explícitos de producción;
escrituras/despliegue producción requieren main, sin cambiar el significado de Git
ni NODE_ENV. No commit/push/merge ni despliegue de esquema de producción.
[Estrategia vigente; la guía anterior fue retirada](ideas/entornos-bases.md).

Verificación real de lectura con el constructor Prisma: desarrollo conecta a
liteerp4_dev con 10 tablas; producción a lite_erp4_production con 0. Dos pruebas
nuevas de guardas/credenciales, TypeScript y ESLint aprobados. No se ejecutaron
migraciones/SQL de negocio ni se modificaron registros. Docker estuvo fuera de PATH
en la sesión del agente; binario encontrado bajo Docker.app y usado explícitamente.
Falta únicamente integrar estos cambios mediante Git cuando el usuario lo autorice
para disponer de los nuevos comandos en main; archivos privados se configuran por
máquina/worktree. Retomar tutoría de Mantenimiento después de esta pausa.

## Pendiente acordado: compute con store:true (2026-11-15)

Usuario pidió anotarlo para cuando lleguemos a un ejemplo real; no implementarlo
ahora. Se propone persistir el resultado de compute/@depends con recomputación de
servidor, contratos no editables y diseño explícito de invalidación/migración de
registros existentes. No hay API disponible ni cambios de código/SQL por esta nota.
[Alcance y criterios](ideas/compute-persistido.md). Documentación comprobada con
git diff --check; no se repitieron pruebas de código por esta anotación.

## Compute en colecciones (2026-11-15, continuación vigente)

Ampliación solicitada e implementada: Fields compute se publican como lectura en
las colecciones modulares (list:false excluye); las vistas TSX declaran la columna
sin repetir fórmula. Lista/Card/Kanban y hojas de agrupación reutilizan @depends
para la página autorizada dentro de RepeatableRead/READ ONLY. Sin consultas extra
de dependencias por registro añadidas por el framework; métodos de cálculo del
usuario deben evitar sus propios N+1/efectos externos. No ejecuta onchange ni hooks.
Dependencias publicadas obligatorias y salida validada completa; sólo list.fields
llega al cliente. CollectionFields generado incluye compute readOnly. Sin store,
SQL nuevo, filtros/orden/búsqueda/grupos virtuales ni cambios de Flota adelantados.
[Contrato](campos-calculados.md#lista-card-y-kanban-2026-11-15).

Verificación actual: 85 pruebas ORM y 28 de módulos (113), TypeScript, ESLint de
afectados y build aprobados; tres avisos de trazado filesystem previos. Integración
test:capabilities:integration aprobada en proyecto/schema/cuentas desechables,
incluido compute real y rechazo SQL de un intento de escritura desde el cálculo;
recursos eliminados. Dos intentos previos se detuvieron por tipado de pruebas nuevas,
corregido antes de la ejecución final. No incluye ciclo de retirada/purga/respaldos.
En /sample#computed-collections se verificaron Lista/Card/Kanban con mismos valores,
cero y negativos, sin filtro del virtual. Fuentes ficticias públicas, sin BD.
No se ejecutaron operaciones sobre registros reales del ERP ni migraciones propias.

Flota: clase compute ya declarada por el usuario, y controles proximoServicioKm/
kilometrosRestantes ya presentes y verificados en VehicleForm. No se modificaron
sus archivos por esta ampliación. El usuario ya añadió
{field:"kilometrosRestantes"} a VehicleList y se verificó en fuentes. El usuario confirmó cálculo positivo/cero/negativo en formulario y lista tras
guardar. Siguiente ejercicio propuesto: finalizarMantenimiento actualiza estado
y proximoServicioKm al kilometraje actual + 10000, con intervalo fijo de práctica,
sin nuevos campos ni SQL; usuario ya modificó el return y se verificó en fuentes.
El usuario confirmó «listo, funcionó» para la prueba del botón sobre borrador con
kilometraje aumentado: guardado previo, objetivo +10000, compute 10000 y reapertura/
historial. Confirmación del usuario, sin repetición con datos reales del agente; no requiere orm:sync en este módulo por el soporte.
Exportar a Excel sigue como idea futura, sin implementación en este alcance:
[pendiente](ideas/exportar-excel.md).

## Próximo ejercicio de Flota (2026-11-15)

Tras la práctica de kilometraje/context.previous el usuario expresó conformidad
y pidió continuar. Propuesto un compute virtual: kilómetros restantes para el
próximo servicio. Primer paso guiado: declarar proximoServicioKm Integer
(required/default 20000/min 0/tracking). Campo añadido por el usuario y verificado: required/min 0/tracking correctos,
default corregido a 20000. SQL 20261116001156_sync_flota revisado (sólo añade
proximo_servicio_km INTEGER NOT NULL DEFAULT 20000) y usuario confirmó orm:sync
terminado. Fuentes/archivo SQL verificados, sin consulta a BD. El usuario declaró kilometrosRestantes compute y calcularKilometrosRestantes
con @depends(proximoServicioKm,kilometraje), resta o null; verificado en fuentes.
Siguiente: controles editable proximoServicioKm y display kilometrosRestantes en
VehicleForm, luego prueba de reacción. ModelClientConfig proyecta reglas/preview
desde la clase en runtime; sin SQL por el virtual. Sin fuentes adelantadas.
El compute sigue sin store; la ampliación vigente de colecciones está documentada arriba.
Llamadas entre clases quedan para pulir ante un caso real, según acuerdo del usuario.

## Tutoría: perfiles comprobados (2026-11-15)

El usuario dio por completadas las pruebas de Consulta, Operador y Responsable:
consulta bloqueada, edición/mantenimiento de vehículos propios y gestión de todos
con Responsable; Fabricantes/Modelos en consulta. Confirmaciones del usuario;
no se repitieron en navegador con cuentas reales desde el agente.
El usuario añadió @constraint("active", "estado") y validarDesactivacion en Vehicle;
import, condición y Err asociado a active verificados en fuentes. El usuario confirmó la prueba
funcional del rechazo conservando borrador, Revertir y posterior desactivación tras
finalizar mantenimiento. Siguiente ejercicio: kilometraje Integer (default 0,
min 0, tracking), luego sincronización/formulario y regla con context.previous
para impedir disminuciones. El usuario ya declaró kilometraje con required/default 0/min 0/tracking; verificado
en fuentes. El usuario compartió y aprobó tras revisión la migración 20261115232209_sync_flota
(sólo kilometraje INTEGER NOT NULL DEFAULT 0) y confirmó finalización de orm:sync.
SQL y campo Prisma verificados en archivos, sin consulta independiente de BD.
El usuario añadió FieldNumber name=kilometraje type=integer en Stack de
VehicleForm, con import verificado. El usuario confirmó guardado/reapertura de 15000, rechazo de negativos y Revertir.
Siguiente paso: comparar kilometraje con context.previous dentro del beforeSave
existente y rechazar disminuciones mediante Err. Comparación añadida por el usuario y verificada dentro del beforeSave existente:
guardas number, Err asociado a kilometraje, consulta de Modelo y return conservados.
Pendiente prueba funcional de disminución rechazada/valor igual o mayor permitido
y reapertura; no requiere orm:sync por esta lógica. Sin fuentes adelantadas. No cambian campos/esquema ni requiere orm:sync por esta lógica.
El agente no modificó las fuentes de Flota ni ejecutó migraciones/SQL.

## FormView sin modal de carga (2026-11-15)

Petición implementada: FormViewLoader muestra marco estático y «Cargando registro…»
en cabecera, sin alerts.loading, backdrop ni transferencia de foco. No monta Fields
editables antes de cargar datos. FormView mantiene el formulario al guardar,
bloquea controles con el mecanismo existente y añade indicador discreto en cabecera;
conserva botón Guardando y anuncio accesible del footer. No se altera guardado,
validación, permisos, revisión, dirty guard, errores/reintentos ni timeout.
Errores y confirmaciones conservan sus diálogos. Sin cambios de Flota ni SQL.

Verificación de esta tarea: 21 pruebas existentes de formulario/navegación,
TypeScript y ESLint de afectados aprobados. En navegador /sample#alerts se observó
carga integrada con cero diálogos Cargando; en /sample#form-view el campo Referencia
quedó bloqueado mientras guardaba y volvió habilitado con el valor guardado.
Las acciones de ejemplo tienen 600 ms de latencia para observar el ciclo, sin BD.
No se repitió build en esta modificación de presentación; los builds anteriores
corresponden a las tareas previas. [Contrato](../src/components/ui/form/FormView.md).

## Filtros Many2one corregidos (2026-11-15)

Diagnóstico confirmado: Modelo en Vehículos mostraba $labels pero Contiene buscaba
texto en modeloId. Fix autorizado e implementado en componentes compartidos:
ColumnFilter usa búsqueda autorizada/paginada y selección; igualdad/desigualdad
aplican el ID guardado, vacío/tiene valor conservan semántica previa. ModelCollection
conecta config.lookups a modelLookup; Lista/Card/Kanban consumen filterLookups.
Sin cambios en Flota, modelos, SQL, permisos, búsqueda general ni orden.
[Contrato](vistas-colecciones.md#filtros-many2one-por-selección-2026-11-15).

Pruebas de esta tarea: filtro 1, carga 4, módulos 27 y Kanban 4; ESLint de afectados
y TypeScript/build aprobados (tres avisos previos de trazado filesystem).
Demo /sample#relation-filter comprobada en navegador:
buscar Corolla, seleccionar Toyota / Corolla, URL con ID model-1, un vehículo
coincidente, reapertura conservando nombre/selección, desigualdad y vacío. Sólo datos ficticios;
no se accedió a registros reales. Los filtros antiguos Contiene deben quitarse y
reaplicarse por selección. Las vistas manuales pueden conectar filterLookups;
sin él mantienen compatibilidad. No exige orm:sync.

## Carga y recuperación compartida (2026-11-15, continuación vigente)

Implementada la opción 2 autorizada por el usuario: useCollectionLoad comparte
invalidación de respuestas antiguas, excepciones de conexión y reintentos entre
Lista/Card, ramas agrupadas y columnas Kanban. La cancelación es lógica; las
Server Actions enviadas pueden terminar sin publicar su respuesta si ya caducó.
Cada columna/rama conserva independencia; Kanban conserva páginas al reintentar,
deduplica y vuelve a página uno al cambiar proveedor. Sin reintentos automáticos
de escritura ni cambios de permisos, clases/datos de Flota o SQL.
[Contrato y demo](colecciones-modelos.md#carga-respuestas-antiguas-y-recuperación-2026-11-15).

Verificación de esta tarea: 43 pruebas aprobadas (carga 4, Kanban 4, módulos 27,
selección/eliminación 8), ESLint de afectados, TypeScript y build de producción.
El build conserva los tres avisos previos de trazado filesystem del gestor. En navegador se
comprobaron error/reintento en Lista y Tarjetas, fallo aislado de Por hacer con
las demás columnas disponibles y carga incremental hasta 8/8. La simulación es
ficticia en /sample#collection-core; no se tocaron registros reales.

Siguiente paso: retomar guía de Flota con un ejercicio por vez. Primero recargar
y comprobar navegación/presentaciones/capacidades con las cuentas ya configuradas.
Acciones disponibles automáticamente por estado (opción 1) siguen como propuesta,
sin implementación autorizada en este bloque. No adelantar archivos de aplicación.

## Capacidades efectivas (2026-11-14, continuación vigente)

Implementadas tras autorización del usuario: proyección por actor compartida en
ruta, menús/cajón, ModelForm y ModelCollection. Consulta bloquea campos/statebar
y oculta guardar/revertir/acciones; Nuevo, Eliminar y movimientos Kanban respetan
sus permisos independientes y grupos de acciones. Herencia y overrides se cargan
en lote por petición, sin caché privada global. Grupos vacíos desaparecen y la
entrada raíz elige el primer modelo legible. El servidor conserva autorización
transaccional y reglas por registro. [Contrato](capacidades-modelos.md).

Flota recibe el comportamiento por los componentes/rutas compartidos, sin nuevas
ediciones de sus clases, datos, usuarios ni asignaciones. No requiere orm:sync.
Permisos por campo/presentación desde Accesos y fallback de lookups siguen pendientes.

Verificación: 144 pruebas unitarias/contrato aprobadas, ESLint de afectados,
TypeScript y build; tres avisos previos de trazado filesystem. La integración
focalizada test:capabilities:integration pasó con proyecto/schema/cuentas propios,
incluyendo rechazos del servidor y limpieza. No incluye retirada/purga/respaldos
ni reemplaza la suite completa de lifecycle limitada antes por pg_dump ausente.
En /sample#model-capabilities se comprobaron consulta, acciones por perfil,
eliminación sin edición y conservación del borrador; sin datos reales.

Siguiente ejercicio: recargar Flota y contrastar Consulta/Operador/Responsable con
sus permisos reales; revisar Nuevo, guardar, acciones, movimientos y menús. No
conceder permisos a cuentas reales como parte de una comprobación automática.

## Núcleo de colecciones y multivistas (2026-11-14, continuación vigente)

Implementado por petición expresa del usuario: una colección compartida y sus
presentaciones Lista/Card/Kanban. ModelCollection conecta proyección/capacidades,
proveedores autorizados, enlaces, consulta y extensiones Kanban. Las vistas TSX
declaran columnas/widgets/renderers; ya no repiten selección de campos, loaders,
grupos ni modelMove. Los componentes base siguen disponibles y los servicios
de negocio/permisos no se modificaron. [Contrato](colecciones-modelos.md).

Manifest view elige inicial; views.list/card/kanban permite true o loader diferido.
La ruta compartida resuelve sólo vistas registradas y muestra selector con varias
alternativas. URL conserva búsqueda/filtros/orden/tamaño y reinicia página, grupos
y selección; queryColumns conserva capacidades de campos no dibujados. Lista/Card
paginan la misma consulta; Kanban conserva carga por columna, conteos y @action.
Nuevo/apertura/breadcrumb/guardado de ModelForm conservan returnTo validado para
volver a la presentación y consulta originales. Los namespaces propios se soportan
cuando CollectionViews y ModelCollection usan el mismo paramPrefix.

eject:view admite form/list/card/kanban, preflight y dry-run; registra cada clave
por separado y permite expulsar un true. No sobrescribe archivos/loaders, ni exige
SQL. Kanban requiere configuración válida antes de escribir. Pruebas de registro,
plantillas y conservación de personalizaciones con fixtures independientes.

Flota adaptada dentro del alcance autorizado: VehicleList conservado, VehicleKanban
simplificado y VehicleCard añadido con logo/matrícula/estado; tres vistas registradas,
Kanban inicial. Modelo conserva su Card personalizada inicial y añade Lista por
convención. Formularios/diseños del usuario preservados salvo retorno compartido;
sin cambiar estados, métodos, reglas de acceso ni datos de Flota. orm:sync --plan
confirmó migración vacía, sin BD/escrituras. Los cambios siguen locales sin commit.

Verificación: módulos (26), ORM (82), vistas Kanban (4), navegación (12), TypeScript,
ESLint de afectados y build de producción aprobados. Se corrigió un fixture de
lifecycle que no publicaba el Selection del Kanban según el contrato vigente; no
se relajó la validación del servicio. Build conserva tres avisos existentes de
trazado filesystem del gestor de módulos. En navegador /sample#collection-core
se comprobaron las tres presentaciones, búsqueda conservada y atrás del navegador
con fuente ficticia; sin pruebas autenticadas nuevas sobre registros reales.

La integración completa de módulos se intentó con proyecto/schema propios: pasó
instalación/sync de fixture, pero se detuvo en respaldo/purga por ausencia de
pg_dump/pg_restore en este entorno. No presentarla como aprobada; el fixture ejecuta
su limpieza finally. No se instalaron herramientas ni se omitió el gate de respaldo.

Siguiente ejercicio: recargar Flota, comprobar selector de Vehículos y Lista/Card
de Modelos, aplicar una búsqueda/filtro/orden y abrir/crear/volver conservando la
vista. Las capacidades y menús efectivos ya están implementados arriba; permisos
por campo continúan pendientes.
Guía de uso: [Colecciones](colecciones-modelos.md), demo /sample#collection-core.

Pendiente reafirmado después: gestionar desde Accesos las presentaciones disponibles
y los Fields/columnas visibles o de sólo lectura por grupo, sobre capacidades del
motor actual. Distinguirlo de lectura/escritura de datos: no enviar campos sin
lectura y no permitir que un override de UI conceda permisos. El usuario pidió
mantenerlo para diseñar después, sin implementación ni cambios de Flota ahora.
Detalle ampliado en [Permisos por campo](ideas/permisos-campos.md). Esta anotación
sólo actualiza documentación; comprobación con git diff --check.

## Cierre del 2026-11-14

Estado contrastado hoy con fuentes y Git. Rama `codex/flota`; último commit
`fdd4d5b` («Acciones del modelo», referencia de ese cierre). Después se versionaron
en 4fb1bb1/89513f6; la continuación de colecciones parte de 89513f6. Las ampliaciones
de esta continuación permanecen
sin commit, incluidos nuevos archivos, esquema/propiedad y migración de estado.
No se hicieron commit, push ni pull. Al cambiar de máquina, compartir también
los archivos nuevos; dependencias, configuración privada, datos y procesos no
se transportan mediante Git.

Avance implementado y revisado:

- Flota: búsqueda explícita por name/plate, filtros/agrupación practicados y menú
  Vehículos / Configuración → Fabricantes y Modelos.
- Consulta con lectura de los tres modelos; Operador hereda Consulta y crea/lee/
  edita vehículos propios; Responsable hereda Operador y accede a todos mediante
  regla de grupo domain:[]. Sin eliminación ni escritura de catálogos añadidas.
- Vehicle.estado: Disponible / En mantenimiento, obligatorio, default disponible
  y tracking. Migración `20261114180636_sync_flota` y esquema/propiedad presentes;
  usuario dio por completado orm:sync, sin nueva consulta independiente de BD
  para verificar la aplicación de esa migración.
- Formulario personalizado con FormContent/useWatch, statebar y botones para
  enviar/finalizar mantenimiento; métodos @action en Vehicle. Active volvió a
  mostrarse; testing permanece en la clase pero ya no tiene botón en la vista.
- Metadata de la ruta compartida usa displayName autorizado como título de la
  pestaña y se actualiza tras guardar/acción. Fallbacks seguros para creación,
  lista y lectura fallida. Lectura de metadata y loader aún separadas.
- Colores de Selection compartidos por lista/card/kanban: colors sin widget
  colorea el texto; widget badge usa daisyUI y fallback neutral. Las etiquetas
  vienen del modelo. Corregida propagación de options al filtro de ListView.
- VehicleKanban creado por el usuario y activo en views.list, conservando el
  archivo VehicleList. El arrastre/selector ejecuta los mismos métodos de
  mantenimiento a través del grafo from/to/action, con transacción, revisión,
  permisos/reglas/grupos y rollback de registro/historial si falla o no alcanza
  destino. No se añadieron más estados ni movimientos sobre datos reales.
- Layout compartido: statebar junto a botones con ancho de contenido; Kanban
  con padding exterior 8/12px y gap de columnas 8px.

Evidencia y límites: el usuario confirmó búsqueda/filtros/agrupación, ejercicios
de acceso y reglas, título, flujo de mantenimiento desde formulario e historial,
y apertura del Kanban. El asistente revisó fuentes y comprobó demos ficticias de
acciones, badges/texto y movimientos con selector/teclado, incluido rechazo.
Pasaron TypeScript, ESLint de afectados, pruebas focalizadas por alcance y
test:modules:integration completo con proyecto/esquema temporales eliminados.
La última ampliación de transiciones cubrió 30 pruebas focalizadas y, en BD
temporal, permisos, sesión, revisión/origen, grupos, historial y rollback tras
hooks/destino incorrecto. No se ejecutó build nuevo ni se repitió una prueba
autenticada de arrastre en Flota. El cierre actual sólo actualiza documentación
y verifica git diff --check; no vuelve a ejecutar esas suites.

Continuación del 2026-11-14: el usuario dio por completadas las pruebas de movimientos
en ambos sentidos con reapertura/historial y el ejercicio de rechazo con cuenta de
Consulta. Son confirmaciones del usuario, sin repetición autenticada del asistente;
no se precisó si la UI de Consulta impedía intentar mover o rechazaba al ejecutar.
Verificados ambos botones dentro del mismo div de VehicleForm y createHref en
VehicleKanban. El usuario confirmó que Nuevo abre el formulario de creación.
También hay nuevas vistas personalizadas de Fabricante/Modelo registradas por el
usuario y cambios locales sin commit; no sobrescribirlas ni asumirlas revisadas.
Esta continuación sólo verifica fuentes y actualiza documentación, sin tests ni BD.

Después, por petición expresa del usuario, ModeloList se configuró con
ModelCollection view="card", conservando name/fabricanteId/active y el registro
existente del manifest. Configuración → Modelos usa tarjetas con búsqueda, filtros,
paginación, Nuevo y enlace al formulario del proveedor compartido. Sólo presentación;
sin cambios de modelo ni SQL. Pendiente confirmación visual del usuario.
TypeScript, ESLint de ModeloList y diff documental aprobados para este ajuste.

Siguiente paso: acordar qué pendiente abordar, con multivistas como propuesta
para continuar. Registrar una idea no autoriza ejecutarla:

- [Multivistas Lista/Kanban/Tarjetas](ideas/multivistas-colecciones.md), coordinadas
  con [eject:view Kanban](ideas/eject-kanban.md).
- [Menús por permisos efectivos](ideas/menus-permisos-efectivos.md).
- [Permisos por campo y presentación por grupo](ideas/permisos-campos.md).

La propuesta de otra API render/children se retiró: renderCard ya permite
personalizar tarjetas. Oportunidades detectadas: proyectar capacidades efectivas
para abrir formularios sin escritura en consulta y evitar que un lookup denegado
oculte toda la lista; aceptación y límites en los pendientes de este documento.
Los detalles y comprobaciones por alcance se conservan debajo y en
[la tutoría](tutorial-flota.md#continuación-vigente-2026-11-14).

## Dirección y funcionalidades

- Para módulos declarativos: create:module → create:model → personalizar la clase
  → orm:sync; lista/formulario por convención y eject:view para personalizar TSX.
  Fue el flujo de la tutoría de Flota, ahora retirada: [Módulos declarativos](modulos-declarativos.md).
  El scaffold anterior conserva clientFields/create:views como alternativa;
  no mezclar ambos recorridos. [Modelo y vistas](modelos-y-vistas.md).
- Framework ERP en TypeScript, Next.js, React, Prisma 7 y PostgreSQL.
  Modelos/Fields declarativos, contratos Zod, vistas TSX editables y herramientas
  para crear aplicaciones, generar contratos, instalar esquemas y enlazar Prisma.
  Procedimiento y límites en [Flujo del framework](flujo-framework.md).
- Aplicaciones con manifest, dependencias y menús de navegación; servicios con
  autorización, validación, transacciones, concurrencia y hooks de negocio.
  Contactos y Usuarios son aplicaciones activas; las versiones anteriores de Citas
  y Flota se retiraron el 2026-11-13. Flota se recreó como módulo declarativo
  para la tutoría y volvió a retirarse el 2026-11-17. Mantienen alcances distintos;
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

### Espacio exterior de Kanban (2026-11-14)

Reducido el padding del tablero compartido de 16/24px a 8/12px y la separación
entre columnas de 16px a 8px, por petición del usuario. Conserva ancho de columnas,
tarjetas, scroll y movimientos. ESLint del componente y git diff --check aprobados;
demo /sample#kanban-view comprobada en navegador con padding 12px y gap 8px en
escritorio. Sin nueva integración/build ni cambios de datos por este ajuste CSS.

### Kanban con transiciones mediante @action (2026-11-14)

Implementado kanban:{field,transitions:[{from,to,action}]} en módulos y servicio;
el formato string anterior y servicios con sólo field conservan sus movimientos
directos. Declaración validada y congelada: Selection obligatorio/público/publicado
<=12 estados, pares distintos/únicos y métodos publicados. Cliente recibe sólo
from/to; el servidor resuelve el método desde manifest, en la misma transacción
Serializable de movimiento y compartiendo persistAction con el formulario.
Revalida origen/revisión, permisos/reglas/grupos y estado final tras hooks; error
revierte registro e historial. Pares ausentes se rechazan sin fallback; [] bloquea
cambios. Selector, arrastre y teclado respetan el grafo como ayuda de interfaz.

Flota conserva sus dos estados y métodos: enviarMantenimiento y
finalizarMantenimiento. Manifest actualizado y VehicleKanban conecta modelMove
y config.kanbanTransitions; lista y formulario personalizados conservados. Sin
SQL ni movimientos sobre datos reales. Próximo paso del usuario: probar los dos
movimientos y comprobar historial/reapertura, con cuentas de operador/responsable.

Verificación: TypeScript, ESLint de afectados, git diff --check y 30 pruebas
focalizadas (configuración, compatibilidad, módulos, acciones y servicio) aprobados.
Demo /sample#kanban-view con grafo local
de tres estados: destinos no declarados deshabilitados, movimiento por selector,
teclado que salta destinos no permitidos y rechazo que conserva estado. La demo
es una simulación local, no una comprobación autenticada de Flota.
Fixture PostgreSQL de módulos: bloque de servicios completado con permisos,
reglas, grupos de acción, sesión/revisión, acciones falsificadas, historial único,
hooks rechazados y destino final incorrecto con rollback de revisión/historial.
test:modules:integration completo aprobado, incluidos ciclo de módulos/scaffold
y TypeScript de rutas/vistas en la copia temporal. Proyecto y schema temporales
eliminados por el fixture. No se ejecutó build ni prueba autenticada sobre Flota.
Contrato en [Módulos](modulos-declarativos.md#kanban-mediante-acciones-publicadas).

### Badges de Selection en colecciones (2026-11-14)

Ampliación posterior solicitada: colors independiente de widget; sin widget
colorea la fuente, conservando el color heredado cuando no hay asignación, con
badge mantiene su fondo y fallback neutral. Sigue limitado a Selection público
y colores/valores válidos. Demo con selector badge/texto en las tres colecciones,
verificada en navegador; no se modificó VehicleList por esta ampliación.
Pruebas focalizadas de presentación/servicio (14) y render (4) aprobadas;
TypeScript, ESLint de afectados y git diff --check aprobados, sin build ni SQL.

Implementado widget badge y colors por valor con fallback neutral en el renderizador
compartido de lista/tarjetas/kanban; modelColumns y servicio validan Selection
público, colores semánticos y claves válidas, conservando etiquetas canónicas.
VehicleList.estado conectado: disponible success, mantenimiento warning. Demo
ficticia /sample#badge-collections incluye las tres vistas y casos sin color,
valor desconocido y null. Sin migraciones ni escrituras sobre datos de Flota.
Se corrigió que ListView no pasaba options a ColumnFilter: ya ofrece operadores
y valores Selection sin tratar el estado como texto libre.
Verificación: TypeScript, 14 pruebas de presentación/servicio y 26 de renderizado,
filtros/consulta, ESLint de afectados y git diff --check aprobados. Navegador:
render en las tres vistas, filtro eq progress
con un resultado y valor original en URL, fallback y ancho de 320px sin overflow
de sección. No se comprobó Flota autenticada ni se ejecutó build.
Contrato en [Colecciones](vistas-colecciones.md#selection-como-badge).
El usuario dio por comprobados transiciones de mantenimiento desde formulario,
guardado previo, reapertura e historial; no se repitieron de forma independiente.
La conexión Kanban inicialmente de consulta fue superada por el grafo de acciones
descrito arriba. ModelCollection sólo presenta list/card actualmente; multivistas
y eject:view kanban están registrados como diseño pendiente, sin API implementada.

### Cabecera compacta con statebar (2026-11-14)

Ajuste solicitado durante la tutoría: FormHeader limita el ancho del FieldSelect
statebar para compartir fila con botones, centrados verticalmente; conserva wrap
y scroll interno cuando no caben. Espaciado de esa fila reducido a 8px. Cambios
compartidos en FormHeader/FormView y marcador de widget en FieldSelect, sin
modificar las personalizaciones de Flota ni su lógica de estado.
Demo ficticia /sample#form-actions comprobada en navegador: botones y statebar
alineados en 1280px; a 320px el estado cabe con scroll interno sin overflow de la
sección. No se ejecutaron acciones ni escrituras sobre registros reales.
TypeScript, ESLint de los tres componentes y git diff --check aprobados;
sin build nuevo ni comprobación visual de Flota autenticada.
Contrato en ui/form/FormView.md. Las acciones y botones de mantenimiento ya están
conectados; el siguiente paso vigente figura en el cierre de hoy.

### Título de pestaña del registro (2026-11-14)

Implementado generateMetadata en la ruta compartida de módulos: displayName
persistido mediante modelRead autorizado; lista con etiqueta del modelo,
creación «Nuevo registro» y fallo de lectura «Registro». Página y metadata
comparten validación de ruta. ModelForm ya refresca tras guardado/acción.
No se modificaron las personalizaciones locales de Vehicle ni datos/SQL.
Verificación: TypeScript, ESLint de la ruta y git diff --check aprobados;
sin nueva prueba visual autenticada ni build. Alcance y oportunidad de unificar
la lectura metadata/loader en [Módulos declarativos](modulos-declarativos.md#título-de-la-pestaña).
El usuario confirmó el título en su sesión. También dio por completados búsqueda
(name/plate con searchable:true verificados en fuentes), filtro Activo y
agrupación Modelo → Activo; sin repetición independiente en navegador.
Menú Vehículos y Configuración → Fabricantes/Modelos completado por el usuario y
verificado en manifest. Consulta y Operador ya declarados (lectura de los tres
modelos; Operador hereda Consulta y añade cru a Vehicle). El usuario comprobó el
rechazo de guardado sin escritura y dio por terminado el paso tras corregir la
asignación a Operador. Sin repetición independiente del guardado en navegador.
Regla vehiculos-propios de Operador ya verificada en manifest (createBy = actor.id);
usuario dio por terminado el ejercicio, sin prueba funcional independiente.
Responsable y regla vehiculos-todos (domain:[]) ya verificados en manifest;
usuario dio por completado el ejercicio, sin repetición funcional independiente.
Usuario aceptó Disponible ↔ En mantenimiento y añadió estado Selection obligatorio
con default disponible/tracking. Fuentes, esquema y migración
20261114180636_sync_flota verificados; usuario dio por completado orm:sync, sin
comprobación independiente de BD. Statebar y métodos de transición ya verificados
en fuentes; métodos requieren grupo operador y validan estado previo. Siguiente
paso de esta etapa, ya confirmado por el usuario: prueba funcional de transiciones,
guardado previo e historial. Botones y
condiciones ya verificados en fuentes, label corregido; falta agrupar ambos
botones dentro del mismo div (finalizar quedó fuera). Usuario retiró testing de
la vista y muestra active. Sin cambios de aplicación ni SQL por esta nota.
Detalle en [la tutoría](tutorial-flota.md#continuación-vigente-2026-11-14).

### Acciones del modelo y de formulario: implementadas (2026-11-14)

Base implementada en `codex/flota` y versionada en `fdd4d5b`; ampliaciones de esta
sesión aún sin commit:

- `@action` en la clase del modelo;
- `service.action` (Serializable, permisos, regla, grupos y revisión; mismo
  `persist`; historial «Acción: <label>»);
- Server Action fija `modelAction` con nombre validado;
- `FormHeader` y `FormButton` coordinados por FormView y conectados en ModelForm;
- demo `/sample#form-actions`.

Contrato en [Acciones de formulario](ideas/acciones-formulario.md#contrato-implementado-2026-11-14).

- Correcciones de paso:
  - FormLayout ahora hace `preventDefault` síncrono. Antes lo hacía tras
    `await reactions.settle()`, y un submit programático podía enviar un GET nativo
    con los valores en la URL.
  - FormView usa un candado por ref contra el doble clic.
- Migración `20261113221349_uninstall_demo`:
  - se quitaron los nombres calificados `"public".`, que rompían el replay en la
    base sombra de `migrate dev`;
  - con aprobación del usuario, se actualizó su checksum en la tabla
    `_prisma_migrations` local (LF, condicionado al valor anterior);
  - **otras bases donde ya se aplicó (otra máquina) requieren el mismo ajuste de
    checksum**, o `migrate` reportará la migración como modificada;
  - `cleanupSQL` del gestor de módulos ya genera SQL sin esquema.
- Verificación del 2026-11-14:
  - `test:modules:integration` pasó completa. Cubre en acciones: nombres no
    publicados o reservados, campos extra, regla de registro, grupos, revisión
    obsoleta, transición inválida, rollback por beforeSave, historial y
    superusuario.
  - test:orm 78/79: el fallo es EPERM al crear symlinks en Windows, ajeno al cambio.
  - form-navigation 12/12, form-model 8/8, modules 21/21, list-selection 8/8 y
    list-grouping 14/14; tsc y eslint limpios.
  - Demo verificada en el panel del navegador:
    - registro nuevo vacío: la validación bloquea la acción;
    - registro nuevo: guarda y ejecuta la acción una sola vez;
    - registro modificado: la acción recibe la revisión nueva;
    - registro limpio: sin reescritura;
    - transición inválida;
    - fallo simulado que conserva lo guardado;
    - doble clic y modo consulta.
  - No se probó con un módulo real en el navegador ni se ejecutó el build.
- Pendientes:
  - ~~el esquema de contraseña limita a 8 caracteres~~ (resuelto el 2026-11-17);
  - ~~las etiquetas Many2one no se filtran por las reglas del modelo destino~~
    (resuelto el 2026-11-17);
  - aviso dev `instant-unrendered-segment`.

  Usar acciones en Flota sólo en un ejercicio acordado; Ventas no existe.

### Acuerdo original: acciones del modelo y de formulario (2026-11-14)

Ampliación acordada el 2026-11-14: declarar las acciones de negocio como métodos
en la propia clase del modelo, con publicación explícita y un adaptador de Server
Action sin reglas duplicadas. Primero definir su contrato y ejecución compartida
autorizada/transaccional, revisión, validación, hooks e historial; la sintaxis de
decorador y tipos del ejemplo todavía no es definitiva. Después implementar
FormHeader para botones y Field de estado,
y FormButton integrado con RHF/ModelForm. Secuencia predeterminada acordada:
validar/guardar mediante el ciclo del formulario y, sólo tras éxito, ejecutar la
acción del botón con la identidad y revisión persistidas. Un bloqueo cubre ambas
fases; un error del formulario impide la acción. No duplicar hooks ni autorización.
La acción posterior puede fallar después de un guardado exitoso: conservar ese
registro/revisión, sin prometer una transacción conjunta. Estos componentes y
Ventas aún no existen. [Acuerdo, límites y aceptación](ideas/acciones-formulario.md).
Se registra para la próxima sesión; no es una implementación ni ejecución programada.
Revisión del 2026-11-14: rama codex/flota y árbol limpio antes de esta actualización;
documentación contrastada con ModelForm/FormView y fuentes actuales de Flota.
Esta ampliación sólo cambia documentación; verificación con git diff --check,
sin nuevas suites, comprobaciones de BD ni servidor local.

### Avances posteriores de Flota y Fields (2026-11-13)

La tutoría continuó en `codex/flota` después de la pausa descrita abajo. `Vehicle`
ya existe y aparece en el esquema instalado: matrícula única, relación obligatoria
con Modelo, `normalize` convierte matrícula a mayúsculas y `beforeSave` consulta
modelo/fabricante en su tx para guardar `[MATRÍCULA] Modelo / Fabricante` en name.
El usuario confirmó creación, edición, rechazo de duplicados y cambio de modelo.
También confirmó el logo related `modeloId.fabricanteId.logo`. Formulario y lista
ya se expulsaron a `views/VehicleForm.tsx` y `VehicleList.tsx`; conservar sus diseños.

Mejoras compartidas durante la tutoría: FieldText `widget="header"` muestra h1 sin
label; Stack distribuye dos columnas adaptables y fuerza dirección block. Se corrigió
la publicación de related en políticas de colección y ModelCollection, sin habilitar
capacidades SQL de campos virtuales. Los contratos están en ui/form y /sample.

`invisible` ya admite booleanos en Fields declarativos y props TSX, herencia del
modelo y override explícito false. Oculta sin desmontar/limpiar/deshabilitar RHF;
incluye campos display y ventanas auxiliares. Sólo formularios: columnas usan list.
Demo `/sample#field-invisible` y contrato `ui/form/FieldVisibility.md`. Verificados
en navegador envío de valores ocultos, edición/ocultación conservando datos y rechazo
de un obligatorio vacío oculto; sin operaciones sobre datos reales de Flota.
Pasaron test:form-model (8), test:modules (21), test:orm (75), TypeScript y ESLint
de los archivos modificados. No se ejecutó build ni SQL para estas mejoras de UI.
Continuar con ejercicios pequeños; no editar archivos de aplicación por adelantado.

Pendiente de Flota después de la prioridad: confirmar visualmente la lista tras
corregir related; practicar opciones de colección/búsqueda; organizar el menú de
Vehículos y Configuración (Fabricantes/Modelos); declarar y probar grupos/permisos
y reglas de registros. Los ejemplos de estado/statebar y botones se discutieron
como diseño futuro: Vehicle todavía no declara estado ni acciones de transición.
Conservar la maquetación actual con logo/título fuera de FormGroup y Stack para
matrícula/modelo. Detalle y siguiente ejercicio en [la tutoría](tutorial-flota.md).

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

**Punto de pausa histórico, ya superado:** entonces faltaba crear Vehicle. Ya se
creó y personalizó en la continuación descrita arriba; no volver a generarlo.

**Cambio de máquina (nota histórica de aquella pausa):** había cambios sin commit en docs, src/modules/flota,
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

- ~~Auditoría en ModelCollection declarativo~~: implementada el 2026-11-18 con
  `audit: true` por modelo; ver la sección de esa fecha.


- **Lista cuando falla el lookup de una relación**: con lectura de Vehicle pero
  sin lectura de Modelo, resolveListLabels rechaza toda la lista. Aceptación:
  diseñar un fallback seguro para relación no disponible sin publicar etiquetas
  restringidas ni ocultar errores de red/configuración; conservar autorización
  de la lista y del destino. No conceder lectura automáticamente. Hallazgo
  diagnosticado mediante lectura de permisos y código, sin corrección implementada.

- **Permisos por campo y presentación por grupo**, solicitado el 2026-11-14:
  lectura/escritura de campos en servidor y condiciones invisible/readOnly/required
  y visibilidad de NotebookPage en UI. Propuesta sin implementación ni API decidida;
  diseñar contratos parciales y composición de grupos, preservando validación,
  datos y protección de salidas derivadas. Alcance, motivo y aceptación en
  [el pendiente](ideas/permisos-campos.md). No cambia el siguiente ejercicio de
  Flota. Nota documental comprobada con git diff --check;
  sin nuevas suites, SQL ni cambios de aplicación.

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
