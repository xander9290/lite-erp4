# Catálogos de dirección: práctica guiada

Recorrido iniciado el 2026-11-18 tras los campos básicos de contactosextra y su
constraint de RFC. El usuario escribe y ejecuta los ejercicios; el agente explica
y revisa un paso a la vez. Este documento no crea módulos, modelos ni datos.

## Estructura de trabajo

Usar un módulo declarativo compartido `ubicaciones`, independiente de Contactos.
Así otras aplicaciones podrán reutilizar los mismos registros geográficos.
Comenzar con el caso México; la captura de catálogos extranjeros y sus diferencias
administrativas se diseñará cuando se necesite, sin imponer la estructura mexicana
a todos los países.

| Modelo | Relación | Contenido inicial |
| --- | --- | --- |
| Pais | Ninguna | Nombre, código de país como texto, activo. |
| Estado | Many2one obligatoria a Pais | Nombre, clave como texto, activo. |
| Municipio | Many2one obligatoria a Estado | Nombre, clave como texto, activo. |
| Localidad | Many2one obligatoria a Municipio | Nombre, clave como texto, activo. |

Estos modelos se construirán uno a uno. Elegir las claves y sus reglas de unicidad
cuando se revise la fuente: una clave local no tiene por qué ser única globalmente.
No añadir unique a nombres por comodidad. No confundir localidad y colonia; colonia
y datos postales se evaluarán al preparar la importación, sin modelarlos aún.

## Orden del recorrido

1. `npm run create:module -- ubicaciones --dry-run`; revisar propuesta.
2. Crear el módulo con el comando sin dry-run y revisar su manifest/registro.
3. Crear Pais, personalizar sus campos y revisar el plan antes de sincronizar.
   Probar primero con registros de práctica introducidos manualmente.
4. Repetir con Estado, Municipio y Localidad, incorporando sus relaciones y menús.
5. Definir permisos de lectura para consumidores y administración de catálogos;
   sin grupos/grants, el módulo declarativo sigue siendo sólo para administradores.
6. Añadir `depends: ["ubicaciones"]` a contactosextra y referencias Many2one desde
   la extensión de Partner. Elegir opcionalidad y columnas publicadas antes de SQL.
7. Validar coherencia de dirección en el servidor: un estado debe corresponder al
   país seleccionado, etc. Las ayudas del formulario no sustituyen esa regla.
   Diseñar filtros dependientes de lookups cuando lleguemos a ellos, contrastando
   la API existente; no prometer domains de campo no implementados ni confiar en
   filtrar una página de resultados en React.
8. Diseñar importación de fuentes oficiales después de tener contratos y flujo
   manual comprobados. Revisar licencia, campos, jerarquía, claves, actualización,
   volumen, idempotencia y permisos antes de escribir un importador. El formulario
   no dependerá de una petición externa para cada apertura de registro.

La constraint actual de zip/RFC es mexicana. Antes de permitir direcciones de otros
países, condicionar esas reglas a la política y al país seleccionados. Una
selección de país no modifica automáticamente la validación todavía. No inferir
una dirección única sólo a partir del código postal sin revisar la fuente postal.

## Estado y siguiente paso

**Guía pausada a petición del usuario (2026-11-18).** Rama revisada codex/partner,
con cambios locales sin commit. No seguir creando campos durante la pausa.

Completado por el usuario y revisado en fuentes:

- Módulo Ubicaciones con Pais, Estado, Municipio y Localidad; relaciones obligatorias
  y Restrict hacia su padre. País tiene código de dos letras único, normalize y
  constraint; los otros catálogos tienen claves Text sin unicidad global.
- Dependencia ubicaciones en contactosextra; paisId/estadoId opcionales y sus FK.
- Selectores País/Estado en PartnerExtraForm personalizado.
- Constraint validarPaisEstado con contexto transaccional y autorización de lectura
  del Estado; exige País cuando hay Estado y verifica la relación.
- Campos básicos de dirección y RFC, con restricciones descritas en la guía core.

El usuario confirmó sincronizaciones y pruebas propuestas, incluida la última:
País/Estado correspondientes guardan y reabren, Estado sin País se rechaza y ambos
vacíos se permiten. El agente no repitió pruebas en navegador/BD. Esquemas/SQL
revisados; última migración 20261119041214_sync_contactosextra (estado_id nullable,
índice y FK Restrict). TypeScript y ESLint de PartnerExtra aprobados.

**Próxima prioridad urgente:** [dominios de relaciones y colecciones](ideas/dominios-relaciones-colecciones.md).
Diseñar motor compartido con AND/OR/NOT y referencias a otros campos del borrador;
primer caso: estadoId sólo muestra estados del paisId seleccionado. Hoy el selector
muestra todos los estados legibles y la constraint rechaza combinaciones inválidas
al guardar. API y filtros dependientes todavía no implementados. No eliminar la
constraint sin acordar su convivencia con el nuevo contrato.

Después de resolver esa mejora: aplicar el ejemplo País→Estado con el usuario,
continuar Municipio/Localidad en PartnerExtra y coherencia de toda la dirección.
Quedan lectura de catálogos para consumidores no admin, navegación desde
Configuración de Contactos e importaciones oficiales. Ubicaciones sigue siendo
módulo compartido. Interés futuro en Carta Porte/traslado: homologar claves SAT sin
asumir equivalencia con códigos internos/INEGI; no hay integración fiscal aún.

Detalle de migraciones/verificaciones en [estado-proyecto.md](estado-proyecto.md).
Retomar con revisión de Git y documentación; no asumir estado de BD ni procesos.
Tickets permanece retirado; no restaurarlo. Sin commit/push en este cierre.
