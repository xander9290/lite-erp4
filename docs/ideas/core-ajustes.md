# Partner/User nativos (`core`) y app Ajustes

**Plan iniciado el 2026-11-18.** Enfoque A aprobado y fases 1–4 implementadas en
`codex/core` (commit `dae4f6e`); corrección de Usuarios writeOnly en `39e7f6e`.
La fase 5, Contactos, iniciada por autorización del usuario: adaptación sobre
core.partner y concurrencia implementadas. El usuario inició contactosextra con
extendModel y street; siguen sus pruebas y los demás campos básicos de dirección.
Catálogos geográficos/APIs se abordarán después, por decisión del usuario.
El inventario y el plan iniciales se conservan como contexto; las secciones de
implementación describen el resultado. Continuidad revisada el 2026-11-18.

## Decisiones del usuario

- `core`: módulo declarativo **nativo** con Partner y User; sin icono en el cajón,
  siempre instalado, no desinstalable desde Módulos.
- App **Ajustes** en el cajón con los menús **Usuarios**, **Accesos** y **Módulos**; las
  apps Usuarios, Control de accesos y Módulos dejan de aparecer por separado.
- **Contactos** se rehace en una etapa posterior como app propia sobre `core.partner`,
  añadiendo sus campos con `extendModel(Partner, ...)`. Partner vive en `core` (no en
  Contactos) porque nombre/avatar de los usuarios dependen de él.
- Al crear un usuario se crea su contacto automáticamente, en la misma transacción
  (hook del modelo User en `core`, no una `@action`).
- Perfil se queda en el menú del avatar.

## Inventario (estado actual)

**Esquema** (`prisma/models/user.prisma`, `partner.prisma`, escritos a mano):
- `User`: login único, password, lastLogin, active, isAdmin, darkMode, sessionVersion,
  `partnerId` opcional y único (Restrict); relaciones con RecordActivity y
  AccessUserGroup; inversas `<modelo>CreatedRecords` que el instalador inserta con
  marcadores por cada módulo.
- `Partner`: name, email, phone, avatarUrl; inversa `user`.
- Ambos con `created_at`/`updated_at` **TIMESTAMP(3) sin zona** (los modelos declarativos
  usan TIMESTAMPTZ(3)) y **sin `create_by`**. Nombres Prisma `User`/`Partner`, tablas
  `users`/`partners`, distintos de la convención `<Módulo><Clave>`/`<módulo>_<clave>`.

**Código que consulta User/Partner (22 archivos):**
- Autenticación: `src/auth.ts` (login, JWT con `sessionVersion`), `lib/auth/*`
  (perfil, tema, contraseña, política `assertUserChange`), `prisma/seed.ts`.
- Usuarios: `lib/users/service.ts` (alta con `partner: { create }`, revisión doble
  usuario/contacto, revocación de sesión, último admin), `UserEditor.tsx`, rutas
  `/erp/usuarios`.
- Contactos: `contactos/models/contact.service.ts`, vistas y rutas `/erp/contactos`.
- Proveedores legacy: `lib/list/registry.ts`, `lib/list/delete*.ts`,
  `lib/many2one/registry.ts` (listas/lookups `user`/`partner`).
- Accesos y gestor: `lib/access/engine.ts`/`admin.ts` (isAdmin, grupos),
  `module-manager/*` (autorización admin), `lib/modules/registry.ts`, `lib/orm/service.ts`
  (actor, auditoría `createByUser.partner`).
- Integraciones: auth, contacts, framework, modules, theme.

**Rutas a mover:** `/erp/usuarios`, `/erp/accesos`, `/erp/modulos` aparecen en ~35
referencias (OperationPanel, ModuleDetail/List, UserEditor, layout, registro de apps,
pruebas de manifest/auth/legacy y `outputFileTracingIncludes` de next.config).

## Decisión técnica principal: cómo se vuelve declarativo el esquema

