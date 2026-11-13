# Estrategia de desinstalación de aplicaciones y módulos

Diseño propuesto el 2026-11-13 y ampliado con implementación el mismo día por
autorización del usuario. Contrato operativo vigente:
[Gestor de Módulos](../gestor-modulos.md). Los comandos hipotéticos de este diseño
no son la sintaxis del CLI; el comando implementado es `module:manage`.

Estado: catálogo, planes compartidos CLI/UI y ejecución en desarrollo para
declarativo/scaffold; keep con reserva y reactivación desde archivo verificado;
drop con respaldo del schema restaurado, SQL preciso y migración nueva.
Aplicaciones manuales, ejecución de producción, coordinación distribuida y
reanudación automática tras efectos siguen pendientes. El contenido siguiente
mantiene los criterios del diseño; no todos constituyen capacidades verificadas.
Las retiradas reales de Citas/Flota se hicieron en otro trabajo específico
autorizado, no como prueba del gestor; Demo se conserva.

## Objetivo y alcance

Ofrecer un solo flujo revisable para módulos declarativos, aplicaciones del
scaffold anterior y aplicaciones manuales. El flujo detecta qué implementación
corresponde a un ID; no exige migrar al nuevo framework para poder retirarlo.

| Tipo existente | Detección | Retirada propuesta |
| --- | --- | --- |
| Módulo declarativo | `src/modules/<id>/manifest.ts`, índice explícito y propiedad ORM si está instalado | Adaptador automático para fuentes, índice, esquema e inversas cuya propiedad se compruebe. |
| Aplicación generada anterior, como Flota | `orm.config.ts`, manifest, catálogo del scaffold y propiedad ORM | Mismo motor de persistencia; adaptador para rutas estáticas, catálogo y artefactos generados. |
| Aplicación manual, como Contactos, Usuarios o Citas | Imports directos del registro, manifest y servicios propios | Inventario y adaptador explícito, revisado por aplicación; no deducir propiedad destructiva del manifest. |
| Restos sin manifest o instalación incompleta | Esquemas, propiedad, catálogos o artefactos sin su fuente | Mostrar como inconsistencia. Reparación/adopción explícita antes de automatizar una retirada. |
| Modelos compartidos o infraestructura | Autenticación, Partner/User, actividad y Control de accesos | Protegidos frente al borrado genérico; retirar una interfaz no implica retirar estas tablas. |

«Heredado» abarca aquí el flujo anterior con `orm.config.ts` y las aplicaciones
manuales. La herencia TypeScript entre clases de modelos también cuenta como
dependencia y debe revisarse, aunque el manifest no la declare.

No incluir inicialmente retirada de campos/modelos individuales, sustitución de
modelos, cambio de propietario de tablas, renombrados ni borrado de assets remotos.
Esos cambios necesitan contratos propios, no un `--force` del desinstalador.

## Dos resultados explícitos

| Política | Resultado | Reversibilidad e identidad |
| --- | --- | --- |
| `keep`, predeterminada | Retirar fuentes ejecutables, rutas, acciones, navegación y artefactos exclusivos. Conservar tablas, registros, auditoría, configuración de accesos y esquema Prisma necesario. | Conservar la propiedad instalada y reservar el ID. Restaurar requiere recuperar fuentes compatibles y revalidar permisos; no es simplemente volver a mostrar el menú. |
| `drop`, solicitada expresamente | Además, retirar sólo tablas/enums exclusivos e inversas propias y limpiar los registros auxiliares exactos que el plan enumere. | Destructiva; recuperación desde respaldo compatible. El ID sólo se libera cuando la retirada completa está comprobada. |

Ocultar una entrada del cajón sigue siendo una operación de presentación distinta.
No revoca Server Actions ni constituye una desinstalación. El modo `keep` tampoco
consiste en quitar el esquema Prisma mientras deja las tablas sin representar:
eso produciría drift y futuras migraciones podrían eliminarlas.

