# Desarrollo de aplicaciones: manifests, datos y operaciones de Contactos

La primera convención del ERP ya está implementada: cada aplicación tiene un
`manifest.ts` y se incorpora a un registro explícito. Contactos es el módulo piloto;
Usuarios usa el mismo contrato y depende de Contactos porque User se relaciona con
Partner. La estructura toma la organización por módulos como referencia y usa las
rutas de Next.js, los modelos de Prisma y nuestros componentes existentes.

## El archivo que debes conocer primero

Abre `src/app/(auth)/erp/contactos/manifest.ts`:

```ts
import { UsersRound } from "lucide-react";
import { defineApplication } from "@/lib/applications/manifest";

export const contactsManifest = defineApplication({
  id: "contactos",
  name: "Contactos",
  description: "Contactos compartidos de empresas, usuarios, clientes y proveedores.",
  version: "0.1.0",
  icon: UsersRound,
  depends: [],
  access: "authenticated",
  models: ["Partner"],
});
```

| Propiedad | Qué decides |
| --- | --- |
| `id` | Identificador técnico estable. Coincide con la carpeta y deriva `/erp/contactos`. Usa minúsculas y guiones. |
| `name` | Nombre visible en la grilla y título de su lista. |
| `description` | Qué hace la aplicación. |
| `version` | Versión del módulo con formato `0.1.0`. Es información; todavía no ejecuta actualizaciones automáticas. |
| `icon` | Un icono de Lucide, el sistema de iconos que ya usamos. |
| `depends` | Identificadores de otros módulos que necesita. |
| `access` | `authenticated`: cuenta activa; `admin`: administradores. Controla entrada y visibilidad del módulo. |
| `models` | Nombres de los modelos Prisma que **pertenecen** al módulo. No son nombres de tablas ni crean modelos por sí solos. |

Por ejemplo, Usuarios declara `models: ["User"]` y `depends: ["contactos"]`.
Usar Partner desde Usuarios no significa volver a declarar su propiedad: Partner
pertenece a Contactos y su relación física sigue definida en Prisma.

## Qué ocurre al registrarlo

`src/lib/applications/registry.ts` importa los manifests explícitamente. A partir de
ellos la portada del ERP obtiene nombre, icono y enlace de las aplicaciones visibles.
El registro comprueba IDs únicos, dependencias existentes, ciclos y que un mismo
modelo no tenga dos propietarios. `ApplicationLayout` usa la misma regla de acceso
para abrir la ruta directamente.

`access` no sustituye los permisos de cada operación del servidor. Las acciones
existentes conservan sus comprobaciones: gestionar usuarios requiere administración;
las búsquedas relacionales autenticadas siguen devolviendo sólo los DTO permitidos.
Ocultar una tarjeta o proteger un layout no protege una Server Action.

Ventas conserva por ahora su tarjeta de demostración; aún no es un módulo registrado.

## Un primer ejercicio sencillo

1. Cambia `name` de Contactos por `Agenda`.
2. Abre `/erp`: su tarjeta mostrará Agenda. La lista también usará ese título.
3. Comprueba que la dirección sigue siendo `/erp/contactos`: cambiar el nombre visible
   no cambia el identificador técnico.
4. Devuelve el nombre a Contactos cuando termines.

## Paso 2: el contrato del formulario de Contactos

El modelo Partner existente ya contiene nombre, correo, teléfono y avatar. En este
paso se define cómo representarlos y validarlos en el formulario. Los archivos son:

```text
src/app/(auth)/erp/contactos/
├── manifest.ts
├── models/
│   └── partner.ts              # Select y conversiones del servidor
└── schemas/
    └── contact.schema.ts       # Validación, tipo y valores iniciales
```

`contact.schema.ts` exporta `contactSchema`, `ContactValues` y `newContactDefaults`.
Las reglas de contacto se comparten con Usuarios y Perfil mediante
`partnerContactShape`, definido en `src/schemas/partner.schema.ts`.

| Campo | Regla |
| --- | --- |
| `name` | Obligatorio, de 2 a 120 caracteres; se quitan espacios de los extremos. |
| `email` | Opcional; vacío o un correo válido de hasta 254 caracteres. |
| `phone` | Opcional, hasta 40 caracteres; conserva prefijo, separadores y extensión. |
| `avatarUrl` | URL HTTPS de hasta 2048 caracteres o `null`. |
| `id` | Identifica un contacto existente; se omite al crear. |
| `revision` | Fecha `updatedAt` del contacto en ISO UTC; vacía al crear. |

