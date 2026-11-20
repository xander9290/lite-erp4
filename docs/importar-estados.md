# Importar estados de México desde INEGI

Comando local de desarrollo terminado el 2026-11-19. Usa la conexión existente de
`.env.local` y el login explícito de un administrador activo para atribuir los
cambios. Es una herramienta para el desarrollador con acceso local al proyecto,
no un mecanismo de autenticación remota.

## Revisar sin guardar

Desde la raíz, reemplazar TU_LOGIN por el login del administrador:

```sh
npm run ubicaciones:import -- TU_LOGIN
```

Descarga el catálogo, valida claves/nombres y rechaza claves duplicadas. Busca el
País existente con código MX; no crea países ni elige uno por nombre. Lee sus
estados en una transacción RepeatableRead de sólo lectura y muestra crear,
actualizar, sinCambios y conflictos. No necesita `orm:sync` ni migraciones nuevas.

## Revisar y aplicar

```sh
npm run ubicaciones:import -- TU_LOGIN --aplicar
```

Muestra un plan nuevo y exige una terminal interactiva y la palabra exacta
`aplicar`. Otra respuesta cancela. Los conflictos bloquean la operación; si no hay
cambios, termina sin escribir ni pedir confirmación. No existe `--yes`.

La aplicación usa la misma descarga que se acaba de mostrar, revalida admin/sesión,
País MX, datos y revisiones dentro de una transacción Serializable. Si el plan
cambió durante la revisión, se rechaza. Servicios de modelos conservan validación,
hooks, autoría, historial y revisión del país propietario; cualquier fallo revierte
el lote completo. No hay reintentos automáticos de escrituras.

Sólo actualiza el nombre propuesto de los registros coincidentes por clave;
conserva ID, activo, relaciones y otros campos. Registros locales ausentes de la
fuente no se eliminan. Claves duplicadas o el mismo nombre con otra clave se
reportan como conflictos para revisión manual. Repetir sin cambios no genera
escrituras ni entradas de historial nuevas.

Si se interrumpe la conexión durante la aplicación, revisar primero con el comando
sin flag; no asumir rollback ante un resultado de commit desconocido.

## Fuente y alcance

Fuente: **INEGI, Catálogo Único de Claves Geoestadísticas**.
[Documentación](https://www.inegi.org.mx/servicios/catalogounico.html),
[endpoint de entidades](https://gaia.inegi.org.mx/wscatgeo/v2/mgee/),
[términos de uso](https://www.inegi.org.mx/inegi/terminos.html) y
[términos de libre uso](https://www.inegi.org.mx/contenidos/inegi/doc/terminos_info.pdf).
Fuente y respuesta revisadas el 2026-11-19: 32 entidades. No se afirma que la
información esté avalada o integrada al sistema por INEGI.

Se conservan `cve_ent` como codigo y `nomgeo` como name, omitiendo estadísticas
demográficas. Son claves geográficas; no equivalen automáticamente a claves SAT
de CFDI/Carta Porte. País usa la convención interna MX; homologación fiscal queda
pendiente. Esta versión no importa municipios, localidades, colonias ni CP.

El País actual tiene estadoIds editable con maxRows 50: el servicio conserva ese
límite al validar el documento. Resolver datos duplicados o un exceso de líneas
antes de importar; no forzar índices, retirar hashes o eludir el servicio.

## Verificación reproducible

```sh
npm run test:ubicaciones:import
```

Crea un esquema exclusivo `import_states_test_<hex>`, despliega las migraciones
versionadas y ejecuta servicios reales con cuentas/datos ficticios. El worker sólo
acepta su esquema de pruebas, nunca public. Elimina el esquema al finalizar.
No descarga catálogos externos: la fuente de prueba es ficticia y el CLI recibe
fetch/TTY simulados sólo en sus procesos de prueba.

Cubre 32 altas, autoría/historial, repetición sin escrituras, actualización
conservando activo, datos manuales conservados, revisión desactualizada,
admin/sesión/País inválidos, conflictos, rechazo tardío con rollback de registros/
país/historial, dos aplicaciones concurrentes y CLI de plan, cancelación,
confirmación, sin cambios, flags inválidos, no TTY y producción bloqueada.

La tarea de finalización del agente no ejecutó la carga real en el ERP. Después,
el usuario confirmó que la aplicación real funcionó (2026-11-19). Sigue repetir
el modo de revisión: debe mostrar 32 sinCambios y ninguna alta/actualización o
conflicto si no hubo cambios posteriores. El agente no consultó su BD para repetir
esa comprobación. Después continúa la guía con Municipios.