| | **A. Adaptador nativo (recomendado)** | B. Adopción completa por el generador |
| --- | --- | --- |
| Esquema | `user.prisma`/`partner.prisma` siguen escritos a mano, propiedad `@core` | El generador produce y posee el esquema de User/Partner |
| Clases `Model` | Sí: `Partner`/`User` con Fields, hooks, displayName, permisos | Sí |
| Repositorio | Adaptador explícito sobre `users`/`partners` (selects mínimos, `password`/`sessionVersion` nunca publicados) | Repositorio genérico |
| Migraciones | Ninguna obligatoria (opcional: `create_by` nullable) | TIMESTAMP→TIMESTAMPTZ en tablas con datos reales, nombres de modelo/tablas no convencionales, relaciones de infraestructura que el generador no conoce |
| Riesgo | Bajo: las tablas y la autenticación no cambian | Alto: DDL sobre cuentas reales y reescritura del generador |
| Lo que habilita | Many2one a `Partner`/`User` desde módulos, lookup/etiquetas/filtros/agrupación, `createBy` como Many2one legible, `extendModel(Partner)` con tabla compañera, ModelForm/ModelCollection en Ajustes y Contactos | Lo mismo |

Con A, «declarativo» significa que el **contrato** (modelo, permisos, servicio, vistas,
relaciones, herencia) es el del framework, y sólo el **esquema** sigue siendo
infraestructura. Puede evolucionar a B más adelante si hace falta.

## Fase 1 implementada (2026-11-18, rama `codex/core`)

Enfoque A aprobado por el usuario. Decisiones provisionales (pueden cambiarse): todo
usuario autenticado lee contactos (nombre, correo, teléfono, avatar); sólo admin escribe;
las altas de usuario crearán su contacto (fase 2).

- `src/lib/core/manifest.ts`: módulo nativo `core` (`native: true`) con
  `core.partner` = `Partner`/`partners` (`src/lib/core/models/partner.ts`: name,
  email con `@constraint`, phone, avatarUrl Image `avatars`). Grupo implícito
  `core.internal` «Usuario interno» (toda cuenta activa, en `userGroups`) con lectura.
- `src/lib/modules/installed.ts`: única lista registrada `[core, ...src/modules]` para
  registro, motor y administración de accesos. El cajón excluye módulos nativos; la ruta
  `/erp/core/...` responde 404.
- `defineModule`: `native`, y en modelos nativos `name`/`route`; `core` es dependencia
  implícita (declararlo en `depends` es error) y su ID está reservado. Extensiones de
  `core.partner` enlazan a `Partner` (`nativeModelNames`).
- Generador: `Partner` es destino nativo (`@core`) sin `depends`; el instalador escribe
  la inversa marcada en `partner.prisma`. Repositorio con `creator: false` para tablas
  sin `create_by` (auditoría sólo con fechas).
- Sin cambios en `partners`/`users` ni migraciones del ERP. Contactos, Usuarios, Perfil y
  autenticación siguen con su código manual.
- Verificado: test:modules 46 (5 nuevas en native.test.ts), test:orm 108/109 (EPERM),
  test:access 5, tsc, lint y test:core:integration (proyecto/esquema temporales: módulo
  `ventas` con Many2one a Partner y `crm` que extiende `core.partner`; SQL sin ALTER de
  partners/users; contacto previo con extensión vacía; guardado/creación/constraint;
  usuario interno lee/lista/busca pero no escribe; etiquetas Many2one; borrado Restrict).
  Regresión aprobada: test:capabilities, test:extensions, test:one2many y
  test:legacy:integration (auth, Contactos y tema con build en proyecto/esquema temporales).
  Se corrigió en legacy.integration.ts la comprobación obsoleta del trace que exigía
  `src/modules/demo` (retirado); ahora exige el manifest de cada módulo presente.
  Nota: `test:auth:integration` y `test:contacts:integration` ejecutados directamente usan
  `.env.local` (y el servidor en :3000); usar siempre el wrapper `test:legacy:integration`.
  Una ejecución directa de contacts el 2026-11-18 creó y borró cuentas temporales en la base
  de desarrollo; comprobado sin residuos.
