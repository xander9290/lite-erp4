# Pendiente: Fields.Image e integración con el scaffold

Estado: propuesto por el usuario para que otro agente lo retome. No implementado.
Origen: al recrear Fabricante surgió la necesidad de declarar logo como imagen y
evitar cambiar manualmente un FieldText por FieldImage después de generar vistas.

## Situación actual

- El ORM declarativo no tiene Fields.Image. Hoy puede almacenar la URL mediante
  Fields.Text({ label: "Logotipo", maxLength: 2048 }), pero Text no valida HTTPS
  automáticamente ni comunica al scaffold que debe usar un control de imagen.
- FieldImage ya existe en ui/form: recorte, subida y valor RHF string | null.
  Su prop upload es obligatoria y usa el contrato ImageUploader. Guarda la URL
  HTTPS devuelta por el proveedor, no File, blob, base64 ni binarios en Prisma.
- Hay adaptación Cloudinary y ejemplos RHF/Zod en /sample. Contratos vigentes en
  [FieldImage.md](../../src/components/ui/form/FieldImage.md), image.types.ts y
  src/lib/uploads/cloudinary.ts. Partner conserva su avatarUrl y validación común;
  no duplicar datos de contacto ni cambiar esos modelos por esta tarea.

## Dirección propuesta

Añadir una declaración como Fields.Image({ label: "Logotipo" }), manteniendo
Prisma String/String? con una longitud apropiada para URLs (referencia: 2048).
Definir los detalles finales de opciones/defaults antes de fijar el contrato.
Centralizar la validación de URL pública HTTPS en el esquema generado tanto de
servidor como de cliente, con null para el campo opcional vacío.

create:views debe reconocerla y generar FieldImage en lugar de FieldText. El
proveedor de subida debe configurarse explícitamente, con una API sencilla por
decidir; no inventar un upload ni asumir credenciales o almacenamiento disponible.
Reutilizar ImageUploader y proveedores existentes. Su firma incluye AbortSignal y
onProgress: no copiar sin más el patrón de Server Actions de --lookup ni serializar
funciones/secretos dentro de metadata, contratos cliente o defaults del modelo.

## Criterios de aceptación

1. Inferencia string | null / string según required, defaults y validación Zod
   consistentes en cliente y servidor. Rechazar http, data y blob como valor
   persistido. Validar una URL no garantiza el contenido de un archivo remoto;
   no añadir descargas de servidor para comprobarlo.
2. Mapeo Prisma de URL escalar sin almacenar binarios. Revisar todos los switches
   de campos en generadores, binding, listas, dominios, agrupación y actividad:
   no dejar que un kind nuevo caiga por error en Many2one u otra rama.
3. Scaffold con FieldImage, upload real configurado, autocomplete off y label
   inline alineado según las pautas. Error claro antes de escribir si falta la
   configuración necesaria; nunca simular una subida/guardado exitoso.
4. Ejemplo funcional en /sample con RHF, Zod y las reglas del nuevo campo;
   reutilizar el componente UI existente en src/components/ui/form. No usar login.
5. Pruebas de tipos, límites/URL/vacíos, generación de contratos y vistas, y
   compilación. Verificar permisos de subida/guardado e idempotencia de cancelación
   según los contratos existentes; no subir archivos reales para pruebas sin que
   el ejercicio lo requiera y esté autorizado.
6. Documentar sintaxis, proveedor, configuración, límites y retirada/reemplazo:
   quitar una URL del formulario no elimina automáticamente el archivo remoto.

No editar la aplicación de Flota, recrear Fabricante, convertir avatarUrl ni
ejecutar migraciones por adelantado. Mantener el ritmo de tutoría. Hoy la API
Fields.Image sigue siendo una propuesta: no presentarla como disponible.
