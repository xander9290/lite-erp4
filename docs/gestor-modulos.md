# Aplicación Módulos

Implementada el 2026-11-13 en `/erp/modulos`, disponible sólo para
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
| Retirado · datos conservados | Reserva versionada, esquema y tablas conservados, sin registro de ejecución activo. |
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

## Operaciones en desarrollo

La ficha permite preparar y aplicar **instalación, actualización y desinstalación**
para módulos declarativos y aplicaciones del scaffold anterior. Usa el mismo
motor que `npm run module:manage`, en un proceso Node separado con ejecutable,
script y argumentos controlados. El navegador nunca aporta SQL, rutas, actor ni
comandos de shell. El inventario no ejecuta manifests; el ejecutor sí carga las
declaraciones locales de confianza para generar y sincronizar.

En producción se conserva el catálogo de lectura: las operaciones están
deshabilitadas tanto en la UI como en el worker. Módulos, Usuarios, Contactos y
Control de accesos están protegidos; las aplicaciones manuales necesitan un
adaptador específico y no pueden retirarse con el motor genérico.

1. Abrir la ficha, elegir la operación y pulsar **Revisar plan**. Se muestran SQL,
   archivos afectados, advertencias, bloqueos y, para purga, conteos por tabla.
2. Resolver dependencias, drift o migraciones pendientes. Un plan caduca a los
   30 minutos y cualquier cambio de fuentes, esquema, configuración o alcance
   obliga a revisarlo nuevamente. No se aplican migraciones ajenas pendientes.
3. Cerrar otras instancias y tareas que puedan escribir. Confirmar el plan;
   para eliminar datos también se debe escribir el ID exacto. Se revalida la
   cuenta activa/admin/sessionVersion y se recalcula el plan antes de ejecutar.
4. Consultar el resultado en la URL persistente de la operación. Al terminar,
   reiniciar el servidor y confirmar **Finalizar mantenimiento** desde esa URL.
   El cierre vuelve a comprobar el esquema y las migraciones.

Instalar/actualizar reutiliza `orm:sync` y su política aditiva; el SQL realmente
preparado debe coincidir con el aprobado. No habilita `--force`, reset ni cambios
destructivos de campos. Se regeneran los contratos/bindings del scaffold sin
sobrescribir sus vistas personalizadas.

### Conservar o eliminar datos

**Conservar datos**, valor inicial, retira fuentes ejecutables, registro y
artefactos exclusivos; conserva esquema Prisma, propiedad, tablas, registros,
actividad y asignaciones de acceso. Crea `prisma/.app-retirements.json` con el ID
reservado, dependencias y huella del archivo de código. Versionar este registro
junto con los esquemas y la propiedad instalada. Los generadores rechazan
reutilizar el ID mientras tenga datos conservados.

Para reactivar, elegir **Instalar** en la ficha retirada. Recupera los archivos
verificados del trabajo original en `.module-operations`, regenera el registro
actual y conserva la identidad y los registros. No sobrescribe fuentes existentes
ni permite SQL adicional durante esa recuperación. El archivo local debe seguir
disponible en la misma ruta y entorno; Git no lo comparte automáticamente entre
máquinas. Sin él se requiere una recuperación manual revisada.

**Eliminar datos** retira además el esquema/propiedad/inversas exclusivos y crea
una migración nueva con transacción, sin borrar migraciones históricas. La limpieza
de actividad, grupos, reglas y overrides usa identidades exactas. Las imágenes
remotas se conservan. Las referencias de otros módulos, imports, delegates,
Many2one y SQL literal detectados bloquean; la inspección SQL también bloquea FK
externas, vistas, particiones y triggers. Los usos dinámicos arbitrarios requieren
revisión del desarrollador: el análisis estático no demuestra su ausencia.

Antes de purgar se ejecuta `pg_dump` del **schema configurado completo, incluidos
sus datos**, se restaura en una base exclusiva temporal y se comparan conteos de
todas sus tablas con el origen. No es un respaldo de todos los schemas del servidor
ni una comparación de cada valor. Referencias FK entre schemas bloquean este flujo.
Requiere `pg_dump`/`pg_restore` compatibles en PATH o `MODULE_MANAGER_PG_BIN`,
permiso para crear/eliminar la base de verificación y espacio suficiente. Las
credenciales viajan por variables de entorno, no por argumentos del proceso.

