# Restricciones de campos y acciones por grupo

Implementación del 2026-11-21. Código y migración preparados; comprobar en
[Estado del proyecto](../estado-proyecto.md) si el SQL está aplicado en esta máquina.
Contrato de pertenencia y entrada en [Grupos por módulo](access-manager.md).

## Configuración

Ajustes → Grupos → grupo muestra Modelos, Campos, Acciones y Reglas de registro.
Campos y acciones proceden del registro compuesto de modelos del módulo dueño;
no se aceptan nombres arbitrarios ni elementos de otro módulo. Los permisos base
CRUD/import/export y los grupos continúan en los manifests. Las excepciones nuevas
se guardan en AccessFieldRestriction y AccessActionRestriction; no hay nueva sintaxis
field/action en el manifest. Sólo un administrador activo puede administrarlas.

| Restricción | Efecto |
| --- | --- |
| No leer | Omite el valor de las respuestas y del formulario. Implica no escribir. |
| No escribir | Rechaza cambios del cliente; admite el valor actual sin modificarlo. |
| Invisible | Oculta el control/columna estándar; conserva valor y validación. |
| Sólo lectura | Bloquea el control estándar. No sustituye No escribir en servidor. |
| Acción bloqueada | Oculta el botón y deniega el método y su transición Kanban. |

Sin marcar conserva las condiciones habituales; no concede permisos. Se acumulan
las restricciones positivas del grupo efectivo y sus grupos implicados; desmarcar
no cancela una restricción heredada. El administrador conserva bypass. Una opción
TSX como invisible=false o readOnly=false no anula una restricción del grupo.
Eliminar todas las marcas retira únicamente esa fila de política. No se borran
miembros, overrides, reglas ni políticas no incluidas en la petición.

## Lectura, edición y derivados

El servicio revalida sesión, permisos y políticas en cada transacción, sin caché
por usuario compartida. Las respuestas de lectura, guardado, listas y acciones
eliminan propiedades sin lectura, también en líneas anidadas. ID y revisión siguen
siendo metadatos. El contrato cliente excluye esos campos de defaults/RHF/Zod;
no publica su default literal. Los tipos estáticos del modelo describen su esquema
completo; el DTO efectivo puede omitir propiedades por actor.

Al editar, los valores protegidos se recuperan del snapshot autorizado, antes de
normalizar, validar y ejecutar hooks. Un valor enviado para No leer se rechaza,
incluso si coincide: no se ofrece un oráculo para adivinarlo. No escribir admite
el valor actual o su omisión. Al crear se usa el default del servidor; si un campo
required protegido no tiene un default válido, la creación falla. No se relaja
la validación de negocio. Las líneas conservan sus identidades, revisiones,
propiedad y relación inversa controlada por servidor.

No leer excluye búsqueda, filtros, orden y agrupación sobre el campo. Un orden
predeterminado restringido usa ID; un orden explícito restringido se rechaza.
DisplayName y etiquetas lookup usan ID si dependen de un campo sin lectura.
Related y compute siguen sus dependencias declaradas; los resultados no legibles
no se publican. Las reacciones con entradas, lecturas o previews no legibles no
se ejecutan. También se comprueban relaciones, dominios del borrador, creación
rápida, firma de imágenes y colecciones hijas. Invisible no protege datos enviados.

El historial elimina cambios de campos sin lectura y protege el autor cuando sus
dependencias no son legibles. No reescribe eventos almacenados ni analiza texto
libre de notas. Los hooks y constraints mantienen el snapshot completo y operan
como lógica confiable del servidor; los errores de validación al guardar con
campos privados son genéricos para no revelar valores en mensajes.

## Límites explícitos

Las acciones actuales no declaran dependencias de lectura. Por seguridad, cualquier
campo efectivo sin lectura del documento, incluidas sus líneas, bloquea sus acciones y movimientos
Kanban, además de las acciones bloqueadas expresamente. No escribir impide cambiar
el estado mediante arrastre; un método de negocio autorizado sí puede modificar
campos no editables como lógica del servidor. No se añadió una API de dependencias
de acciones por anticipación.

Las transferencias son conservadoras: se deniegan si un modelo tocado por el
contrato (dueño, líneas o destinos de referencias) tiene campos sin lectura.
Importar también se deniega si el dueño o sus líneas tienen campos sin escritura.
No se exportan archivos parciales ni se eluden permisos al revisar/aplicar un plan.
La comprobación del servidor prevalece sobre botones de una pantalla anterior.