Los valores iniciales están pensados para RHF: `name`, `email` y `phone` empiezan
vacíos, `avatarUrl` empieza en `null` y no hay `id`. El nombre vacío hace que el
formulario nuevo aún sea inválido: se valida al enviar, no al construir defaults.

```ts
import { contactSchema, newContactDefaults } from "./schemas/contact.schema";

const result = contactSchema.safeParse({
  ...newContactDefaults,
  name: "  Empresa Ejemplo  ",
  email: "ventas@example.test",
});

if (result.success) {
  // result.data.name === "Empresa Ejemplo"
}
```

El módulo rechaza claves adicionales como `user`, `password` o `isAdmin`: un
formulario de Contactos edita datos de Partner y no concede acceso al ERP.

El recorrido de los datos será:

```text
Partner de Prisma → contactFormValues → FormView/RHF
FormView/RHF → contactSchema → contactWriteData → Partner de Prisma
```

`models/partner.ts` contiene un `contactFormSelect` explícito, sin datos de User.
`contactFormValues` convierte `updatedAt` a ISO y los correos/teléfonos `null` a
controles vacíos; `contactWriteData` convierte los controles vacíos nuevamente a
`null` y permite escribir sólo los cuatro campos del contacto. Estos helpers son
del servidor y no ejecutan consultas por sí solos.

`id` y `revision` son datos de control, no inputs editables. El esquema valida el
formato de la revisión; la operación de guardado descrita a continuación comprueba
permisos y compara esa revisión con la base de datos antes de actualizar.

Como ejercicio, prueba un nombre de un carácter, un correo incorrecto y una clave
`isAdmin` adicional usando `safeParse`: los tres deben producir `success: false`.

## Paso 3: abrir, crear y guardar contactos

La aplicación ya tiene estas dos capas:

```text
contactos/
├── actions/
│   └── contact.actions.ts      # Entrada desde el navegador y sesión del servidor
└── models/
    ├── partner.ts              # Select y conversiones de datos
    └── contact.service.ts      # Reglas y transacciones de base de datos
```

El FormView usa las acciones de `actions/contact.actions.ts`:

```ts
import { readContact, saveContact } from "./actions/contact.actions";

// Abrir un registro: resultado compatible con FormViewLoader.
const loaded = await readContact(id);

// Crear con newContactDefaults, o editar con los valores recibidos al abrir.
const saved = await saveContact(values);
```

`readContact(id)` devuelve `{ ok: true, values }` o `{ ok: false, error }`.
`saveContact(values)` devuelve los valores canónicos de la base, con su ID y nueva
revisión, o un error de validación/servidor compatible con FormView. Se crea cuando
no hay ID; se actualiza cuando lo hay. Un ID que ya no existe produce un error y
no recrea el contacto.

| Operación | Permiso inicial |
| --- | --- |
| Abrir un contacto | Cuenta activa con sesión vigente. |
| Crear un contacto | Administrador activo con sesión vigente. |
| Editar un contacto | Administrador activo con sesión vigente. |

Estos permisos de escritura son la base inicial del piloto. Los grupos y reglas
por operación se ampliarán al definir el sistema de permisos del scaffold.
El perfil propio conserva sus reglas independientes de edición de datos personales.

Las acciones obtienen la identidad desde la sesión del servidor. El servicio la
verifica de nuevo en la transacción; no acepta el rol ni la identidad del editor
desde el formulario. Sólo se escriben los datos de Partner permitidos por el DTO:
crear un contacto no crea una cuenta de acceso ni modifica sus credenciales.

Antes de actualizar se compara `revision` con el `updatedAt` actual. La escritura
incluye esa misma condición y avanza la revisión incluso si dos operaciones se
ejecutan en el mismo milisegundo. Los conflictos se devuelven como validación para
que FormView muestre la alerta y el usuario pueda recargar el registro.

Partner también puede cambiar desde Usuarios o Perfil. El formulario de Usuarios
incluye ahora `partnerRevision`, además de la revisión de User; Perfil ya incluía
ambas. Así, una edición antigua de cualquiera de las tres vistas no sobrescribe
los cambios que otra hizo sobre el contacto compartido.

## Paso 4: las vistas de Contactos

El módulo piloto ya conecta su lista con el formulario. Sus rutas son:

| Ruta | Uso |
| --- | --- |
| `/erp/contactos` | Lista con avatar, nombre, correo, teléfono y usuario relacionado. |
| `/erp/contactos/nuevo` | Crear un contacto; sólo para administradores. |
| `/erp/contactos/[id]` | Editar como administrador o consultar como usuario autenticado. |