- Conocido: Accesos lista el grupo «Usuario interno» como cualquier grupo; su membresía
  es implícita (se revisará al mover Accesos a Ajustes).

## Fase 2 implementada (2026-11-18, rama `codex/core`)

- `core.user` = `User`/`users` (`src/lib/core/models/user.ts`): login (único, normalizado
  a minúsculas, patrón validado), nombre/correo/teléfono/avatar **delegados** a su Partner
  (`inherits`, Odoo `_inherits`), contraseña `writeOnly`, activo, administrador y
  `lastLogin` de sistema. Sin grant: sólo admin (superusuario) abre cuentas.
- Alta: crea el contacto en la misma sentencia (`partner: { create }`) y exige contraseña
  (política 8–72 bytes). Edición: contraseña vacía conserva el hash; contacto con
  `upsert` (una cuenta antigua sin contacto lo recibe al guardar). Cambiar contraseña,
  login, estado o rol incrementa `sessionVersion` (revoca sesiones); sólo contacto, no.
- Reglas: `assertUserChange` en `beforeSave` (propia cuenta, último admin activo) y nuevo
  hook `beforeRemove` (no eliminarse ni al último admin).
- Framework: `Fields.Text({ writeOnly: true })` (implica sensitive; nunca seleccionado ni
  publicado; el repositorio exige su transformación o no arranca), `beforeRemove(record,
  {tx, actor, id})` en modelos, opciones nativas del repositorio (`writeOnly`, `readOnly`,
  `beforeUpdate`) e `inherits` en modelos nativos (reutiliza la relación 1:1 de las
  extensiones: lectura, búsqueda, orden y filtros por el contacto; sin agrupación).
  `ModelForm` y `eject:view` presentan writeOnly con `widget="password"`.
- `User` es destino nativo: `Fields.Many2one("User")` desde cualquier módulo, con etiqueta
  del nombre del contacto vía lookup autorizado (sólo admin hoy).
- Autenticación, Perfil, la app Usuarios y su servicio manual siguen sin cambios; la app se
  sustituirá en la fase 3 (Ajustes).
- Limitación inicial corregida durante fase 5: los guardados declarativos de Partner
  avanzan también la revisión de su User vinculado, sin revocar sesión. Los guardados
  delegados y Perfil avanzan ambas revisiones de forma monotónica; ver fase 5.
- Verificado: test:modules 48 (7 en native.test.ts), test:orm 108/109 (EPERM), tsc y
  test:core:integration en proyecto/esquema temporales (alta con contacto y hash verificado,
  hash nunca publicado, alta sin contraseña y login duplicado rechazados, edición sin
  contraseña, revocación por rol y no por contacto, lastLogin no escribible, cuenta sin
  contacto completada, propia cuenta y último admin, lector interno sin acceso, búsqueda
  por nombre del contacto, Many2one a User con etiqueta). Regresión aprobada: lint,
  test:legacy (auth/Contactos/tema con build), capabilities, extensions y one2many.

## Fase 3 implementada (2026-11-18, rama `codex/core`)

- App **Ajustes** (`src/app/(auth)/erp/ajustes`, admin, icono Settings) con menús
  Usuarios, Accesos y Módulos; `/erp/ajustes` abre Usuarios. Sustituye en el cajón a las
  apps Usuarios, Control de accesos y Módulos.
- `Ajustes → Usuarios` presenta `core.user` con las vistas del framework mediante
  `ModelRoute` (`src/components/modules/ModelRoute.tsx`), extraído de la ruta
  `/erp/<módulo>/<modelo>` y compartido por ambas. `core.user` usa la ruta
  `/erp/ajustes/usuarios`.
