# Flota

Guía del módulo `flota`. Ejecuta los comandos desde la raíz del repositorio,
donde está `package.json`, usando la base de desarrollo configurada en Prisma.
Los comandos `db:migrate`, `db:deploy` y `db:generate` ya incluyen
`--config prisma7.config.ts`.

Los archivos del módulo son editables. Los de `src/generated`, el catálogo del
scaffold y los segmentos de Prisma gestionados se actualizan con sus herramientas.
Conserva esquemas, migraciones y registros de propiedad juntos en el control de versiones.

## Añadir otro modelo a Flota

```bash
npm run create:model -- flota OtroModelo
# Personaliza campos/reglas y clientFields antes de generar las vistas.
npm run create:views -- flota OtroModelo
npm run orm:sync -- flota
```

Por defecto genera lista y formulario; puedes elegir tarjetas, kanban y modo modal.
Ambos create admiten --dry-run y rechazan archivos existentes. Fabricante se
retiró expresamente para probar este flujo; su recreación es el siguiente ejercicio.
Guía: [Modelo y vistas](../../../../../docs/modelos-y-vistas.md).

## Flujo guiado recomendado

Después de declarar/publicar los modelos y actualizar el manifest:

```bash
npm run orm:sync -- flota
```

Reúne generación, instalación/actualización, revisión y aplicación de migraciones,
Prisma Client y adaptadores. La terminal pide escribir aplicar antes de ejecutar SQL
y se detiene si un paso falla. `--plan` revisa fuentes sin escribir ni consultar
la base. Sólo para desarrollo; no ejecuta reset ni reemplaza el diseño de vistas.
Guía y continuación ante fallos:
[Sincronizar aplicaciones](../../../../../docs/sincronizar-aplicaciones.md).
Las secuencias manuales siguientes sirven como referencia y diagnóstico.

## Qué caso necesitas

Flota incorpora historial y notas en la columna derecha del formulario. `name`,
`plate`, `brand` y `active` declaran `tracking: true`; los cambios se registran al
guardar, después de las reglas de negocio. Las notas se publican por separado y
no modifican la revisión del vehículo. No se reconstruye historial antiguo.
Contrato, migración de infraestructura y alcance en
[Actividad de registros](../../../../../docs/actividad-registros.md).

| Caso | Orden |
| --- | --- |
| Crear el cascarón | Simular → crear → personalizar → primera instalación. |
| Primera instalación de modelos | Generar → plan de instalación → escribir esquema → crear/revisar migración → aplicar → generar cliente → generar/enlazar. |
| Añadir un campo o modelo | Declarar/publicar → generar → instalar con --update → crear/revisar migración → aplicar → generar cliente → generar/enlazar → completar UI. |
| Cambiar validación sin cambiar almacenamiento | Generar → revisar → enlazar → comprobar. |
| Cambiar vistas, menús o dominios | Editar TS/TSX → comprobar tipos/lint; migrar sólo si también cambia el modelo almacenado. |
| Actualizar únicamente el adaptador | Revisar enlace → escribir enlace. |
| Revisar estado sin aplicar cambios | Planes de generación/instalación/enlace y migrate status. |
| Desplegar migraciones existentes | db:deploy → build → start. |
| Retirar una aplicación | No hay un desinstalador; consulta el último apartado. |

## 1. Crear el cascarón una sola vez

Este README se entrega al crear la aplicación. Los siguientes comandos describen
ese paso inicial; una aplicación que ya existe continúa en el caso correspondiente.
Para otra aplicación, sustituye el nombre por el suyo.

```bash
npm run create:app -- "Flota" --dry-run
# Revisa los archivos propuestos antes de crear.
npm run create:app -- "Flota"
```

Antes de instalar, personaliza `models/Record.ts`, publica sus campos en
`clientFields` de `orm.config.ts` y ajusta `manifest.ts` y las vistas.
El adaptador inicial requiere publicar todos los campos declarados; los contratos
parciales o privados necesitan un servicio/adaptador propio.
`create:app` no sobrescribe una aplicación existente y no aplica SQL.

## 2. Primera instalación de los modelos

Este caso corresponde a una aplicación cuyos modelos aún no están incorporados
a `prisma/models` por el instalador.

```bash
npm run orm:generate -- flota --write
npm run orm:install -- flota
# Revisa el plan; después incorpora los archivos de esquema.
npm run orm:install -- flota --write
git status --short prisma
git diff -- prisma
```

El instalador escribe el esquema y su registro de propiedad; la base se actualiza
en el siguiente paso. Genera primero la migración para revisar su SQL:

```bash
npm run db:migrate -- --name install_flota --create-only
git status --short prisma/migrations
```

Abre el nuevo `prisma/migrations/<fecha>_install_flota/migration.sql`
y revisa todo su contenido. `git diff` no muestra el contenido de archivos nuevos
sin seguimiento. Prisma calcula la migración del esquema completo del proyecto.
Con el SQL revisado, aplica y completa el enlace, en este orden:

