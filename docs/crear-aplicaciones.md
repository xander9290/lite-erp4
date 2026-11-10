# Crear una aplicación con el scaffold

`create:app` ya prepara un módulo, su modelo inicial, contrato cliente y vistas TSX
editables. Flota es el ejercicio de tutoría ya creado en este proyecto; los cambios
del generador se aplican a aplicaciones nuevas. Los módulos existentes se actualizan
manualmente, conservando sus personalizaciones.

## Comandos

```sh
# Simulación: valida y muestra el plan sin crear archivos del proyecto.
npm run create:app -- Flota --dry-run

# Creación real en un proyecto donde todavía no existe Flota.
npm run create:app -- Flota
```

Los nombres con espacios se escriben entre comillas. `"Gestión de Flota"` produce
el identificador `gestion-de-flota`. Se rechazan nombres reservados, rutas y duplicados.

## Archivos del módulo

```text
src/app/(auth)/erp/flota/
├── manifest.ts
├── orm.config.ts
├── models/
│   ├── Record.ts
│   ├── record.service.ts
│   └── record.lists.ts
├── schemas/record.schema.ts
├── actions/record.actions.ts
├── views/
│   ├── RecordList.tsx
│   └── RecordForm.tsx
├── layout.tsx
├── page.tsx
├── mis-registros/page.tsx
├── activos/page.tsx
├── nuevo/page.tsx
├── [id]/page.tsx
└── README.md
```

El modelo inicial, `FlotaRecord`, declara nombre obligatorio y activo booleano.
Es un punto de partida genérico, no una definición automática de vehículos.
El desarrollador puede editar libremente estos archivos. El comando rechaza una
carpeta de aplicación existente, aunque esté vacía; no se usa para regenerar vistas.

## Registro y acceso

El README de cada cascarón incluye los comandos ordenados por caso: creación,
primera instalación, nuevos campos, validación, vistas/menús/dominios, actualización
del adaptador, consultas de estado y despliegue. Conserva los puntos de revisión
entre `--create-only` y la aplicación de las migraciones. Los README existentes
son editables; el generador no los sobrescribe al actualizar el framework.

La tarjeta se incorpora mediante imports estáticos gestionados en
`src/lib/applications/scaffolded/registry.ts`. El registro principal combina esa
lista con Contactos, Usuarios y Citas, conservando validaciones de IDs, dependencias
y propiedad de modelos. No se reescribe su registro manual.

El catálogo y su índice llevan un manifiesto de integridad. Si se modifican fuera
del generador, la creación se detiene antes de crear el módulo. El nombre, icono,
descripción y acceso se personalizan en el manifest propio de la aplicación.

El acceso inicial es **admin**. ApplicationLayout protege la ruta y las acciones
verifican permisos de forma independiente; cambiar el manifest no cambia
automáticamente la política de escritura de las acciones.

El manifest incluye `menus` con «Registros», «Mis registros» y «Activos». Sus acciones
fijan el dominio en `models/record.lists.ts` y reutilizan la misma ListView; guía en
[dominios de lista](dominios-listas.md). La creación se ofrece desde ListView.
El Topnav muestra las opciones de la aplicación activa, con un desplegable en móvil. Puedes añadir
enlaces o grupos de un nivel a rutas existentes dentro de la aplicación; el menú
no crea esas vistas ni ejecuta acciones. Contrato y permisos en
[navegación de aplicaciones](desarrollo-aplicaciones.md#navegación-de-cada-aplicación-en-el-topnav).

## Vistas y guardado

La portada usa ListView con una acción propia del módulo para paginación, filtros
y orden. Las columnas se editan en `views/record.list.ts`; el servicio fija los
campos permitidos en el servidor, sin aceptar modelos arbitrarios del navegador.

El formulario usa FormView, RHF, Zod y nuestros Fields. Conserva isDirty, Revertir,
aviso al salir con cambios, FormViewLoader y recarga protegida. Las acciones usan
el servicio compartido, que revalida permisos admin en la transacción y controla
las revisiones. Antes de completar `orm:bind`, devuelven un error explícito; no
simulan un guardado exitoso ni descartan el borrador.

ListView incorpora casillas por fila y selección de la página visible. Su acción
«Eliminar» usa `deleteRecords` y `recordService.remove`, con confirmación, revisión
y borrado transaccional admin. `create={false}` y `delete={false}` ocultan los botones
de la vista. Los adaptadores nuevos incluyen `remove`; los anteriores requieren
`orm:bind -- id --write`, sin migrar. Contrato en
[ListView](../src/components/ui/list/ListView.md#selección-y-acciones-predeterminadas).

El comando registra la aplicación en la interfaz, pero no crea tablas ni ejecuta
migraciones. El paso posterior `orm:install` ya incorpora modelos nuevos al esquema
de Prisma; el flujo está en [Instalar modelos](instalar-modelos.md).
Después de migrar y ejecutar `db:generate`, `orm:bind --write` genera y compila
el acceso tipado a Prisma. La lista y el guardado quedan conectados. El recorrido
completo, incluida la actualización aditiva, está en [Flujo del framework](flujo-framework.md).

## Generación desde la aplicación

`orm.config.ts` exporta `generationProfile`: modelo, clientFields y enlaces de
dependencias externas. Se carga como código de desarrollo de confianza, sin importar
React/iconos. Esta carga nunca debe exponerse como una Server Action.

```sh
npm run orm:generate -- flota
npm run orm:generate -- flota --write
npm run orm:generate -- flota --check
```

La salida del módulo está en `src/generated/orm/apps/flota/`: Zod, defaults, tipos,
fragmento Prisma, preview del esquema, SQL de revisión, reporte y manifiesto de
integridad. El cascarón ya crea esos artefactos iniciales para que las vistas compilen.
`schemas/record.schema.ts` los reexporta sin importar la clase del servidor.

Al añadir campos, elige cuáles publicar en clientFields, regenera y compón la vista
en TSX. Mantén coherentes las dependencias del manifest y del perfil; externalOwners
enlaza modelos existentes hasta completar la integración automática del catálogo.

El ejemplo original de Flota conserva `src/generated/orm/flota/`. Para consultarlo
incluso después de crear una aplicación Flota:

```sh
npm run orm:generate -- flota --example --check
```

## Protección y comprobaciones

Se comprueban rutas, artefactos e integridad del registro antes de crear. Un lock
evita creaciones simultáneas en el catálogo; los archivos se preparan en una carpeta
temporal y se intenta restaurar lo anterior si falla la operación. Se conservan
respaldos si la restauración no puede completarse. No hay flag force ni borrado
automático de aplicaciones.

```sh
npm run test:scaffold
npm run test:orm
npm run test:applications
npx tsc --noEmit
```

Las pruebas crean módulos en proyectos temporales, validan su propuesta con Prisma,
comprueban regeneración sin cambios y compilan sus archivos TSX, sin acceder a una
base de datos. El instalador se verifica con `npm run test:orm:install`.
La integración `npm run test:framework:integration` verifica migraciones, persistencia,
actualización aditiva y seguridad en un proyecto/esquema temporales. El flujo base
ya permite comenzar la práctica de Flota; su aplicación sigue sin crear.