Para `keep` está implementado `prisma/.app-retirements.json`, separado del ledger
de propiedad: ID, tipo, versión, dependencias, modelos/grupos/reglas y huella/ID del
archivo local de código; sin registros ni secretos. `prisma/.orm-installations.json`
conserva hashes e inversas de los modelos retenidos. Los generadores consultan esa
reserva y rechazan la reutilización accidental. Reactivar exige el archivo local
verificado de la misma ruta y entorno; Git no lo comparte entre máquinas.

Si se desea conservar auditoría tras `drop`, la identidad sigue reservada: antes
de permitir reutilizarla se necesitaría una política de archivo o generaciones
de identidad. La primera versión no ofrece combinaciones ambiguas de purga parcial.

## Un motor de planificación, con adaptadores por tipo

Reutilizar las piezas comprobadas: `readInstallationState`, `removeInverse`,
`sourceHash`, `prismaBlocks`, edición AST y regeneración del catálogo del scaffold.
El motor arma un plan común; los adaptadores sólo aportan inventario y cambios
específicos. No crear tres desinstaladores independientes.

El plan debe contener:

- ID/tipo, política, entorno y alcance exacto; versión de formato y huellas de
  las fuentes, esquemas, propiedad, catálogos e historial de migraciones relevantes.
- Archivos que se editan, conservan o retiran y diff; distinguir código editable
  del usuario de artefactos gestionados. Nada de borrar una carpeta por su nombre.
- Modelos, tablas con schema y nombres físicos `@@map`, enums, relaciones e
  inversas; propietario demostrado de cada objeto. Nunca usar un prefijo como
  prueba de propiedad ni como selección SQL de borrado.
- Dependientes declarados y referencias detectadas, con origen y motivo de bloqueo.
- SQL propuesto, alcance de datos auxiliares, necesidad de respaldo, pasos de
  aplicación, comprobaciones y puntos de recuperación.
- Incertidumbres. Un caso desconocido se marca para revisión; no se interpreta
  la ausencia de un resultado de búsqueda como prueba de ausencia de dependencias.

Un archivo de plan es un artefacto revisable, no un script autorizado: al consumirlo
se validan su formato, ID, rutas y huellas y se recalcula el alcance desde las
fuentes locales de confianza. No aceptar SQL o rutas arbitrarias de un JSON editado.
`prepare` debe conservar el baseline necesario fuera de los archivos que retira,
en un staging local controlado y comprobado por huellas. `apply` valida el estado
posterior esperado y ese baseline; no intenta reimportar un manifest ya eliminado
ni depende de que exista un commit nuevo para reconstruirlo.

## Dependencias y bloqueos

Combinar cuatro fuentes de evidencia:

1. `depends` de todos los manifests y perfiles, no sólo de los módulos activos.
2. Relaciones e inversas de Prisma, `externalOwners` y el registro de propiedad.
3. Referencias TS/TSX: imports, herencia, Many2one, related, displayName, lookups,
   loaders de vistas, servicios, acciones y rutas. Catálogos de acceso: grupos
   implicados, grants y reglas de otros módulos que usen los IDs retirados.
4. En modo de inspección de BD: FKs, usos de enums, vistas y otros objetos
   dependientes no representados por Prisma. Rechazar objetos compartidos o no
   clasificados; no incluirlos silenciosamente en el SQL.

Los dependientes bloquean por defecto. Mostrar el orden inverso de dependencias
si el usuario decide retirarlos también, pero exigir su inclusión explícita en
el plan. No habrá `--cascade` que desinstale otros módulos ni `DROP ... CASCADE`.
Las referencias dinámicas o integraciones externas requieren declaración/revisión
manual. Los ciclos se resuelven antes de preparar una retirada.

Ejemplos de propiedad y sus límites:

- Demo tiene propiedad gestionada e inversas de auditoría en User. Flota tenía
  una instalación scaffold equivalente antes de su retirada específica.
  Los fixtures del gestor usan otros IDs y no modifican estas aplicaciones.
