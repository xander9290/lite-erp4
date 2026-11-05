# Autenticación y app temporal Usuarios

NextAuth v5 usa Credentials con sesiones JWT de 8 horas. No requiere tablas de
Account, Session ni un adapter de Auth.js: Prisma consulta User y Partner directamente.

## Configuración local

En `.env.local` se necesitan `DATABASE_URL` y `AUTH_SECRET`. El secreto ya se generó
localmente; debe permanecer fuera de Git y conservarse entre reinicios. En producción
usa un secreto propio y configura `AUTH_URL` con la URL pública HTTPS. Usa
`AUTH_TRUST_HOST=true` únicamente si el despliegue controla y valida el encabezado
Host de las solicitudes recibidas.

```sh
npm run db:migrate
npm run db:generate
npm run db:seed
npm run dev
```

Prisma 7 usa `prisma7.config.ts`, modelos en `prisma/models` y migraciones en
`prisma/migrations`. `migrate dev` corresponde al desarrollo; en despliegues aplica
las migraciones revisadas con `npx prisma migrate deploy --config prisma7.config.ts`.

El seed crea el usuario inicial **admin / 1234**, activo y administrador, con su Partner.
Guarda la contraseña con bcrypt (coste 12). Repetir el seed conserva las credenciales
y permisos de un admin existente. La contraseña inicial es para arrancar el entorno;
puedes cambiarla desde Usuarios. Las contraseñas nuevas requieren al menos 8 caracteres
y un máximo de 72 bytes UTF-8.

## Rutas y permisos

- `/auth`: login; conserva el destino solicitado dentro de `/erp`.
- `/erp/**`: requiere una cuenta activa.
- `/erp/usuarios`: listado, alta y edición, disponible sólo para administradores.
- `/erp/perfil`: datos del Partner de la cuenta actual, para cualquier usuario activo.
- `/erp/perfil/contrasena`: contraseña actual, nueva y confirmación; disponible con sesión activa.
- `/api/auth/[...nextauth]`: endpoints de NextAuth, incluidos CSRF, sesión y logout.

`src/proxy.ts` valida el JWT antes de entrar a `/erp`. La comprobación definitiva se
hace en el servidor: `auth()` verifica que el usuario siga activo y que su
`sessionVersion` coincida con la base de datos. Los layouts muestran la interfaz
correspondiente, pero cada Server Action debe comprobar sus propios permisos con
`requireUser()` o `requireAdmin()` de `src/lib/auth/access.ts`.

Los listados y búsquedas relacionales existentes también exigen sesión; listar User
requiere administración. `/sample` sigue siendo público, pero sus ejemplos que leen
la base de datos requieren iniciar sesión. Los DTO exponen sólo campos permitidos,
nunca hashes de contraseñas.

## Usuarios

La app guarda User y Partner en una transacción. Incluye `active`, `isAdmin` y
`sessionVersion`, además de datos de contacto, usuario y contraseña opcional al editar.
Partner contiene `avatarUrl` (opcional, columna `avatar_url`); Usuarios lo edita con
`FieldImage widget="avatar"`, reutilizando la configuración Cloudinary existente y
la carpeta `lite-erp/partners`. La URL pública HTTPS se guarda al guardar el formulario,
y quitar la imagen guarda `null`. La sesión la expone como `session.user.image`,
consultada desde el Partner asociado. Cambiarla no revoca las sesiones. Quitarla
no elimina el archivo remoto. Partner será también el contacto base de empresas,
clientes y proveedores; esos módulos no se implementan como parte de este cambio.
Cambiar contraseña, login, actividad o permisos incrementa la versión e invalida las
sesiones anteriores en su siguiente solicitud al servidor. Una contraseña vacía al
editar conserva el hash actual. El usuario no puede desactivarse ni retirarse sus
propios permisos administrativos, y debe quedar al menos un administrador activo.

Una revisión de `updatedAt` evita sobrescribir una edición concurrente. El formulario
recibe la revisión y los valores confirmados al guardar para reiniciar `isDirty`.
La app es temporal hasta definir el scaffold de aplicaciones.

## Mi cuenta

La apariencia se guarda por usuario en `User.darkMode` (columna `users.dark_mode`,
booleano con valor inicial `false`). El botón del header aplica `dark` o `corporate`
de daisyUI y persiste la selección mediante una acción autenticada. La sesión consulta
la preferencia actual de la base de datos y el ERP la incluye en su render inicial;
se conserva al recargar y en próximos inicios de sesión, incluso en otro navegador.
El login mantiene su tema claro. Si falla el guardado, se restaura el tema anterior
y se muestra una alerta. Cambiar la apariencia no revoca sesiones ni invalida la
revisión de formularios abiertos; las credenciales, permisos y otros usuarios no
son editables desde esta acción.

El menú de cuenta del header reutiliza PartnerAvatar y permite abrir el perfil,
cambiar la contraseña o salir. Sus enlaces y el cierre de sesión respetan los
cambios pendientes de FormView. El menú se cierra con Escape, al elegir una opción
o al hacer clic fuera. En móvil reorganiza el header para mantener usuario/avatar
y reloj visibles.

El perfil sólo modifica nombre, correo, teléfono y avatar del Partner propio. El
usuario se obtiene de la sesión en cada acción; los inputs estrictos no aceptan ID,
login, actividad ni permisos. La escritura vuelve a verificar cuenta y versión de
sesión dentro de una transacción y compara revisiones de User y Partner para evitar
sobrescribir cambios concurrentes. Guardar refresca la identidad mostrada en el header.

Cambiar contraseña requiere verificar la actual y confirmar la nueva (mínimo 8
caracteres, máximo 72 bytes). Se limitan intentos por cuenta en la instancia del
servidor. Una actualización atómica comprueba el hash y la versión leídos antes de
guardar el nuevo hash e incrementar sessionVersion; una carrera no permite dos
cambios basados en la misma contraseña. Las sesiones anteriores quedan invalidadas,
se borra la cookie de la sesión actual y la interfaz vuelve al login. Los resultados
de la acción nunca devuelven las contraseñas. No se requieren modelos ni migraciones
adicionales.

## Verificación

```sh
npm run test:auth
# Requiere el servidor local y la base de desarrollo con admin / 1234:
npm run test:auth:integration
# Usa exclusivamente cuentas temporales, requiere el servidor y la base local:
npm run test:theme:integration
```

La integración usa `TEST_AUTH_URL` si está definido (por defecto `http://localhost:3000`).
Crea una cuenta temporal propia y elimina sólo esa cuenta y su Partner al terminar.
Comprueba redirects, CSRF/login/logout, permisos, cambios concurrentes, hashes,
revocación, cuentas inactivas y cookies alteradas. No debe ejecutarse contra producción.

El login limita intentos por usuario y por instancia del proceso. Antes de desplegar
varias instancias, sustituye ese almacén por un limitador compartido y añade límites
de tráfico en la infraestructura.
