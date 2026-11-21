# Permisos por campo y presentación por grupo

Pendiente solicitado y ampliado el 2026-11-14. El usuario confirmó mantenerlo como
pendiente de diseño; esta nota no autoriza implementación ni cambios en Flota.

Actualización del 2026-11-20: forma parte del siguiente pendiente de
[Grupos y separación de entrada/consulta relacional](access-manager.md).
Se mantienen grupos declarados en manifests y varios grupos por usuario,
asignables mediante tags. Las excepciones de campos/acciones omitidas conservan
el comportamiento normal del modelo; la composición entre grupos y su contrato
final siguen pendientes. La decisión de un solo grupo por usuario fue descartada.

## Objetivo y alcance

Ampliar el sistema actual de grupos, permisos por modelo y reglas de registro
para admitir restricciones de lectura/escritura por campo y condiciones de
interfaz por grupo: invisible, readOnly, required y visibilidad de NotebookPage.
La futura administración se haría desde el módulo de **Accesos**, incluyendo
presentaciones disponibles (Lista/Card/Kanban), Fields de formularios y columnas
de colecciones. El núcleo compartido consumiría las capacidades una vez para
evitar condiciones y consultas de permisos repetidas en cada presentación.
Buscar una declaración coherente con Fields/modelos y manifest, conservando TSX
personalizable. La sintaxis y la distribución exacta de responsabilidades están
por diseñar; no hay una API nueva disponible.

Distinguir permisos sobre datos de presentación: ocultar un Field o una pestaña
no impide leer su payload ni escribirlo desde una petición. El invisible actual
conserva valores y validación. La obligatoriedad de negocio debe comprobarse en
el servidor, sin que una prop de UI relaje constraints o reglas del modelo.

## Diseño pendiente y criterios de aceptación

- Separar en Accesos las políticas de datos (leer/escribir un campo) de las de
  presentación (vistas disponibles, campos/columnas visibles y sólo lectura).
  La habilitación visual de una vista no concede acceso a los datos del modelo.
  Definir cómo se guardan/configuran reglas por grupo y se combinan con Fields,
  manifest y personalizaciones TSX; no hay sintaxis ni interfaz decididas todavía.
- Extender la [proyección de capacidades por modelo ya implementada](../capacidades-modelos.md)
  a los contratos de campos/presentación que se acuerden. Menús, Nuevo/Eliminar,
  formularios y colecciones ya comparten CRUD por actor; no duplicar ese motor
  ni crear cachés privadas compartidas entre usuarios.
- Respetar esta precedencia: invisible=false puede anular ocultación por diseño,
  pero no un permiso de lectura denegado; readOnly=false tampoco puede conceder
  escritura. Campos sin lectura no llegan al navegador ni a renderCard/renderCell.
- Definir composición de grupos, herencia, overrides, superusuario y políticas
  por defecto, preservando los contratos actuales cuando no se declaren opciones.
- Revalidar permisos por campo junto con sesión, modelo y reglas de registro en
  las transacciones. No enviar valores sin lectura ni aceptar cambios sin
  escritura, incluyendo peticiones construidas fuera de la UI.
- Diseñar contratos parciales, defaults y esquemas de guardado: omitir un campo
  restringido no debe borrarlo ni causar una escritura involuntaria. Resolver
  creación y required sin generar formularios imposibles de guardar ni relajar
  restricciones SQL; no prometer que bastará con modificar componentes.
- Revisar todos los canales de salida/entrada: formularios, colecciones,
  búsqueda/filtros/orden/grupos, lookups, displayName/título de pestaña, related,
  compute, reacciones, historial/notas y acciones del modelo. Las dependencias y
  resultados derivados no deben revelar datos restringidos. Definir explícitamente
  cómo operan hooks y acciones autorizadas sobre campos no editables por el actor.
- Publicar al cliente sólo capacidades y metadatos autorizados para adaptar los
  Fields y NotebookPage. Conservar RHF/Zod, navegación, revisión, auditoría y vistas
  personalizadas; condiciones React siguen siendo presentación.
- Probar con cuentas/grupos de fixture lectura denegada, escritura falsificada,
  combinaciones de grupos, cambios de asignación, required, pestañas y borradores;
  incluir demo ficticia y documentación. No aplicar cambios a Flota por anticipación.

No se presupone una migración SQL de los modelos de negocio; evaluar durante el
diseño si hacen falta cambios en el almacenamiento de políticas u overrides.

Siguiente paso al retomar: diseñar un caso pequeño con ejemplos de declaración,
payload autorizado y guardado antes/después, y acordar el contrato antes de
implementar. Beneficio esperado: evitar condiciones/permisos duplicados entre
vistas y servidor sin ocultar los límites de autorización.

## Referencias

- [Control de accesos actual](../modulos-declarativos.md#5-control-de-accesos).
- [Estado y siguiente ejercicio](../estado-proyecto.md).
- [Plan de módulos declarativos](modulos-declarativos.md).
