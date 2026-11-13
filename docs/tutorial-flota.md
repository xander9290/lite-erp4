# Flota: tutoría con módulos declarativos

Recorrido actualizado el 2026-11-13 para `src/modules`. El usuario ejecuta los
ejercicios; explicar y verificar uno cada vez, sin crear modelos, vistas ni reglas
por adelantado. [Contrato y herramientas](modulos-declarativos.md).

La Flota anterior fue retirada. Al iniciar esta tutoría en `codex/flota` se
comprobó que no existen sus rutas ni su carpeta de módulo, el índice está vacío y
los registros locales de instalación/retirada no reservan su ID. Usaremos
**flota** para el nuevo módulo; las migraciones históricas se conservan.

## Recorrido previsto

1. Crear el módulo mínimo y entender manifest e índice explícito.
2. Añadir Fabricante, personalizar campos, revisar la instalación y probar las vistas
   por defecto con guardado/reapertura; después añadir su logo con Fields.Image y
   revisar Actualizar conservando el registro existente.
3. Añadir Modelo y su Many2one a Fabricante, con lookup por convención.
4. Añadir Vehicle y su relación a Modelo; personalizar `@displayName` para
   «Fabricante · Modelo». Las decisiones de nombres se toman con el usuario.
5. Practicar las opciones de colección en Fields.
6. Expulsar sólo el formulario de Vehicle con `eject:view` y personalizar su TSX.
7. Declarar grupos, permisos y reglas; asignarlos desde Control de accesos.
8. Añadir una imagen `related` del logo del fabricante.

No es necesario escribir un manifest desde cero ni generar vistas por modelo:
`create:module` produce el esqueleto y `create:model` registra cada clase. Los
menús y las reglas de negocio/acceso sí se personalizan expresamente.

## Avance confirmado al pausar

Tutoría pausada el 2026-11-13 para cambiar de máquina, en la rama `codex/flota`.
El usuario ejecutó los ejercicios; el asistente revisó fuentes y SQL compartido,
sin editar sus clases ni consultar registros de la BD.

- **Fabricante**: creado e instalado; name obligatorio (120), active default true,
  tracking y displayName basado en name. El usuario confirmó guardar y reabrir.
- **Logo**: Image opcional con label Logotipo, folder `flota/fabricantes` y tracking.
  Almacena URL en VARCHAR(2048) nullable. El usuario confirmó subir, guardar y reabrir
  la imagen después de actualizar y finalizar mantenimiento.
- **Modelo**: creado e instalado con name/active y `fabricanteId` Many2one obligatorio
  a `FlotaFabricante`, onDelete Restrict y tracking. Conservar el nombre elegido por
  el usuario: su alias de lectura es `fabricante`.
- **Presentación de Modelo**: `@displayName("name", "fabricante.name")`, proyección
  readonly y unión de ambos nombres con ` / `. El usuario confirmó el ejercicio de
  crear/reabrir un modelo seleccionando fabricante y la presentación «Corolla / Toyota».
- Manifest con icon `car`, modelos fabricante/modelo e índice explícito. No hay vistas
  expulsadas: formularios, listas, lookup y uploader funcionan por convención.

Verificación local al pausar: fuentes y esquema instalado contienen ambos modelos,
logo y FK obligatoria; existe la migración de Modelo y no existe marcador de
mantenimiento. Las pruebas funcionales fueron confirmadas por el usuario, sin
repetición visual ni consulta independiente del asistente. No se repitieron suites
ni build en este cierre; comprobación documental con `git diff --check`.

Migraciones creadas durante el recorrido (conservar junto con esquemas y propiedad):

- `20261113224609_sync_flota`: Fabricante.
- `20261113225348_sync_flota`: logo.
- `20261113231720_sync_flota`: Modelo y relación con Fabricante.

## Pendiente para retomar

Continuar con el punto 4: crear el modelo de **vehículos** y relacionarlo con Modelo.
Antes de generar, confirmar el nombre de clase con el usuario (`Vehicle` es la
propuesta del recorrido; todavía no se decidió ni creó). El primer ejercicio será
revisar `npm run create:model -- flota NOMBRE_ELEGIDO --dry-run`, después de sustituir
el marcador. Explicar/verificar un paso a la vez; no crear anticipadamente clase,
relaciones, campos, reglas ni vistas. Más adelante siguen opciones de colección,
eject de formulario, accesos e imagen related.

## Continuidad en la otra máquina

Al pausar hay cambios locales sin commit, incluidos documentación, fuentes de Flota,
registro, esquema/propiedad e historial de migraciones. Compartirlos mediante
commit/push autorizado y obtenerlos en la otra máquina antes de continuar. No se
hicieron commit, push ni pull como parte de registrar esta pausa.

La configuración privada, dependencias, cliente Prisma generado, servidor dev y
registros de la BD no se transfieren por Git. En la otra máquina, comprobar rama y
estado, instalar dependencias según lockfile, disponer de configuración privada por
un medio apropiado y comprobar qué BD está configurada y qué migraciones tiene.
Generar Prisma Client para esa copia; revisar cualquier migración pendiente antes
de aplicarla. No asumir que usa la misma BD ni ejecutar reset/push/seed para retomar.
No guardar secretos en la documentación o el repositorio.

La instalación/actualización se revisa desde Módulos o mediante orm:sync. Reiniciar
dev tras regenerar Prisma y finalizar mantenimiento si se usó el gestor. Las pruebas
del framework usan fixtures y esquemas temporales independientes de esta tutoría.