```bash
npm run db:migrate
npm run db:generate
npm run orm:generate -- flota --write
npm run orm:bind -- flota
# El plan de enlace compila el acceso tipado; después escríbelo.
npm run orm:bind -- flota --write
npx tsc --noEmit
npm run lint -- 'src/app/(auth)/erp/flota'
```

Inicia desarrollo con `npm run dev`. Si estaba ejecutándose al regenerar Prisma
Client, detenlo con Ctrl+C en su terminal y vuelve a iniciarlo para renovar su
instancia cacheada. Comprueba crear, editar y reabrir un registro.

## 3. Añadir un campo o modelo después de instalar

1. Declara el campo/modelo en `models` y actualiza `orm.config.ts`:
   `clientFields`, modelos y dependencias según corresponda.
2. Para registros existentes, una columna nueva puede ser opcional o tener un
   default SQL literal admitido. El instalador actual permite evolución aditiva;
   rechaza retiradas, renombrados y cambios incompatibles de campos existentes.
3. Genera los contratos y revisa la actualización del esquema:

```bash
npm run orm:generate -- flota --write
npm run orm:install -- flota --update
# Revisa el plan antes de escribir.
npm run orm:install -- flota --update --write
git status --short prisma
git diff -- prisma
npm run db:migrate -- --name add_fields_flota --create-only
git status --short prisma/migrations
```

Usa un nombre descriptivo para la migración, por ejemplo `add_brand_flota`.
Revisa el archivo SQL nuevo antes de continuar:

```bash
npm run db:migrate
npm run db:generate
npm run orm:generate -- flota --write
npm run orm:bind -- flota
npm run orm:bind -- flota --write
```

Añade el Field a `views/RecordForm.tsx` y, si lo necesitas en la lista, su columna
y/o búsqueda a `views/record.list.ts`. Completa los ajustes de UI y comprueba:

```bash
npx tsc --noEmit
npm run lint -- 'src/app/(auth)/erp/flota'
```

Reinicia dev tras `db:generate` y prueba guardar/reabrir el campo, valores vacíos
si es opcional y su validación. `orm:install --update` actualiza archivos de esquema;
la migración y la generación de Prisma Client siguen siendo pasos explícitos.

## 4. Cambiar validación sin cambiar almacenamiento

Ejemplos: etiqueta, trim, mínimo de longitud o límites de validación de enteros.
Edita la declaración y sincroniza los contratos:

```bash
npm run orm:generate -- flota --write
git diff -- src/generated/orm/apps/flota
npm run orm:bind -- flota
npm run orm:bind -- flota --write
npx tsc --noEmit
npm run lint -- 'src/app/(auth)/erp/flota'
```

Este caso requiere que el almacenamiento siga igual. Cambiar `required`,
`maxLength` de un Text, unicidad o defaults puede afectar Prisma y requiere
revisar el caso de evolución de esquema; el instalador puede rechazar esos cambios.
Revisa la compatibilidad de la validación nueva con los registros existentes.

## 5. Cambiar vistas, menús, acciones o dominios

Edita las vistas TSX, columnas/búsquedas, `menus` del manifest o los dominios de
servidor en `models/record.lists.ts`. Luego:

```bash
npx tsc --noEmit
npm run lint -- 'src/app/(auth)/erp/flota'
```

Estos cambios de presentación/consulta no requieren instalar, migrar ni generar
Prisma Client cuando los campos almacenados siguen iguales.
El scaffold nuevo trae Registros, Mis registros y Activos, reutilizando ListView.
El dominio se combina con los filtros visibles; los permisos de servidor siguen
siendo independientes. El acceso inicial del servicio es admin para todas sus
operaciones, aunque cambies `manifest.access`.

ListView incorpora selección de página y `Acciones → Eliminar` con confirmación.
`create={false}` y `delete={false}` ocultan las acciones correspondientes.
Eliminar registros de una lista no elimina la aplicación ni sus tablas.

## 6. Regenerar sólo el adaptador

Tras actualizar el generador de enlaces, con esquema, base y Prisma Client ya
sincronizados:

```bash
npm run orm:bind -- flota
npm run orm:bind -- flota --write
npx tsc --noEmit
```

El enlace incorpora, por ejemplo, el método `remove` o cambios de presentación de
auditoría. No se necesita migración por un cambio exclusivo del adaptador.

## 7. Consultar el estado sin aplicar cambios

```bash
npm run orm:generate -- flota
npm run orm:generate -- flota --check
npm run orm:install -- flota --update
npm run orm:bind -- flota
npx prisma migrate status --config prisma7.config.ts
```

Estos comandos son de revisión; `orm:install --update` se usa aquí para un módulo
ya instalado. `--check` devuelve salida 2 si los artefactos necesitan regenerarse.
Un preview sin SQL compara archivos, no demuestra que la base esté migrada;
`migrate status` consulta el historial de migraciones, no detecta todo el drift.

## 8. Desplegar migraciones versionadas

Con el código, esquemas, registros de propiedad y migraciones revisados/versionados,
en el entorno de despliegue configurado:

```bash
npm ci
npm run db:deploy
npm run build
npm run start
```

`build` ya ejecuta `db:generate`. Las migraciones se preparan en desarrollo;
`db:deploy` aplica las pendientes en el entorno elegido. `db:migrate` es el flujo
de desarrollo, no el de producción.

## 9. Retirar o eliminar aplicaciones

**Actualmente no existe un comando de desinstalación de aplicaciones.**
No hay `remove:app`, `delete:app` ni `orm:uninstall`. La creación,
instalación y evolución aditiva sí están implementadas.

Ocultar un menú, excluir una aplicación del catálogo visual, eliminar sus registros
y retirar sus fuentes/tablas son operaciones distintas. El procedimiento y las
limitaciones actuales están en [Retirar aplicaciones](../../../../../docs/retirar-aplicaciones.md).

El catálogo `src/lib/applications/scaffolded` y `prisma/.orm-installations.json`
tienen integridad/propiedad gestionadas: no editar sus hashes ni borrarlos para
forzar una retirada. Una desinstalación completa necesita resolver dependencias,
relaciones e inversas y coordinar código, registro y una migración explícita.

## Contratos y guías

- [Flujo del framework](../../../../../docs/flujo-framework.md).
- [Crear aplicaciones](../../../../../docs/crear-aplicaciones.md).
- [Dominios de lista](../../../../../docs/dominios-listas.md).
- [Auditoría de modelos](../../../../../docs/auditoria-modelos.md).

El formulario conserva RHF/isDirty, Revertir, carga y confirmación de salida.
Los hooks `beforeSave`/`afterSave` corren en la transacción; sus errores revierten
el guardado. Los efectos externos necesitan su propio flujo, fuera de esos hooks.

## Ejemplo para retomar la tutoría: Mis vehículos

Abre **Menú → Mis vehículos**, en `/erp/flota/mis-vehiculos`. Esta vista usa el
dominio `createBy = actor.id` del lado servidor y reutiliza las mismas columnas y
el formulario de la lista general. Limpiar los filtros visibles conserva ese dominio.

Recorrido para estudiar:

1. `models/record.lists.ts` declara `myVehicles` con `recordService.defineListAction`.
2. `actions/my-vehicles.actions.ts` obtiene la sesión con `requireAdmin` y recibe
   únicamente el estado de la lista.
3. `views/RecordList.tsx` elige el loader, título y breadcrumb con `view="mine"`.
4. `mis-vehiculos/page.tsx` monta esa variante; `manifest.ts` enlaza la ruta desde
   el desplegable que ya configuraste.

Ejercicio: compara «Vehículos» con «Mis vehículos», filtra por placas y limpia el
filtro. Sólo deben aparecer tus registros en la segunda vista. Los vehículos de
otra cuenta y los antiguos con creador desconocido no aparecen. Puedes repetirlo
con otra cuenta administradora para observar cómo cambia el dominio con la sesión.

Este dominio filtra una vista; los permisos actuales de abrir y guardar siguen
siendo de administrador. Contrato completo en [Dominios de lista](../../../../../docs/dominios-listas.md).

## Ejercicio: crear otro ejemplo con domain

Estado: dominio, acción, variante, página y menú ya están implementados en el código.
Queda pendiente confirmar la prueba funcional del paso 6 durante la tutoría.

**Objetivo:** crear «Mis vehículos activos» en `/erp/flota/mis-vehiculos-activos`,
combinando dos condiciones de servidor: el creador es el usuario de la sesión y
`active` es `true`. Es un ejercicio para realizar durante la tutoría, paso a paso.

1. Revisar el recorrido de «Mis vehículos» y explicar qué decide cada archivo.
2. Declarar otra acción de lista en `models/record.lists.ts` con las dos condiciones.
   El array del dominio las combina mediante AND; usar el boolean nativo `true`.
3. Crear su Server Action con `requireAdmin`, tomando únicamente `ListState` del
   navegador y conservando el manejo de errores del ejemplo anterior.
4. Añadir una variante a `RecordList` que seleccione esa acción y su título y
   breadcrumb, reutilizando las columnas y los enlaces al formulario existentes.
5. Crear la página y añadir «Mis vehículos activos» al dropdown del manifest.
6. Comparar las listas general, propia y propia activa. Aplicar filtros por placas
   y limpiarlos; después aplicar `Activo = No` en la nueva vista.

**Resultado esperado:** la nueva vista muestra sólo vehículos propios activos;
excluye los propios inactivos, los de otras cuentas y los de autor desconocido.
Limpiar filtros conserva ambas condiciones. `Activo = No` devuelve cero resultados,
porque se combina con el dominio fijo mediante AND.

El ejercicio conserva la política admin del servicio y no requiere cambiar modelos,
migrar ni regenerar adaptadores. Los pasos 1–5 se conservan como recorrido de estudio;
no es necesario volver a crear los archivos. Avance actual en
[Estado del proyecto](../../../../../docs/estado-proyecto.md).
