# Pendiente urgente: dominios de relaciones y colecciones

Registrado el 2026-11-18 por petición expresa del usuario como **siguiente pendiente
urgente**, antes de continuar la guía de dirección. Esta petición autoriza registrar
el alcance y el punto de continuidad; no inicia la implementación. La API mostrada
en el chat es una propuesta, no una opción que Fields acepte actualmente.

## Caso que motiva el cambio

PartnerExtra tiene paisId y estadoId. El selector de Estado aún muestra todos los
estados autorizados. La constraint validarPaisEstado protege el guardado, pero la
UI debería consultar sólo estados del país seleccionado. El mismo mecanismo debe
servir para relaciones y para las presentaciones de ModelCollection, evitando
consultas y condiciones repetidas por vista.

## Alcance a diseñar

- Reutilizar el motor/AST de dominios existente: condiciones, AND (`all`), OR (`any`),
  NOT (`not`) y grupos mixtos anidados. Conservar semántica de dominios vacíos y
  validar límites de profundidad, tamaño, campos, tipos y operadores.
- Many2one y Many2many: dominio declarado en el Field sobre registros del destino,
  con constantes y referencias explícitas a campos del borrador. `valueFrom` fue
  el nombre ilustrativo propuesto; confirmar contrato y nulabilidad antes de código.
- Resolver disparadores/dependencias por metadatos del modelo; las vistas heredan
  el comportamiento y sólo presentan controles. La fuente de consulta debe seguir
  fijada en servidor, sin aceptar modelo, where, campo arbitrario o dominio ejecutable
  enviado libremente desde el navegador.
- One2many: distinguir el dominio sobre relaciones seleccionables de una fila de
  un filtro visual de líneas. Las líneas ocultas no equivalen a bajas; jamás enviar
  una colección parcial como reemplazo del documento completo. Definir este contrato
  antes de habilitar filtrado sobre las líneas mismas.
- Lista/Card/Kanban: dominio base declarado junto a la configuración de colección
  o su fuente de servidor. Las columnas continúan siendo presentación. Aplicarlo
  antes de conteos, páginas y grupos, incluida consulta independiente por columna
  Kanban. Evitar tres implementaciones distintas del mismo motor.

## Reglas que debe preservar

1. El dominio limita candidatos o una colección; no sustituye permisos ni reglas
   de registro. Combinarlo con autorización, filtros y búsqueda mediante AND. OR o
   NOT no deben poder ampliar la política de acceso del servidor.
2. El servidor sólo utiliza dependencias publicadas y tipos validados; no confiar
   en un ID del borrador como permiso. No exponer campos sensibles ni relaciones
   inaccesibles en etiquetas, resultados, errores o conteos.
3. Definir qué ocurre con dependencias vacías: para País→Estado, la propuesta es
   no ofrecer candidatos sin país. No convertir silenciosamente un valor ausente
   en «sin restricción».
4. Definir el cambio de padre y las selecciones existentes: limpieza explícita o
   error visible, respetando dirty guard. No descartar vínculos Many2many ocultos ni
   líneas One2many. Incluir apertura de registros antiguos con selección incompatible.
5. Validar referencias seleccionadas al guardar/ejecutar acciones y tras hooks,
   dentro de la transacción autorizada. La constraint País–Estado existente se
   conserva hasta decidir explícitamente cómo convivirá con el nuevo contrato.
6. Conservar búsqueda/modal/resolución por ID de Many2one, chips Many2many,
   paginación real de servidor, cancelación lógica de respuestas antiguas, errores,
   reintentos sólo de lectura y formularios sin autocomplete del navegador.
7. Cambiar País no debe permitir que una respuesta antigua repueble Estados de
   otro país. No descargar el catálogo completo para filtrarlo en React.

## Orden sugerido al retomarlo

1. Revisar dominio/lookup actuales y presentar el contrato definitivo y fases.
2. Many2one País→Estado como primer caso real, con tipado, herencia/extensiones y
   servidor; demo ficticia en /sample y pruebas de permisos/estado antiguo.
3. Reutilizar el contrato en Many2many y relaciones dentro de One2many, acordando
   aparte la semántica de filtrado visual de líneas.
4. Integrar dominios base en la fuente compartida de Lista/Card/Kanban.
5. Sólo después adaptar la guía: usuario aplica País→Estado y luego amplía Municipio
   y Localidad. No implementar sus campos por adelantado.

Pruebas significativas: AND/OR/NOT mixtos, validación de referencias y tipos,
dependencias vacías, cambio rápido de país, autorización en destinos, manipulación
de payload, guardados/hooks/acciones, conteos/grupos/páginas y conservación de líneas
o vínculos ocultos. Integraciones con proyecto/esquema temporales; no datos del ERP.

## Estado

**Pendiente, sin implementación ni API final.** La próxima sesión comienza por
revisar/diseñar esta mejora, no por crear Municipio/Localidad en PartnerExtra.
Guía pausada y punto exacto en [Catálogos de dirección](../catalogos-direccion.md).