- Accesos y Módulos se movieron con `git mv` a `ajustes/accesos` y `ajustes/modulos`
  (breadcrumbs Aplicaciones › Ajustes › …); se retiraron sus manifests/layouts, la app
  Usuarios manual y `UserEditor`. `lib/users/service.ts` y `user.schema` siguen porque las
  integraciones de auth/contactos los usan; retirarlos cuando no queden consumidores.
- `next.config`: redirecciones temporales `/erp/{usuarios,accesos,modulos}[/*]` → Ajustes y
  trace del gestor en `/erp/ajustes/modulos`. Apps protegidas del gestor: ajustes,
  contactos y core.
- Accesos: «Usuario interno» (`core.internal`) se presenta como implícito: cuenta a los
  usuarios activos y no admite asignar miembros (también rechazado en el servidor).
- Verificado: tsc, lint, test:modules 48, test:orm 108/109 (EPERM), test:applications 10,
  test:auth 9, test:access 5, test:core:integration, test:legacy:integration (build temporal;
  rutas nuevas, redirecciones de las antiguas, acceso admin y denegación al usuario normal) y
  test:modules:integration completo (catálogo con Ajustes como app manual y protegida, ciclo
  de instalación/retirada). Sin revisión visual en navegador.

## Fase 4 implementada (2026-11-18, rama `codex/core`)

- `createBy` es la columna «Creado por» por defecto de `audit: true`: Many2one de lectura
  con etiqueta del nombre del contacto, filtro con selector de creadores y agrupación por
  creador. `createByUser.partner.name` queda como columna opcional (avatar, orden por nombre).
- `creatorLookup(modelo, actor, request)` en el registro y la Server Action fija
  `modelCreators`: creadores de registros **legibles** del modelo (scope de reglas en
  `<modelo>CreatedRecords: { some }`), búsqueda por nombre del contacto, sólo ID y nombre.
  Lo usan las etiquetas de lista/grupos (`relations.createBy`) y el filtro de
  `ModelCollection`. Los modelos nativos no tienen creador.
- Verificado: test:modules 48, test:orm 108/109 (EPERM), tsc, lint y
  test:capabilities:integration (filtro eq/vacío por creador, etiqueta, agrupación con
  conteo, selector por nombre, rechazo sin lectura del modelo, sin login ni credenciales).
  Regresión aprobada: lint, test:core, test:legacy (build) y test:extensions.
- Nota: las etiquetas de lista (Many2one y ahora `createBy`) usan el actor de la operación
  (`withActor`), como hacen las Server Actions `modelList`/`modelKanban`. Llamar
  `service.list` directamente sin `withActor` hace fallar la resolución de etiquetas; las
  pruebas siguen el mismo camino que la acción.

## Corrección tras revisión en navegador (2026-11-18)

Al abrir un usuario en Ajustes, el formulario fallaba con «Contrato incompatible: password
(text)»: `useModelField` rechaza todo campo `sensitive` y la copia cliente de Fields
(`lib/modules/fields.ts`) perdía `writeOnly`. Ahora un `writeOnly` se enlaza (siempre llega
vacío y sólo transporta un valor nuevo); el resto de `sensitive` sigue rechazado. Prueba en
`modelFields.test.tsx` (test:form-model 13). Las pruebas previas no renderizaban el formulario.

## Fase 5 en curso: Contactos declarativo (2026-11-18)

- Autorizada por el usuario. `/erp/contactos`, `/nuevo` y `/<id>` usan ModelRoute
  sobre core.partner, con ContactForm/ContactList como presentación de ModelForm y
  ModelCollection. Conserva guard, loader, consulta, revisión, historial, permisos,
  avatar autorizado y borrado con confirmación/FK. No hay clon de Partner.
- Los campos compartidos permanecen en core. La app muestra nombre, correo,
  teléfono y avatar; no publica login ni datos de cuenta a quienes sólo leen contactos.
  ModelRoute admite la aplicación que presenta un modelo nativo para breadcrumbs/
  etiquetas, sin modificar identidad, propiedad o permisos. También se conecta Ajustes.
