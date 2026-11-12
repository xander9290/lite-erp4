# Incorporar modelos declarativos al esquema de Prisma

`orm:install` conecta el modelo TS de una aplicación con `prisma/models`.
Este paso instala **archivos de esquema**; la base de datos, el cliente Prisma y
los servicios de la aplicación tienen pasos independientes.

## Flujo de desarrollo

Después de crear y personalizar una aplicación con `create:app`:

```sh
# Propuesta y contrato cliente: revisar antes de instalar.
npm run orm:generate -- mi-app --write

# Plan de instalación y SQL de revisión; no escribe archivos del proyecto.
npm run orm:install -- mi-app

# Incorpora el esquema y sus inversas. No ejecuta SQL.
npm run orm:install -- mi-app --write
git diff -- prisma
git status --short prisma
```

Revisar también los archivos nuevos: `git diff` por sí solo no muestra el contenido
de archivos todavía no versionados. Los ejemplos incorporados, como Flota sin
aplicación creada, no pueden instalarse con este comando.

Una vez revisado el esquema, en el entorno de desarrollo correspondiente:

```sh
npm run db:migrate -- --name install_mi_app --create-only
```

Revisar el nuevo `prisma/migrations/<fecha>_install_mi_app/migration.sql`.
Después de revisar el SQL, continuar:

```sh
npm run db:migrate
npm run db:generate
```

Estos últimos comandos sí operan sobre la base configurada y generan el cliente
activo. No los ejecuta el instalador. Una instalación de esquema repetida puede
ser idéntica aunque todavía falte migrar: el comando no consulta el estado de la base.
En producción se despliegan migraciones versionadas con `db:deploy`.

Los cascarones nuevos ya incluyen servicios autorizados y vistas conectadas.
Después de migrar y generar Prisma Client, ejecutar `orm:generate -- id --write`
y `orm:bind -- id --write` para generar el acceso tipado. Instalar el esquema por
sí solo no activa la persistencia. Guía completa en [Flujo del framework](flujo-framework.md).

## Archivos y propiedad

- `prisma/models/orm-<id>.prisma`: modelos y enums de la aplicación, gestionados
  por la herramienta. Editar su declaración TS, no este archivo.
- Modelos existentes: se insertan únicamente sus inversas, entre comentarios
  `BEGIN/END lite-erp:<id>:<Modelo>`. El resto del archivo sigue siendo editable.
- `prisma/.orm-installations.json`: registro de propiedad y hashes. Debe versionarse
  junto con los esquemas; no editarlo manualmente.

Se comprueban integridad, rutas sin symlinks y colisiones antes de escribir.
Un lock evita instalaciones simultáneas; se preparan los archivos temporalmente,
se vuelve a comprobar el esquema y se intenta restaurar lo anterior si falla un
reemplazo. Si falla la restauración se conservan los respaldos y se informa su ruta.
No es una transacción resistente a una interrupción del sistema operativo: tras
una interrupción, revisar los respaldos y el diff antes de reintentar. El registro
es un control local de integridad, no una firma ni un catálogo de permisos.

La integridad de un modelo instalado excluye las inversas gestionadas de otras
aplicaciones. Así, instalar un módulo dependiente no invalida al propietario del
modelo destino. La generación posterior conserva esas inversas en el preview.
Para destinos ya instalados se toma su propietario del registro y se exige declarar
la dependencia. Un `externalOwners` contradictorio se rechaza. Para modelos previos
del ERP, como Partner, se conserva el enlace explícito del perfil de confianza;
todavía no se contrasta automáticamente con el catálogo general de aplicaciones.

## Alcance inicial

Esta versión permite **modelos nuevos**, repeticiones sin cambios y actualizaciones
aditivas explícitas mediante `--update`. Sin ese flag se detiene si cambia un modelo
instalado. Se admiten campos opcionales, obligatorios con default SQL literal,
modelos nuevos y valores adicionales de enum. También se admite ampliar el límite
de un `String @db.VarChar(n)` a un valor mayor, manteniendo idénticos nombre,
nulabilidad, default, índices y mapeos. Esto permite aumentar `Fields.Text.maxLength`
sin editar archivos gestionados ni hashes a mano; revisar el ALTER TABLE antes de
aplicarlo, pues sigue siendo una migración de base de datos.
Para unicidad, longitud y nulabilidad de String existentes, `orm:sync --force`
incorpora un flujo revisado con comprobaciones de datos y SQL transaccional;
[alcance y continuación](sincronizar-aplicaciones.md#cambiar-restricciones-con---force).
`orm:install --update` por sí solo conserva su alcance aditivo. Renombrados, cambios
de tipo base, retiradas de campos y desinstalación requieren otro flujo. Cada actualización necesita revisar y aplicar su migración. Nunca se fuerza
una actualización borrando el registro de propiedad.

`orm:generate` puede seguir preparando propuestas y contratos cliente después de
instalar. Su SQL compara archivos actuales: después de incorporar el esquema será
vacío aunque la migración de la base todavía esté pendiente. Regenerar con `--write`
actualiza ese artefacto y permite volver a usar `--check`. No es una prueba de drift
ni reemplaza una migración versionada.

## Verificación

```sh
npm run test:orm:install
npm run test:orm
npm run test:scaffold
npx tsc --noEmit
```

Las pruebas usan proyectos temporales y una URL local sin servidor disponible.
Verifican instalación sin conexión, relaciones entre módulos, regeneración,
conservación de personalizaciones y rechazos por cambios/conflictos. Los proyectos
temporales de prueba son independientes de Flota y de sus datos existentes.

## Retirada de aplicaciones

El instalador no incluye desinstalación. `--update` admite evolución aditiva y no
retira tablas, modelos ni aplicaciones. Consulta [Retirar aplicaciones](retirar-aplicaciones.md)
para distinguir exclusión del catálogo, borrado de registros y retirada completa.
