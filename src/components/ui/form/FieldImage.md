# FieldImage

Selecciona JPEG, PNG o WebP; permite recortar con ratón, táctil o teclado, elegir proporción, ancho y alto en píxeles, formato de salida y calidad. Las dimensiones conservan la proporción y no amplían el original. Se admite una imagen por Field.

```tsx
const upload = createCloudinaryImageUploader({
  cloudName: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ?? "",
  uploadPreset: process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET ?? "",
});

<FieldImage
  name="image"
  label="Imagen"
  upload={upload}
  widget="image" // Predeterminado: editor dentro del Field.
  shape="rounded" // Alternativa: "squared". No modifica el archivo exportado.
  maxSizeMB={10}
  // aspectRatio={1} // Opcional: recorte cuadrado fijo.
  onChange={(url) => console.log(url)}
/>
```

Importa el Field desde `@/components/ui/form/FieldImage` y el adaptador desde `@/lib/uploads/cloudinary`. Dentro de FormLayout/FormGroup se usa como cualquier otro Field. `direction="inline"`, label opcional, `disabled`, `readOnly` y `required` están soportados.

`shape` es independiente de `widget`: rounded conserva esquinas redondeadas en
image y círculo en avatar; squared usa esquinas rectas y guía de recorte
rectangular. Sin shape se conserva la presentación anterior. `style` continúa
aceptando estilos CSS del contenedor. Las demos permiten alternar ambas formas
con RHF/Zod sin subir archivos ni modificar el valor del campo.

## Avatar

```tsx
<FieldImage
  name="avatar"
  label="Foto de perfil"
  widget="avatar"
  upload={upload}
  onChange={(url) => console.log(url)}
/>
```

`widget` admite `image` (por defecto) y `avatar`. Avatar usa una vista circular de DaisyUI (o rectangular con shape="squared") y lleva la lectura, recorte, dimensiones, formato, calidad, progreso y errores de subida a un modal nativo con estilos `modal`/`modal-box`. El recorte es cuadrado por defecto; puedes especificar otro `aspectRatio`. La guía circular y el avatar son visuales: el archivo exportado conserva el rectángulo del recorte, sin descartar sus esquinas.

El avatar es el botón para seleccionar o cambiar la imagen; funciona con clic, Enter o Espacio. Una cámara aparece al pasar el cursor o enfocarlo con teclado. Cuando hay una imagen, la papelera permite quitarla sin abrir el selector y devuelve `null`. Los botones de texto y la caja de selección se reservan para `widget="image"`; el avatar ocupa aproximadamente 104 × 104 px, más su label opcional.

Escape, el fondo y los botones de cancelar cierran el modal, abortan la operación y conservan el valor anterior. Al terminar o cerrar, el foco vuelve al selector. Mientras está abierto, el fondo queda inactivo y el teclado permanece dentro del diálogo. No se crean formularios anidados. El ejemplo de avatar tiene su propio formulario y validación Zod en `/sample#field-image-avatar`.

El valor de React Hook Form es `string | null`. `onChange` se ejecuta después de una subida exitosa y recibe la URL pública HTTPS; al quitar la imagen recibe `null`. La selección, el recorte, cancelar o una subida fallida no cambian el valor. Las URLs blob solo existen para el editor local y se liberan al terminar. FormLayout impide enviar un Field con edición o subida pendiente, incluso si contiene una URL anterior válida.

El ejemplo completo y el esquema Zod están en `/sample`. Separa `z.input` (permite null mientras está vacío) y `z.output` (URL validada) en `useForm<Input, unknown, Output>`.

## Cloudinary

Para modelos con `Fields.Image({folder:"..."})`, create:views conecta la subida
firmada predeterminada. Carpeta, autorización y credenciales se resuelven en el
servidor; el navegador usa createSignedCloudinaryImageUploader con la acción
generada. Configuración y contrato en [Campos de imagen](../../../../docs/ideas/campos-imagen.md).
orm:sync actualiza los uploaders aunque el Image se añada después de crear las
vistas. En una vista personalizada basta importar imageUploads del archivo
`@/generated/orm/uploads/<app>/<Modelo>.images` y pasar `upload={imageUploads.campo}`.
Las demos de /sample usan esta ruta: subir requiere administrador; los modelos
de muestra no se instalan ni guardan registros en la base.

El adaptador unsigned anterior sigue disponible para consumidores como Partner.
Para usarlo, configura en `.env.local` y reinicia el servidor:

```env
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=tu_cloud_name
NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET=tu_preset_unsigned
```

El preset debe ser unsigned. Estos valores son públicos; el adaptador no necesita API Secret. Configura los formatos, tamaños y carpeta permitidos en el preset de tu cuenta. El adaptador usa POST multipart a `/image/upload` y devuelve `secure_url`.

Para una subida firmada o un proveedor diferente, pasa tu propia función `upload(file, {signal, onProgress}): Promise<string>`. Debe respetar AbortSignal, reportar progreso entre 0 y 100 y devolver la URL HTTPS del archivo almacenado. El componente descarta respuestas tardías tras cancelar, restablecer, reemplazar o desmontarse.

Quitar o reemplazar una imagen no borra archivos remotos; esa gestión corresponde al backend. El cliente limita el original a 40 megapíxeles y exporta como máximo 4096 píxeles por lado. El tamaño máximo en MB se verifica tanto antes de editar como antes de subir.

Referencias: [React Image Crop](https://github.com/dominictobias/react-image-crop), [Cloudinary Upload API](https://cloudinary.com/documentation/image_upload_api_reference).