- Contactos declara accessModels core.partner: cajón/menú/layout siguen su lectura
  efectiva y deniegan sin snapshot. Esto no sustituye autorización de cada acción.
- La edición de Partner avanza User.updatedAt vinculado dentro de la transacción,
  con comparación de revisión y sin sessionVersion. Escrituras delegadas de User y
  Perfil avanzan las fechas de ambos registros, incluso en el mismo milisegundo.
  Se conserva la política de secretos, propia cuenta y último administrador.
- Se retiró la Server Action manual de Contactos; el servicio/esquema antiguos y
  el servicio manual de Usuarios quedan sólo por consumidores de regresión.
  Proveedores legacy user/partner todavía tienen consumidores en `/sample` y
  pruebas, así que no se eliminan todavía ni se presentan como retirados.
- El usuario eligió dirección (México): street, número exterior, interior y zip;
  ciudad/estado/país y APIs después. Creó contactosextra/model/partner.ts con
  extendModel(Partner, ...) y street opcional/maxLength 160/tracking, registrado
  en extends core.partner. Fuentes, Prisma y migración 20261118225040 revisados:
  sólo tabla compañera con FKs e índices esperados. ModelExtensions lo presenta.
  Falta confirmación de guardar/reabrir Calle y vacío antes de añadir otro campo;
  sin consulta nueva de migrate status ni prueba de navegador del agente.
- Verificado hasta ahora: 30 pruebas focalizadas (incluyen auth/nativos/servicio),
  test:modules 48, test:applications 11, tsc y ESLint focalizado aprobados.
  test:core:integration aprobado en proyecto/esquema temporales: delegación,
  conflictos Contactos/Usuarios/Perfil, carrera de dos guardados, permisos y
  extensión CRM sobre Partner. Recursos temporales eliminados. Regresión legacy
  con build/HTTP autenticado aprobada: lista y alta de Contactos renderizan para
  admin, el lector ve la lista y se rechaza su alta; auth/Contactos/tema aprobados.
  La primera pasada detectó una aserción antigua que exigía User.updatedAt intacto
  al editar Partner; ahora verifica que sólo esa revisión avanza y conserva
  credenciales, permisos y sessionVersion. Repetición completa aprobada.
  Sin revisión visual nueva ni SQL en el ERP; git diff --check aprobado.

## Vistas personalizadas de Usuarios (2026-11-18)

Por petición del usuario, se crearon manualmente UserForm y UserList en
`src/app/(auth)/erp/ajustes/usuarios/views`, enlazadas mediante loaders diferidos
de core.user en `src/lib/core/manifest.ts`. No se amplía eject:view a core nativo.

El formulario usa ModelForm con grupos de datos de contacto y cuenta: avatar,
nombre, correo, teléfono, login, contraseña writeOnly, activo, administrador y
último acceso readOnly. Texto de ayuda distingue contraseña de alta y edición.
La lista usa ModelCollection y las siete columnas autorizadas del contrato actual;
no publica password ni sessionVersion. Se conservan permisos, revisión, historial,
hooks, protección de propia cuenta/último admin y navegación compartidos.

`ModelExtensions excludeFields` omite del render automático los campos delegados
que el formulario presenta explícitamente, sin quitarlos de RHF/valores/guardado.
Las extensiones futuras siguen con su grupo propio. ContactForm modificado por el
usuario antes de esta tarea se conservó sin cambios.

Comprobaciones: TypeScript, ESLint focalizado y test:form-model 13 aprobados.
Regresión legacy con build y HTTP autenticado aprobada: alta de Usuarios renderiza
nombre/correo/teléfono/login/password una sola vez y password como input de
contraseña; acceso de administrador y rechazo al usuario normal, auth/Contactos/
tema intactos. Proyecto/esquema temporales eliminados. Sin SQL ni cambios de
esquema en el ERP, sin revisión visual nueva. git diff --check aprobado.

## Punto de continuación: dirección de Partner (2026-11-18)

