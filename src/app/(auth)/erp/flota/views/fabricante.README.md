# Fabricante

Modelo FlotaFabricante. Vistas: list, form. Formulario: page.

Los archivos TS/TSX son editables y no se regeneran automáticamente.
Ejecuta npm run orm:sync -- flota antes de abrir las rutas nuevas.
El servicio sigue siendo admin y revalida la sesión dentro de la transacción.
Añade dominios y nuevas vistas como código de aplicación; no repitas este comando sobre archivos personalizados.

Avatar usa Fields.Image con carpeta fabricantes. FabricanteForm conserva su
presentación avatar/squared e importa imageUploads.avatar del helper gestionado
`@/generated/orm/uploads/flota/FlotaFabricante.images`. orm:sync actualiza ese
helper al añadir o cambiar campos de imagen; no reescribe el formulario.
fabricante.list.ts muestra avatar con widget image, tamaño sm y forma squared.
La colección usa CardView con breadcrumbs compactos de Aplicaciones/Flota/Fabricante,
miniatura junto al nombre y acceso mediante el título de la tarjeta, sin pie de
apertura duplicado. La vista conserva búsqueda, creación y retorno a la colección.
La acción anterior signAvatarUpload conserva compatibilidad delegando en la
acción generada; no repite carpeta ni autorización. La subida necesita la
configuración privada de Cloudinary; [contrato](../../../../../../docs/ideas/campos-imagen.md).
