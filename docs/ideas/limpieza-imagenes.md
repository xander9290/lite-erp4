# Retirada segura de imágenes

Diseño pendiente; no hay borrado remoto automático. Hoy sólo se persiste una URL
por Image. Falta un inventario de assets y referencias de todos los consumidores:
quitar una URL de un formulario no demuestra que el archivo esté sin uso.

Flujo previsto:

1. Registrar en servidor el identificador estable del asset/proveedor después de
   verificar la subida. No deducir public_id de URLs arbitrarias del cliente.
2. Mantener referencias explícitas, incluidos campos manuales de Partner. Tras el
   commit que retire la última referencia, marcar un candidato; nunca borrar
   dentro de beforeSave/afterSave ni al cancelar un formulario.
3. Aplicar un periodo de gracia, ofrecer inventario revisable con modo plan y
   revalidar propiedad/referencias antes de la retirada.
4. Borrar con permiso de servidor, credenciales privadas, reintentos idempotentes
   y registro de resultados. No prometer una transacción conjunta con Cloudinary.

Aceptación: probar archivos compartidos entre registros/modelos, guardados
simultáneos, cancelación, respuesta de subida perdida, archivo ya eliminado y
fallos/reintentos del proveedor. Nunca borrar assets externos o sin propiedad
demostrada. Usar proveedor simulado y esquema temporal primero. Esta fase necesita
un contrato de assets y posiblemente migraciones; queda fuera de la actual mejora
de miniaturas y generación de uploaders.