**Cierre posterior vigente:** campos básicos/CP/RFC, cuatro catálogos de Ubicaciones,
País/Estado del contacto y constraint ya completados con confirmaciones del usuario.
La guía está pausada: siguiente pendiente urgente,
[dominios de relaciones y colecciones](dominios-relaciones-colecciones.md). Seguir el
[punto exacto de Catálogos de dirección](../catalogos-direccion.md#estado-y-siguiente-paso)
antes de ejecutar las instrucciones históricas siguientes. No añadir campos ni
implementar domains durante la pausa.

Progreso revisado el 2026-11-18 en `main` (`21e18cc`, extra contactos fase 1),
árbol limpio al iniciar: extensión, vistas y documentación ya versionadas.
El usuario escribe y ejecuta sus ejercicios; el agente revisa y explica un paso
a la vez. No continuar por adelantado. La revisión no consultó la BD ni repitió
pruebas de persistencia.

Completado: módulo `contactosextra` registrado, extensión PartnerExtra en
`src/modules/contactosextra/model/partner.ts`, manifest con models vacío y
extends core.partner. street es Text opcional, máximo 160, tracking true.
Revisados Prisma y migración 20261118225040_sync_contactosextra: tabla compañera,
recordId único/Cascade a Partner y auditoría con FK Restrict a User. No se consultó
estado de migraciones ni se probó persistencia desde el navegador del agente.
ContactForm conserva ModelExtensions y presenta los campos añadidos automáticamente.

Pendientes al retomar, en orden:

1. Calle completada: el usuario confirmó guardar/reabrir con texto y vacía.
2. exteriorNumber completado: Text opcional/maxLength 20/tracking, clase y Prisma
   verificados. SQL 20261119023507_sync_contactosextra revisado: sólo ADD COLUMN
   exterior_number VARCHAR(20). Usuario confirmó sincronización y prueba propuesta
   de 12-A y vacío; sin comprobación independiente del agente en navegador/BD.
3. interiorNumber completado: Text opcional/maxLength 20/tracking, clase/Prisma
   y SQL 20261119023729_sync_contactosextra verificados (sólo columna nullable).
   Usuario confirmó sincronización y prueba de 4-B/vacío; sin prueba independiente.
4. zip añadido: Text opcional/minLength 5/maxLength 5/tracking, clase/Prisma y SQL
   20261119023945_sync_contactosextra verificados (VARCHAR(5) nullable). Usuario
   confirmó sincronización/prueba de 01234, vacío y rechazo de cuatro caracteres.
   Constraint implementada y revisada: @constraint("zip"), cinco dígitos ASCII o
   vacío, ModelValidationError asociado a zip. Usuario confirmó prueba propuesta
   de rechazo 12A34 y aceptación 01234; sin prueba independiente en navegador/BD.
   Nombre escrito validarCodigoPostar: funciona por el decorador; corregir a
   validarCodigoPostal sólo por claridad, sin migración.
5. RFC añadido y constraint básica revisada; usuario confirmó prueba propuesta y
   pidió continuar con catálogos. Recorrido vigente en
   [Catálogos de dirección](../catalogos-direccion.md): módulo compartido ubicaciones,
   primero dry-run del módulo; después Pais/Estado/Municipio/Localidad uno a uno.
   Sin creación/importación por adelantado. Fuentes previamente investigadas:
   [Correos de México](https://www.correosdemexico.gob.mx/SSLServicios/ConsultaCP/CodigoPostal_Exportar.aspx),
   [INEGI](https://www.inegi.org.mx/servicios/catalogounico.html) y
   [GeoNames](https://www.geonames.org/export/). Importación local/Many2one es
   recomendación propuesta, no implementación ni API ya configurada.

Esta pausa no crea campos, catálogos, SQL ni despliegues. No se hicieron nuevas
pruebas de código; git diff --check documental aprobado. No se ejecutó commit/push.

## Plan por fases (con A)

1. **Framework para modelos nativos.**
   - `defineModule` con `native: true`: sin icono/app en el cajón, siempre registrado,
     no instalable/desinstalable, ID `core` reservado.
   - Nombre Prisma/tabla explícitos para modelos nativos (`User`/`users`) y repositorio
     adaptador; el instalador los trata como destinos `@core` válidos para Many2one e
     inversas (como hoy con `createByUser`).
   - Rutas de modelo configurables (los modelos de `core` no tienen ruta propia; Ajustes
     y Contactos montan sus vistas).
   - Menús que apuntan a modelos de otro módulo con `depends` (Ajustes → `core.user`).
2. **`core.partner` y `core.user`.**
   - Partner: name, email, phone, avatarUrl (Image), displayName `name`.
   - User: login, active, isAdmin, lastLogin (lectura), `partnerId` obligatorio para altas
     nuevas; nombre/avatar vía related de Partner o grupo propio; contraseña como campo
     de escritura nunca leído (hash en el servidor), `sessionVersion`/`darkMode` no
     publicados. Hook: crear Partner al crear User en la misma transacción; conservar
     revocación de sesión, protección del último admin y autoedición.
   - Permisos: admin para escribir; regla explícita de quién puede **buscar personas**
     (lookup de User/Partner desde otros módulos) — decisión pendiente del usuario.
3. **App Ajustes.** Manifest nativo `ajustes` con menús Usuarios (ModelCollection/ModelForm
   sobre `core.user`), Accesos y Módulos; mover rutas a `/erp/ajustes/usuarios`,
   `/erp/ajustes/accesos`, `/erp/ajustes/modulos` (con redirección de las antiguas);
   retirar los manifests de Usuarios, Control de accesos y Módulos del cajón.
4. **Auditoría legible.** `createBy` como Many2one de lectura a `core.user` (etiqueta,
   filtro «soy yo»/vacío, agrupación por creador), sustituyendo la ruta
   `createByUser.partner.name` cuando el modelo lo publique.
5. **Contactos (etapa siguiente).** App sobre `core.partner` con `extendModel` para sus
   campos; retirar proveedores legacy `user`/`partner` cuando no queden consumidores.

## Criterios de aceptación

- Autenticación intacta: login, JWT/`sessionVersion`, revocación, perfil, tema y
  contraseña; `test:auth:integration`, `test:theme:integration`, `test:legacy:integration`.
- Sin cambios de datos ni DDL sobre `users`/`partners` en las fases 1–3 (diff de esquema
  vacío); cualquier migración opcional se presenta con su SQL antes de aplicarse.
- `password`, `sessionVersion` y campos de seguridad nunca en `ModelClientConfig`,
  listas, lookups, historial ni related.
- Módulos de prueba con Many2one a `Partner`/`User` y `extendModel(Partner)` en
  proyecto/esquema temporales; regresión de `test:modules:integration`,
  `test:one2many:integration`, `test:extensions:integration`, `test:contacts:integration`.
- Cajón: Ajustes visible sólo para quien tenga acceso; `core` nunca visible.

## Decisiones provisionales y puntos por revisar

1. Enfoque **A aprobado e implementado**: esquema de User/Partner escrito a mano,
   contratos y servicios declarativos; no está pendiente elegir A/B.
2. Actualmente Partner admite lectura de nombre/correo/teléfono/avatar por cuentas
   activas del grupo implícito Usuario interno; User sólo admite admin. Revisar la
   política de búsqueda de personas al diseñar Contactos; no ampliar permisos por defecto.
3. Altas de User crean contacto automáticamente; una cuenta antigua sin contacto lo
   recibe al guardar. partnerId conserva nulabilidad en SQL por compatibilidad.
4. Concurrencia cruzada corregida en fase 5 para servicios de Contactos, Usuarios
   y Perfil, con regresión en esquema temporal. Las escrituras Prisma/SQL externas
   que omitan esos flujos deben mantener sus propias garantías; no hay triggers.
