# Campos de imagen

Implementado el 2026-11-11. Esta guía conserva su ubicación histórica; la
propuesta de Fields.Image ya forma parte del framework.

## Declaración y persistencia

```ts
logo = Fields.Image({
  label: "Logotipo",
  folder: "fabricantes/logos",
  required: false,
  tracking: true,
});
```

La API se llama `Fields.Image`, igual que Fields.Text. Requiere folder explícito;
admite segmentos de letras ASCII, números, guiones y guiones bajos, separados por
una barra, hasta 200 caracteres. Rechaza rutas vacías, puntos, barras dobles y
opciones desconocidas. No admite credenciales, callbacks ni proveedores dentro
de metadata. Cloudinary es el proveedor predeterminado de las vistas generadas.

El valor de entrada es string | null; el resultado es string con required=true,
o string | null si es opcional. Vacío/espacios pasan a null. Se aceptan URLs HTTPS
sin credenciales, de hasta 2048 caracteres; maxLength permite un límite menor.
Los defaults explícitos se validan; un campo sin default inicia en null, incluso
si es obligatorio, para que pueda completarse desde el formulario. Las fábricas
de defaults mantienen la limitación del generador: no son serializables.

Prisma almacena String/String? con VarChar(maxLength), sin binarios ni otra
relación. Contratos de cliente/servidor reutilizan la misma declaración y Zod.
La URL no prueba que exista una imagen ni que pertenezca al usuario o carpeta:
no se descarga contenido remoto ni se impone procedencia del proveedor al guardar.
Si una aplicación lo requiere, debe validar esa propiedad en su servicio.

## Vistas y subida

orm:generate y orm:sync generan el uploader y su Server Action en
`src/generated/orm/uploads/<app>/<Modelo>.images.ts` y `.images.actions.ts`.
La acción fija campos Image publicados no sensibles y autoriza cada solicitud.
create:app prepara los archivos iniciales y create:views importa el helper en
formularios nuevos. Al añadir otro Image, publicarlo en clientFields y ejecutar
sync actualiza el mismo helper, sin reescribir vistas personalizadas.

```tsx
import { imageUploads } from "@/generated/orm/uploads/flota/FlotaFabricante.images";

<FieldImage name="avatar" widget="avatar" shape="squared" upload={imageUploads.avatar} />
```

Los helpers usan manifiesto/hashes gestionados: no editarlos a mano. --plan
muestra cambios sin BD/escrituras y orm:generate --check incluye su integridad.
Si se retira el último Image, los helpers se conservan con mapas vacíos y dejan
de firmar ese campo. Las retiradas de modelos/archivos requieren revisión manual.
No hay atomicidad global entre carpetas de artefactos ante fallos/interrupciones.

Para servicios custom permanecen createModelImageSigner en
`@/lib/uploads/model-image.server` y createSignedCloudinaryImageUploader en
`@/lib/uploads/cloudinary`, con autorización explícita. FieldImage conserva
upload: ImageUploader para proveedores propios. No importa la clase en el cliente.

El scaffold conserva su autorización admin: requireAdmin valida sesión, cuenta
activa y permisos antes de firmar. El helper vuelve a ejecutar authorize en cada
llamada; sólo firma campos Image publicados y no sensibles. No recibe carpeta ni
modelo desde el navegador. La firma fija formatos jpg/png/webp, carpeta e ID
aleatorio sin sobrescritura. Su resultado contiene parámetros públicos, nunca
API Secret. Una firma es una capacidad temporal del proveedor, no una transacción
de guardado del registro ni una autorización de lectura de archivos privados.

Configurar en el servidor y reiniciar:

```env
CLOUDINARY_CLOUD_NAME=tu_cloud_name
CLOUDINARY_API_KEY=tu_api_key
CLOUDINARY_API_SECRET=tu_api_secret
CLOUDINARY_FOLDER_MODE=dynamic
# Opcional: preset firmado con límites del proveedor.
CLOUDINARY_SIGNED_UPLOAD_PRESET=imagenes_firmadas
```

cloud name admite fallback a NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME. Nunca prefijar
API_SECRET con NEXT_PUBLIC. No se necesita preset unsigned para esta ruta.
dynamic es predeterminado y envía asset_folder; fixed envía folder para cuentas
antiguas. La firma SHA-256 usa los parámetros exactos de cada petición.
Referencias: [firmas](https://cloudinary.com/documentation/authentication_signatures),
[modos de carpeta](https://cloudinary.com/documentation/folder_modes).

La generación valida la carpeta sin necesitar secretos o conexión a Cloudinary;
si faltan credenciales al subir, devuelve un error explícito, sin fingir éxito.
Los uploaders unsigned existentes de Partner conservan su contrato y configuración.
La configuración privada se centraliza en lib/uploads/config.server.ts y los
defaults públicos en lib/uploads/config.ts (10 MB, WebP, calidad 0.85), compartidos
por FieldImage y uploader. La vista puede imponer límites menores. Para límites
contra clientes modificados, usar el preset firmado opcional y la política del
proveedor o un servicio propio: la validación UI no sustituye esa política.
El preset se incluye en la firma y nunca se toma del navegador.

Quitar/reemplazar una URL no borra el archivo remoto. Una subida puede completarse
aunque el usuario cancele el guardado del formulario o se pierda la respuesta;
no se promete limpieza automática ni rollback de Cloudinary.
Contrato pendiente de inventario/referencias para retiradas seguras:
[Limpieza de imágenes](limpieza-imagenes.md).

## Presentación, listas y ejemplos

FieldImage añade shape="rounded" | "squared", independiente de widget y del
style CSS nativo. Rounded conserva esquinas redondeadas en image y círculo en
avatar; squared usa esquinas rectas y guía rectangular. El recorte exportado
siempre es rectangular; shape no altera el archivo. Avatar sigue recortando 1:1
por defecto. Ver [FieldImage](../../src/components/ui/form/FieldImage.md).

El scaffold genera columnas widget image. ListView y su vista rápida muestran
miniaturas; CardView y KanbanView usan la primera columna Image en la cabecera de
su tarjeta por defecto. renderCard personalizado mantiene su propia presentación.

```ts
{ field: "avatar", label: "Imagen", type: "text", widget: "image",
  imageSize: "sm", imageShape: "squared", sortable: false, filterable: false }
```

imageSize admite sm/md/lg (32/48/96 px) y imageShape rounded/squared. La miniatura
valida HTTPS sin credenciales, carga en el navegador con lazy loading y
referrerPolicy=no-referrer, y muestra fallback accesible si falta o falla. No hay
proxy del servidor ni enlaces externos implícitos. createModelService sólo admite
el widget para un Image declarado no sensible en sus columnas de servidor;
rechaza tipos/rutas/opciones ajenos. Legacy conserva su whitelist/widget partner.

No se incorpora Image a búsqueda libre ni se elige como displayName. Filtros,
orden y agrupación siguen operando sobre la URL escalar y conservan los límites
de lista existentes. Los dominios admiten igualdad, pertenencia y null, sin
operadores de búsqueda textual para Image. Tracking
guarda diferencias de URL con kind image sólo cuando se declara tracking=true;
sensitive sigue siendo incompatible con tracking.

Ejemplos reales RHF/Zod en `/sample#field-image` y `#field-image-avatar`: usan
Fields.Image y un modelo ficticio no instalado. Puedes probar editor/formas sin
subir; confirmar subida requiere administrador y configuración del servidor.
Las pruebas de transporte simulan Cloudinary: no suben archivos reales.
`/sample#image-collections` cubre las tres colecciones con imagen válida, ausente
y fallida, formas alternables y datos ficticios sin persistencia.
