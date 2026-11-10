# Estado del proyecto

Última actualización: 2026-11-10.

Documento de continuidad entre agentes y máquinas. Leer primero [AGENTS.md](../AGENTS.md)
y [README](../README.md); contrastar este resumen con Git y el código relevante.
Actualizar el estado vigente, evitando acumular una transcripción de sesiones.

## Dirección y funcionalidades

- Framework ERP en TypeScript, Next.js, React, Prisma 7 y PostgreSQL.
  Modelos/Fields declarativos, contratos Zod, vistas TSX editables y herramientas
  para crear aplicaciones, generar contratos, instalar esquemas y enlazar Prisma.
  Procedimiento y límites en [Flujo del framework](flujo-framework.md).
- Aplicaciones con manifest, dependencias y menús de navegación; servicios con
  autorización, validación, transacciones, concurrencia y hooks de negocio.
  Contactos, Usuarios, Citas y Flota aportan casos reales con alcances distintos;
  no asumir que todos usan el mismo adaptador o política de acceso.
- ListView con selección y eliminación por lote desde «Acciones»; dominios fijos
  de servidor combinados con filtros visibles. Los dominios filtran consultas y
  no sustituyen reglas de acceso. Ver [Dominios](dominios-listas.md).
- Auditoría de creador/fechas separada de los valores editables del formulario.
  Ver [Auditoría](auditoria-modelos.md).
- Historial de creación/cambios y notas internas por defecto en createModelService.
  Tracking explícito por Field y exclusión de sensibles; captura transaccional,
  lectura paginada autorizada y borrador independiente de RHF. Scaffold y Flota
  integrados. Contrato y límites en [Actividad](actividad-registros.md).
- Agrupación anidada opcional de ListView, hasta tres niveles escalares autorizados,
  carga al expandir, conteos SQL, paginación y selección por rama. URL con prefijo;
  conserva dominios/filtros/permisos. Scaffold nuevo habilita active. Las aplicaciones
  existentes requieren configurar columnas y regenerar su adaptador, sin migración.
  Flota ya tiene active agrupable en el código y adaptador con groups; no atribuir
  una prueba funcional nueva a esa inspección. Contrato en [Agrupación](agrupacion-listas.md).
- Empaquetar como dependencia npm es una meta futura, conservando Next.js y Prisma.
  Primero madurar contratos y aplicaciones. Ver [Idea y alcance](ideas/aplicaciones-modulares.md).

## Tutoría de Flota

El usuario ejecuta los ejercicios; el agente explica y verifica sin editar su
aplicación por adelantado. Guía: [README de Flota](../src/app/(auth)/erp/flota/README.md).

- Modelo actual con `name`, `plate`, `brand` opcional y `active`, más auditoría.
  La instalación, migraciones y enlace de Prisma se realizaron durante la tutoría
  en la máquina original; comprobar el entorno local al cambiar de máquina.
- Por petición expresa del usuario se integró actividad: los cuatro campos tienen
  tracking y RecordForm conecta lectura de historial y publicación de notas.
  No se alteraron las reglas de negocio ni las personalizaciones de las listas.
- `beforeSave` convierte placas a mayúsculas, exige marca para vehículos activos
  y requiere desactivar y guardar antes de cambiar las placas de un vehículo activo.
  La prueba temporal de rollback de `afterSave` permanece comentada.
- El código contiene las listas general, «Mis vehículos» y «Mis vehículos activos».
  Esta última combina `createBy = actor.id` AND `active = true`.
  En esta actualización se inspeccionaron dominio, Server Actions, variante de
  RecordList, página y entrada del dropdown: todos están presentes.
- Pendiente: confirmación funcional del usuario de «Mis vehículos activos».
  No dar por realizada esa prueba sólo porque exista el código.

## Siguiente paso concreto

Probar con el usuario historial y notas en Flota: editar un campo con tracking,
guardar/reabrir y publicar una nota. La integración SQL usa registros temporales;
la revisión de navegador se hizo con el ejemplo ficticio `/sample#record-audit`.
Adjuntos, correos y actividades quedan para una etapa futura.

Retomar con la prueba de la nueva vista: comparar las tres listas, filtrar por
placas y limpiar filtros; el dominio debe mantenerse. `Activo = No` debe devolver
cero registros en «Mis vehículos activos». Registros ajenos o con creador nulo
deben quedar fuera. Conservar permisos admin y personalizaciones del usuario.

## Último trabajo y verificaciones

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
