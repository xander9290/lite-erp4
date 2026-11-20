# Catálogos de dirección: práctica guiada

Recorrido iniciado el 2026-11-18 tras los campos básicos de contactosextra y su
constraint de RFC. El usuario escribe y ejecuta los ejercicios; el agente explica
y revisa un paso a la vez. Este documento no crea módulos, modelos ni datos.

## Estructura de trabajo

**Punto vigente (2026-11-19):** catálogos, dominios encadenados, inserciones,
permisos de lectura para usuarios internos y navegación desde Configuración de
Contactos completados. Importador de estados INEGI terminado y carga real
confirmada por el usuario. Guía pausada: falta comprobar repetición sin --aplicar,
después continuar Municipios. Ver [estado y siguiente paso](#estado-y-siguiente-paso)
y [uso del importador](importar-estados.md). El recorrido inferior explica la
construcción; no son tareas para volver a ejecutar sobre módulos ya creados.

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

**Avance guardado a petición del usuario (2026-11-19).** Rama codex/partner,
HEAD 7e6d64b, cambios locales sin commit. No avanzar mientras dure la pausa.

Completados:

- Pais/Estado/Municipio/Localidad, relaciones, claves y fuentes de consulta.
- PartnerExtra con dirección/RFC y relaciones geográficas opcionales, dominios
  País→Estado→Municipio→Localidad y constraint País–Estado conservada.
- Inserciones propias de formulario/lista sin duplicar el formulario base.
- Lectura de Ubicaciones para todos los usuarios internos; modificación sólo admin.
  Prueba de permisos y navegación desde Contactos confirmadas por el usuario.
- Importador local de estados con plan/confirmación, servicios y lote atómico.
  Aplicación real confirmada por el usuario; el agente no la repitió en su BD.
  Prueba aislada de altas/cambios/repetición/rollback/concurrencia/CLI aprobada y
  esquema temporal eliminado. Detalles en [Importar estados](importar-estados.md).

**Lo primero al retomar:** pedir el resultado de
`npm run ubicaciones:import -- TU_LOGIN`, sin --aplicar. Debe mostrar 32 sinCambios
y ninguna alta, actualización o conflicto si no hubo cambios posteriores. El
usuario todavía no reportó esa comprobación; no asumirla por la pausa.

Después preparar la importación de Municipios, inicialmente con alcance por
Estado y revisión antes de aplicar; luego Localidades. Todavía no existen esos
importadores. Reutilizar lo útil sin copiar autorización/transacciones de manera
indiscriminada: revisar simplificaciones del framework a partir de este caso real.
Considerar identidad por padre+clave, fuentes, actualización, volumen e idempotencia.
Las claves SAT se homologarán aparte; no hay integración fiscal implementada.

La lista Contactos mantiene límite de 12 columnas; Localidad no se publica por
convención actualmente. CP/RFC siguen validando formato mexicano. Limpieza legacy,
archivos sin uso y otros pendientes se conservan en
[estado-proyecto.md](estado-proyecto.md). Tickets sigue retirado.

No se hicieron commit/push ni nuevas operaciones de BD en este cierre. Revisar Git,
entorno y documentación al retomar; no asumir procesos o datos de otra máquina.