- Contactos publica Partner y tiene como dependiente Usuarios. Partner también
  sirve al perfil y a autenticación. No es una tabla que se pueda purgar por
  borrar Contactos del registro.
- Usuarios publica User, pero la propiedad funcional de las cuentas es compartida
  con autenticación, auditoría y Control de accesos. `manifest.models` no es una
  autorización de `DROP TABLE users`.
- Control de accesos depende de Usuarios y sus tablas contienen asignaciones de
  múltiples módulos. No pertenecen a Demo aunque tengan filas referidas a Demo.

## Flujo de usuario y aplicación

Interfaz orientativa, **comandos todavía inexistentes**:

```text
npm run app:uninstall -- plan <id> --data keep
npm run app:uninstall -- plan <id> --data drop --inspect-db --out <archivo-plan>
npm run app:uninstall -- prepare --plan <archivo-plan>
npm run app:uninstall -- apply --plan <archivo-plan>
```

La ausencia de `--data` significa `keep`. `plan` sólo lee por defecto; `--out`
escribe exclusivamente el informe solicitado. `--inspect-db` añade consultas de
lectura al entorno identificado; sin él, el plan no asegura compatibilidad con BD.

1. **Inventariar.** Detectar tipo, propiedad y dependencias. Mostrar los bloqueos y
   el diff/SQL previsto, sin cambios en el proyecto ni en la base.
2. **Preparar.** Revalidar el plan y generar cambios de fuentes/esquema/catálogos y,
   si corresponde, una migración nueva revisable. No ejecutar SQL. Una retirada
   que exige objetos manuales sin adaptador se detiene antes de escribir. Usar
   una copia/worktree separada del servidor activo, o detener ese servidor antes:
   no editar sus fuentes mientras un dev con recarga automática las está sirviendo.
3. **Revisar.** Comprobar el diff, el SQL, los datos afectados y la compilación en
   copia aislada. Preferir un worktree y un punto de retorno; commit/push se hacen
   únicamente si el usuario los autoriza. Los cambios ajenos que existan al iniciar
   la operación se deben conservar y distinguir de los de la retirada.
4. **Detener escritores y respaldar.** Entrar en mantenimiento y detener las
   escrituras antes del respaldo que servirá para recuperar la operación. Para
   `drop`, exigir un respaldo restaurable y probar su restauración aislada.
   Preferir respaldo consistente de la BD completa:
   un CSV por tabla no reconstruye relaciones, esquema ni metadatos. Guardarlo
   fuera de Git, sin secretos en argumentos visibles, logs ni documentación.
5. **Aplicar en mantenimiento.** Identificar entorno; detener todas las versiones
   que sirvan las rutas/acciones retiradas y sus trabajos antes de cambiar tablas.
   En legacy no existe un guard común de «app desactivada»: quitar el catálogo no
   corta llamadas existentes. La primera versión admite mantenimiento coordinado,
   sin prometer retirada en caliente.
6. **Confirmar y ejecutar.** Revalidar historial, drift, dependencias y huellas
   contra el entorno detenido. Mostrar el SQL exacto final y pedir confirmación
   específica para IDs/política. Si cambia el alcance, invalidar la aprobación.
   Aplicar mediante migración versionada de Prisma; no modificar su ledger a mano.
7. **Cerrar.** Regenerar Prisma/artefactos aplicables, comprobar TS/build, desplegar
   la versión compatible y verificar rutas, operaciones y datos ajenos. Registrar
   resultado; sólo entonces liberar identidades purgadas y cerrar mantenimiento.

La preparación deja una migración destructiva pendiente que `orm:sync` debe seguir
rechazando. No ampliar `orm:sync --force` para autorizar desinstalaciones. El
`db:deploy` actual ejecuta migraciones pendientes sin pedir una segunda aprobación:
antes de ofrecer `apply` en producción, integrar la clasificación de retiradas y
su revisión en el despliegue/CI. Un flag en este comando no puede proteger frente
a SQL ejecutado directamente con otras credenciales o herramientas.