`page.tsx` se limita a montar `views/ContactList.tsx` dentro de Suspense. La lista
reutiliza ListView, sus filtros por columna, orden y paginación. Muestra el botón
«Nuevo contacto» a administradores y cada fila abre la ruta del registro. Correo y
teléfono están registrados como campos públicos de texto; sus filtros contemplan
los valores `null` y la ordenación deja los vacíos al final.

`views/ContactForm.tsx` reúne RHF, `zodResolver(contactSchema)` y FormView. El body
usa FormGroup, FieldImage con `widget="avatar"` y FieldText para nombre, correo y
teléfono. El avatar reutiliza el uploader de Cloudinary existente. El formulario
adapta sus columnas al ancho disponible y mantiene desactivado el autocompletado.

Para abrir un contacto se utiliza FormViewLoader con «Cargando…», errores y
reintentos. Al guardar, FormView restablece los valores canónicos, limpia `isDirty`
y el alta navega a la URL del contacto creado. «Nuevo contacto» dentro de un registro
abre el alta vacía; la key de navegación evita recuperar un borrador anterior en
una navegación nueva. La salida con cambios pendientes y el botón Nuevo conservan
el aviso compartido de navegación.

El menú de engrane incluye «Recargar registro». Si hay cambios pendientes solicita
confirmación antes de descartarlos y vuelve a ejecutar la carga. Esto permite
recuperar la revisión actual después de un conflicto de edición.

Para cuentas sin permisos de escritura el formulario usa `readOnly`: los campos
están bloqueados, el avatar se presenta como imagen y no aparecen Guardar, Revertir
ni Nuevo. El menú de recarga sigue disponible. Visitar directamente la ruta de alta
redirige a la lista; las acciones del servidor siguen comprobando permisos.

Como ejercicio de uso, crea un contacto de prueba, modifica su teléfono y guarda.
Después cambia algún dato sin guardar y pulsa «Nuevo contacto»: el aviso debe
permitir seguir editando o descartar el borrador e iniciar un alta vacía.

## El flujo que iremos completando

1. **Identidad:** manifest y registro. Este primer paso ya funciona.
2. **Datos y relaciones:** el contrato básico de Contactos ya tiene DTO, valores
   iniciales y validación Zod; reutiliza los campos y relaciones existentes de Partner.
3. **Operaciones:** lectura, creación y actualización de Contactos implementadas
   con permisos, validación, transacciones y concurrencia entre las vistas del Partner.
4. **Vistas:** lista y formulario de Contactos conectados, con alta, edición,
   consulta, carga, recarga y protección de cambios pendientes.
5. **Automatización:** generar el cascarón después de validar el flujo completo con
   Contactos y Citas. La dirección acordada es declarar modelos mediante clases y
   Fields en TypeScript, derivando Prisma, Zod, tipos y valores iniciales. Las vistas
   se escriben libremente en TSX con nuestros componentes; se pueden generar archivos
   iniciales editables, sin un motor de renderizado automático ni XML. El generador
   deberá rechazar sobrescrituras de archivos personalizados. El contrato y generador
   tienen una primera base en [modelos TypeScript](modelos-typescript.md): clases,
   Fields, Zod y tipos ya funcionan. El [generador inicial](generador-modelos.md)
   produce una propuesta Prisma, SQL de revisión y esquema cliente de Flota, sin
   migrar ni modificar el esquema activo. [create:app](crear-aplicaciones.md) ya crea
   rutas, vistas editables y registro del módulo. [orm:install](instalar-modelos.md)
   incorpora modelos nuevos e inversas al esquema activo, sin ejecutar SQL.
   La actualización aditiva y persistencia inicial ya funcionan con `--update`
   y `orm:bind`; recorrido en [Flujo del framework](flujo-framework.md).
   detalles en [la decisión del scaffold](ideas/aplicaciones-modulares.md).
6. **Catálogo:** activar módulos ya incluidos en el despliegue, respetando dependencias.

El manifest actual no descubre carpetas, genera código, modifica tablas, instala
paquetes ni activa módulos desde una base de datos. Estas capacidades se incorporarán
por fases. Los nuevos modelos necesitarán su migración revisada, generación del cliente
Prisma y despliegue, siguiendo los scripts actuales del proyecto.

## Verificación

La práctica guiada de [Citas odontológicas](citas-odontologicas.md) ya une modelos,
contratos, operaciones, lista y formulario con tratamientos one2many e historial.
Reutiliza Contactos como dependencia y documenta cada paso para desarrollar otro módulo.

```sh
npm run test:applications
npm run test:contacts
# Requiere la base local; usa únicamente cuentas/contactos temporales y los elimina:
npm run test:contacts:integration
npm run lint
npm run build
```

Esta fase no modifica el esquema ni requiere nuevas migraciones.
