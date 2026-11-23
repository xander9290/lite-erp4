# User autónomo y retirada de core.partner

Cambio del 2026-11-23 autorizado por el usuario. Sólo `core.user` es nativo;
Contactos y `core.partner` se retiran. El piloto contactosextra fue desinstalado
previamente por el usuario. Directorio queda como aplicación declarativa futura,
sin crear modelos, tablas ni hooks por anticipación.

## Contrato actual

User almacena `name`, `email`, `phone` y `avatarUrl` en users, junto a sus campos
de cuenta. Autenticación, Perfil, Usuarios, autores de actividad, auditoría y
proveedores manuales de búsqueda leen directamente esos campos. No se crea un
contacto al dar de alta una cuenta. El núcleo conserva hash de contraseña,
revocación de sesión, protección del último administrador y de la propia cuenta.

Perfil y Usuarios comparten una sola revisión updatedAt. Los formularios anteriores
al cambio deben recargarse; partnerRevision deja de formar parte de los contratos.
El servicio declarativo valida el nombre obligatorio; el default SQL vacío permite
conservar compatibilidad con altas internas mínimas, cuya sesión presenta login
si falta nombre. El seed nuevo crea el nombre Administrador directamente en User.

Las columnas de auditoría usan `createByUser.name` y `createByUser.avatarUrl`.
Las vistas personalizadas deben actualizar las rutas anteriores a través de
partner. El widget visual `partner` y PartnerAvatar se conservan como componentes
de presentación: sus nombres no registran un modelo ni consultan una tabla.
El proveedor manual de relaciones admite sólo `user`; Directorio usará su lookup
declarativo autorizado cuando exista. Los adaptadores expulsados antiguos necesitan
revisión/regeneración con orm:bind según su propietario, sin editar hashes a mano.

## Preservación y migración

`20261123220000_user_standalone_profile/migration.sql`:

1. Añade las cuatro columnas del perfil a users.
2. Copia los valores de cada contacto vinculado; sin contacto usa login como nombre.
3. Avanza updatedAt sobre la revisión de cuenta y contacto para rechazar borradores
   antiguos. Conserva hashes, IDs, permisos, sesiones y demás datos de cuenta.
4. Retira users_partner_id_fkey. Conserva partner_id y su índice único como
   `legacyPartnerId`, escalar histórico no editable ni publicado por el framework.

La tabla partners conserva todas sus filas, también contactos sin usuario. Prisma
la representa como `LegacyPartner` con @@ignore: no tiene servicio, ruta, proveedor
ni delegado Prisma Client público. Es archivo histórico, no el modelo de Directorio.
No eliminar sus datos ni incorporarlos a una futura app sin diseñar su migración.
Permisos e historial con identificadores retirados se conservan como datos
históricos y no conceden acceso a modelos inexistentes.

## Activación en una base existente

La migración ya fue aplicada con aprobación en desarrollo Windows el 2026-11-23.
Para otras bases, cambiar el código por sí solo no aplica SQL: confirmar el estado
local en docs/estado-proyecto.md. Las pruebas de migración usan esquemas temporales.
Revisar SQL y estado de migraciones antes de deploy, conservar un respaldo y
detener el servidor anterior para evitar escrituras al contacto durante la copia.
Tras autorizar/aplicar las migraciones pendientes:

```powershell
npm run db:deploy
npm run db:generate
```

Reiniciar el servidor con la nueva versión y recargar formularios abiertos. No
ejecutar el código nuevo sobre una base que aún carezca de las columnas de perfil.
Volver al código anterior después de editar perfiles nuevos requiere un plan de
reconciliación: partners ya no se sincroniza y no es una copia actual de users.

## Verificación

`npm run test:user-profile-migration:integration` prueba copia de perfiles con/sin
contacto, preservación de contactos/credenciales/enlaces, avance de revisión y alta
independiente en un esquema temporal que elimina al terminar.
`npm run test:core:integration` comprueba servicios de User, extensión en tabla
compañera, relaciones desde módulos, permisos, sesiones y concurrencia con Perfil.
`npm run test:legacy:integration` verifica autenticación y tema con un servidor y
base temporales. No ejecutar sus scripts internos contra la base del ERP.
Resultados concretos y limitaciones en docs/estado-proyecto.md.