El fingerprint de entorno no contiene credenciales; el ejecutor usa configuración
local de confianza y vuelve a identificar el destino. Las comprobaciones de BD
deben detectar planes obsoletos y tablas ajenas incluso con el mismo código Git.

## Cambios coherentes y recuperación

- Retirar sólo los segmentos de inversas cuya integridad se compruebe. Un cambio
  manual en hashes, modelos o inversas bloquea; nunca «arreglarlo» borrando hashes.
- Recalcular el catálogo gestionado con sus generadores, manteniendo hashes. Las
  fuentes personalizadas se incluyen por archivo en el plan aprobado; conservar
  las que tengan consumidores ajenos o exigir resolver esas referencias.
- Artefactos generados: retirada por inventario/hash conocido con soporte explícito
  para eliminar; `writeArtifacts` actual rechaza retiradas, no sirve invocarlo con
  archivos omitidos. `writeResource` ya admite eliminación con preflight, exclusión
  mutua y restauración ante fallos ordinarios; el gestor usa ese inventario explícito.
- Archivo de retirada y esquema retenido deben permanecer coherentes en `keep`.
  En `drop`, retirar propiedad e inversas junto al esquema mediante el plan, nunca
  por manipulación manual destinada a eludir el instalador.
- SQL PostgreSQL con transacción, locks/tiempos acotados y orden explícito de FKs,
  tablas y enums. Verificar usos compartidos y no utilizar CASCADE ni reset.
- Auditoría y notas: usar nombres exactos de los modelos demostrados, no el ID de
  aplicación ni `LIKE 'demo%'`. En `keep` permanecen. En `drop` enumerar su alcance
  expresamente y preservar actividad de todos los demás modelos.
- Accesos: inventariar las claves exactas de grupos/modelos/reglas declarados.
  Para purgarlos, incluir asignaciones de esos grupos, overrides cuyo grupo o
  modelo se retire y estados de esas reglas. Bloquear referencias externas que
  queden sin resolver. Nunca borrar usuarios por pertenecer a un grupo retirado.
- Imágenes: informar referencias y conservar los archivos remotos en ambos modos.
  La limpieza remota depende de [inventario de assets](limpieza-imagenes.md).
- Reinstalar con el mismo ID requiere una operación explícita de reactivación
  compatible en `keep`, o comprobar su liberación tras `drop`. No adoptar datos,
  grants o tablas antiguas por coincidencia de nombres.

No existe una transacción global entre Git, archivos, migraciones, cliente generado
y despliegue. Persistir fases completadas y huellas, sin secretos, y ofrecer
continuación verificable tras fallos. Si SQL se aplicó y falla generar el cliente,
mantener mantenimiento y reanudar desde esa fase; no repetir el borrado ni prometer
que `git restore` recupera datos. Si la migración falla, comprobar el estado real y
usar la recuperación explícita de Prisma antes de continuar, sin resolve automático.

## Fases y trabajo restante

Las fases 1–3 tienen implementación acotada a desarrollo y pruebas propias:
inventario, review/apply/status/finish, keep/reactivación y drop con respaldo
restaurado. La recuperación automática después de preparar cambios o aplicar SQL
no está resuelta: se mantiene mantenimiento y se exige revisión manual. Las
fases 4–5 permanecen como propuestas, sin implementación autorizada por esta nota.

| Fase | Entregable | Criterio de aceptación |
| --- | --- | --- |
| 1 | Inventario/grafo y `plan`, con adaptadores de lectura para los tres tipos | Planes deterministas, sin escrituras/BD salvo opciones explícitas; detectar propiedad, dependencias y bloqueos de infraestructura. |
| 2 | Preparación y retirada `keep` para módulos y scaffold | Proyecto final compila; fuentes personalizadas revisadas; esquema/tablas/datos conservados; IDs reservados; rutas/acciones ausentes en el nuevo despliegue. |
| 3 | `drop` para propiedad gestionada y aplicación controlada en desarrollo | Respaldo/restauración ensayados; migración precisa sin CASCADE; ninguna alteración ajena; reanudación después de fallos y liberación comprobada de IDs. |
| 4 | Adaptadores explícitos para aplicaciones manuales | Contrato revisado por aplicación; proteger entidades compartidas; no exigir convertirla en módulo declarativo. Empezar con fixture manual, no Contactos/Usuarios reales. |
| 5 | Despliegue protegido y operación de producción | Gate para migraciones destructivas, ensayo en staging, coordinación de versiones, recuperación y comprobaciones operativas documentadas. |

