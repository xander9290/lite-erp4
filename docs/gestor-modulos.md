# Aplicación Módulos

Primera etapa implementada el 2026-11-13 en `/erp/modulos`, disponible sólo para
administradores. Es una aplicación nativa de administración, registrada en el
catálogo junto a Control de accesos. No añade tablas propias ni migraciones.

## Comportamiento actual

- Lista con búsqueda, filtros, orden y paginación de ListView; proveedor propio
  autorizado, sin ampliar los modelos ni campos permitidos del proveedor legacy.
- Ficha por ID con FormViewLoader, información, modelos y dependencias declaradas
  en ambos sentidos. La ficha permite reintentar una carga fallida.
- Descubre manifests presentes en `src/modules` y las aplicaciones de
  `src/app/(auth)/erp`, incluidos los que aún no están registrados. Distingue
  módulos declarativos, aplicaciones anteriores con orm.config y aplicaciones
  nativas/manuales. También informa restos de propiedad sin manifest disponible.
- El lector usa AST y literales; no importa ni ejecuta manifests encontrados en
  disco, ni carga sus vistas o sus métodos. Declaraciones dinámicas/incompatibles
  y enlaces se marcan para revisión, sin inventar sus valores.
- Contrasta la propiedad/esquema Prisma con tablas y columnas físicas del schema
  de la conexión actual. Respeta @@map/@map y no consulta registros de negocio.
- Sesión activa, isAdmin y sessionVersion se revalidan en RepeatableRead readonly
  antes de leer fuentes y metadatos SQL. La UI no es el límite de autorización.

| Estado | Evidencia |
| --- | --- |
| Instalado | Modelos declarados coinciden con propiedad gestionada cuando corresponde, tablas/columnas presentes y registro activo. Las apps nativas sin modelos no requieren una tabla propia. |
| No instalado | Declaración disponible sin propiedad gestionada ni persistencia comprobada. |
| Sincronización pendiente | Propiedad o tablas parciales, modelos añadidos/retirados respecto al esquema instalado o columnas faltantes. |
| Fuera del catálogo | Persistencia comprobada, pero sin entrada activa en el registro de ejecución. |
| Sin modelos | Manifest declarativo vacío, todavía sin modelos instalados. |
| Requiere revisión | Manifest incompatible, fuentes ausentes, ID duplicado, ciclo de dependencias o dependencias sin instalación activa comprobada. |

La versión mostrada proviene del manifest: todavía no hay historial separado de
versiones instaladas. La coincidencia de tablas/columnas no certifica igualdad de
tipos, índices, constraints ni historial de migraciones. Tampoco se ejecuta la
generación para descubrir cambios de campos que sólo existan en las clases TS.
Estas limitaciones aparecen en la ficha y deben conservarse al ampliar estados.

Las dependencias actuales son las de `depends`: no constituyen todavía el grafo
completo de imports, relaciones, herencia y objetos externos exigido por el
[diseño de desinstalación](ideas/desinstalacion-aplicaciones.md).

## Operaciones siguientes

En esta etapa **no hay instalación, actualización ni desinstalación desde la UI**.
Se muestra el alcance disponible, sin botones que simulen guardados o ejecuciones.
Flota, Demo y sus datos se conservan.

Siguiente incremento: revisar una operación desde la ficha usando un plan común
para CLI/UI, con dependencias, archivos afectados y propuesta SQL. Después
conectar un ejecutor controlado, con persistencia de fases, mantenimiento cuando
corresponda y revisión/aprobación del alcance exacto. No lanzar comandos de shell
arbitrarios desde una Server Action ni aceptar rutas/SQL enviados por el navegador.
Instalar herramientas no implica autorizar su aplicación a datos reales.

El catálogo y su proyección de instalación se separan de la presentación en
`src/lib/module-manager`: el futuro CLI puede reutilizar el inventario sin importar
React ni las rutas de la aplicación. No sustituye los instaladores existentes.

## Despliegue y fuentes

El catálogo inspecciona la copia local de fuentes/esquemas del servidor. Los
módulos disponibles en otra máquina o ausentes del artefacto desplegado no se
pueden descubrir. No es una tienda ni descarga paquetes remotos.

TypeScript pasa a dependencia de ejecución porque el servidor usa su parser AST;
se conserva la versión fijada en el lockfile. Next incluye explícitamente en los
traces de `/erp/modulos` sus manifests, perfiles y esquemas/propiedad necesarios.
Las fuentes no se sirven como archivos públicos ni se envían completas al cliente.
La misma funcionalidad requiere un servidor Node y acceso de lectura al catálogo;
un despliegue estático no puede ofrecer esta administración.

## Verificación

`npm run test:module-manager` usa archivos temporales y dobles de BD para verificar
estados, mappings, dependencias, ciclos, manifests no ejecutados, enlaces,
autorización y política de consultas. `test:modules:integration` comprueba estados
y permisos contra su schema PostgreSQL temporal, con un módulo disponible propio.

`test:legacy:integration` compila en una copia temporal, verifica que el trace
incluya fuentes necesarias y comprueba las rutas nuevas con administrador y
usuario ordinario, además de autenticación, Contactos, Citas y tema.
Resultados vigentes y límites de revisión visual en
[estado-proyecto](estado-proyecto.md).