### Mantenimiento y recuperación

Después de retirar rutas estáticas se ejecuta `next typegen` y se comprueban las
fuentes y los tipos actuales. La comprobación omite sólo las raíces de tipos
generados de `.next/dev/types`, que pertenecen al servidor dev y pueden conservar
rutas retiradas hasta reiniciar; no omite código de la aplicación ni `.next/types`.

Los trabajos, archivos de código y respaldos se guardan en `.module-operations`,
excluido de Git y de los traces de producción. Contienen fuentes y posibles datos
de negocio: proteger su carpeta y gestionar su retención; no hay cifrado ni
rotación automáticos. Los locks cooperan con los generadores del framework y no
se deben retirar sin comprobar el proceso propietario. Los generadores permanecen
bloqueados después de terminar el proceso mientras siga abierto el mantenimiento.

El marcador de mantenimiento bloquea los accesos que usan `requireUser`/
`requireAdmin` y los nuevos inicios de sesión. Los administradores con sesión
vigente conservan acceso al gestor. No detiene transacciones ya iniciadas, jobs
externos ni servidores de otra copia del proyecto: cerrarlos corresponde al
operador. No es una retirada en caliente ni coordinación distribuida.

Si falla antes de preparar cambios (por ejemplo, faltan las herramientas de
respaldo), el trabajo permite cerrar mantenimiento después de revalidar fuentes y
BD. Si ya hubo cambios, se conserva el mantenimiento y el estado fallido para
inspección manual; no hay rollback global ni reintento ciego. Revisar archivos,
migraciones y respaldo antes de resolver. Si se perdió la sesión, un administrador
puede usar el CLI local, que vuelve a verificar su identidad en la BD.

### CLI compartido

El CLI requiere un administrador local existente y su sessionVersion vigente;
no acepta nombres de scripts ni SQL. Ejemplo con marcadores para sustituir:

```sh
npm run module:manage -- review mi-modulo --actor ID_ADMIN --session VERSION --operation uninstall --data keep
npm run module:manage -- apply ID_OPERACION --actor ID_ADMIN --session VERSION --fingerprint HUELLA --confirm mi-modulo --maintenance confirmado
npm run module:manage -- status ID_OPERACION --actor ID_ADMIN --session VERSION
npm run module:manage -- finish ID_OPERACION --actor ID_ADMIN --session VERSION --maintenance confirmado
```

Usar `install` o `update` en `--operation`; `--data drop` sólo es válido para
`uninstall`. Aplicar requiere el mismo actor/sesión del plan. Otro administrador
vigente puede consultar y finalizar el mantenimiento para recuperación. Confirmar
`finish` después del reinicio o de verificar que el fallo no preparó cambios.

Estas herramientas requieren checkout escribible y dependencias de desarrollo;
no descargan aplicaciones. Las pruebas del gestor no ejecutaron retiradas sobre
datos reales. Citas/Flota se retiraron en otro trabajo específico autorizado;
Demo se conserva.

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
autorización, reservas, locks, normalización SQL y restauración de archivos.
`test:modules:integration` comprueba estados/permisos y el ciclo de operaciones
contra su schema PostgreSQL temporal: planes obsoletos, SQL JSON alterado,
instalación, actualización, keep/reactivación, purga con respaldo restaurado y
fallos anteriores a cambios. También instala, retira y reactiva una aplicación
scaffold propia con su registro intacto. `-- --legacy-only` permite repetir ese
adaptador sin repetir el ciclo destructivo del módulo declarativo.

`test:legacy:integration` compila en una copia temporal, verifica que el trace
incluya fuentes necesarias y comprueba las rutas nuevas con administrador y
usuario ordinario, además de autenticación, Contactos y tema.
Resultados vigentes y límites de revisión visual en
[estado-proyecto](estado-proyecto.md).