Siguiente incremento posible: recuperación verificable por pasos después de efectos,
con pruebas de interrupción y sin repetir SQL; después adaptadores manuales y gate
de despliegue. Criterio: ninguna recuperación debe aceptar SQL/rutas editados ni
habilitar versiones incompatibles. Implementar herramientas no autoriza ejecutar
retiradas de aplicaciones reales.

## Pendiente solicitado: desinstalación en producción

Registrado el 2026-11-13 por petición expresa del usuario. Pendiente de diseño e
implementación; el bloqueo actual de operaciones en producción se mantiene.

Motivo: el mantenimiento local del gestor de desarrollo no coordina todas las
instancias, trabajos y versiones de un despliegue. Habilitar el mismo botón sin
esa coordinación podría dejar procesos ejecutando rutas o consultando tablas
retiradas.

Alcance y criterios de aceptación:

- Mantener conservación de datos por defecto y purga explícita, con dependencias
  resueltas e infraestructura compartida protegida.
- Plan autorizado para el entorno de destino, SQL y archivos exactos; aprobación
  del despliegue y gate de migraciones destructivas en CI/CD.
- Ensayo previo en staging y respaldo compatible cuya restauración se haya
  comprobado antes de una purga.
- Mantenimiento coordinado: impedir nuevas escrituras y drenar las que estén en
  curso; detener o actualizar todas las instancias y trabajos afectados antes de
  cambiar tablas. Verificar que ninguna versión anterior siga atendiendo tráfico.
- Publicar la versión compatible, regenerar los artefactos necesarios, comprobar
  rutas, permisos, datos ajenos y ausencia de drift antes de reabrir el ERP.
- Recuperación documentada y probada ante interrupciones antes y después del SQL,
  sin repetir operaciones destructivas ni prometer rollback global.

Esta anotación registra trabajo futuro; no habilita operaciones de producción ni
autoriza una desinstalación sobre ese entorno.

## Verificación exigida antes de usarlo

Fixtures propios para declarativo, scaffold y manual; proyectos y esquemas
PostgreSQL temporales. No usar Flota, Demo ni cuentas del ERP como fixtures.

Casos mínimos: módulo vacío/no instalado; retiro repetido; keep/reactivación;
drop/reinstalación; dependientes directos/transitivos e imports/herencia; FK externa
no declarada; tabla/enum compartido; modelos centrales protegidos; nombres físicos
personalizados; artefactos modificados; symlinks/junctions y colisiones de casing;
plan editado/obsoleto; concurrencia de install/sync/create/uninstall; fallo antes y
después del commit SQL; eliminación por claves exactas de historial/accesos;
conservación de usuarios e imágenes; restauración del respaldo y drift nulo final.

Probar rutas/acciones antiguas con la nueva versión y confirmar que la versión vieja
no sigue sirviendo. Regresión de autenticación, Contactos, tema, módulos,
scaffold y ORM; TS/lint/build. Los fallos de entorno se registran, no se omiten.

## Comprobación histórica del diseño

2026-11-13: revisión de manifests/registros, propiedad ORM, instalador, helpers de
integridad, modelo de accesos y migración histórica de retirada de Flota. Sin
consultas a BD, comandos de migración, cambios de código ni retirada de archivos.
Verificación documental de aquella etapa: `git diff --check`. La implementación
posterior y sus pruebas vigentes se registran en
[estado-proyecto](../estado-proyecto.md); no confundir esta revisión de diseño con
la verificación del motor actual.