Este contrato se integra en los servicios y vistas declarativos estándar. Consultas
Prisma, proveedores y pantallas manuales deben adaptar explícitamente su contrato;
no se interceptan consultas arbitrarias ni se analizan los métodos del modelo.
Perfil propio conserva su servicio específico. No se configuran políticas reales
ni nuevos grupos para probarlo. Visibilidad de NotebookPage y restricciones por
presentación completa siguen pendientes. Required por grupo quedó fuera del
alcance el 2026-11-21; sólo reconsiderarlo ante un caso real. La obligatoriedad
del modelo se conserva.

## Siguiente pendiente: ocultar páginas por grupo (2026-11-25)

Solicitado como siguiente implementación por el usuario. Aún no implementado;
este guardado sólo registra el alcance y no modifica componentes, permisos,
esquema o datos. La restricción es de presentación, independiente de No leer y
No escribir sobre los campos y del acceso al modelo.

Identidad propuesta: usar NotebookPage.name como identificador estable de la
página, sin añadir un id obligatorio a cada NotebookPage. El name ya es único
dentro de su Notebook. Combinarlo con modelo, pantalla, layout form/modal y una
identidad estable del Notebook para distinguir páginas homónimas en formularios,
modales o pantallas distintas. label es sólo texto visible y puede cambiar sin
alterar la política. Renombrar name o el contenedor estable requiere revisar su
configuración; no persistir IDs efímeros generados por React/useId.

Configuración esperada: Ajustes → Grupos → modelo → formulario/pantalla → páginas
→ Ocultar. Concretar la forma del catálogo de páginas y su publicación desde
servidor al implementar: no aceptar nombres arbitrarios enviados por el cliente
ni asumir que el registro de Fields ya publica el JSX de las vistas.

Alcance y criterios de aceptación:

- Restricción efectiva por grupo y grupos implicados, siguiendo la acumulación
  positiva y el bypass de administrador de las políticas actuales. Ocultar no
  concede ni revoca permisos de datos; un componente no debe anular la política.
- Ocultar pestaña y panel; seleccionar la primera página visible/habilitada si la
  activa queda oculta. Resolver el Notebook sin páginas visibles sin controles
  vacíos, desbordamiento ni navegación por teclado hacia elementos ocultos.
- Conservar valores/borradores y validaciones del modelo. Ocultar una página no
  elimina required, constraints ni permisos de campos, y no debe borrar datos.
  Los errores en páginas ocultas deben tener una respuesta comprensible sin
  revelar la página contra la política ni relajar validaciones silenciosamente.
- Considerar layouts form/modal, varias pantallas, Notebook anidados y páginas
  añadidas por extensiones/inserciones; evitar colisiones por name repetido en
  contenedores distintos. Una vista fuera del contrato declarativo conserva su
  adaptación explícita, igual que las políticas de campos existentes.
- Definir catálogo/identidad del Notebook, almacenamiento y eventual migración
  al implementar. No ejecutar SQL ni configurar restricciones reales por este
  registro. Añadir pruebas con fixtures ficticios de aislamiento por alcance,
  herencia/admin, selección de pestaña y conservación de borradores.

Permisos por presentación completa, required por grupo y una nueva capa de
acciones de navegación conservan su alcance separado; no se incorporan por este
pendiente. El soporte actual de screens ya está implementado.

## Migración y comprobaciones

20261121220000_field_action_restrictions crea dos tablas vacías y sus claves
primarias compuestas; no cambia datos de negocio ni asignaciones. Generar Prisma
no aplica SQL. Aplicarla en una base existente requiere la aprobación del usuario.

Demo ficticia RHF/Zod: /sample#field-action-access. Pruebas de políticas,
administración, DTOs, inputs falsificados, defaults, dependencias y controles;
integraciones PostgreSQL en proyectos/esquemas temporales comprueban capacidades,
guardado parcial, acciones, líneas y transferencias. Evidencia y limitaciones
actuales en [Estado del proyecto](../estado-proyecto.md).

Oportunidad de simplificación: compartir una proyección de políticas por actor y
transacción para evitar lecturas repetidas en documentos grandes. Aceptación:
misma revalidación y aislamiento, sin cachés globales ni pérdida de revocaciones.
