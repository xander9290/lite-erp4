# Pendiente: ampliación de Accesos

Estado: siguiente pendiente acordado el 2026-11-20. Diseño por concretar; esta
anotación no autoriza implementación, SQL ni cambios de permisos o asignaciones.

## Dirección acordada el 2026-11-20

- Mantener grupos y permisos predeterminados en los manifests de cada módulo.
  No retirar ese contrato ni trasladar toda la definición de seguridad a BD.
- Ajustes → Grupos detectaría los grupos del registro de manifests, indicando
  módulo de origen. Aprovechar la gestión actual de Accesos; no duplicar grupos
  ni crear otra fuente de identidad.
- Asignar usuarios existentes mediante etiquetas en cada grupo. Un usuario puede
  pertenecer a varios grupos para desempeñar varios roles. La propuesta de un
  único grupo por usuario/Many2one se descartó expresamente.
- Las configuraciones por campo/acción son excepciones: los elementos omitidos
  conservan la implementación del modelo y los permisos generales vigentes.
- Separar entrada directa a aplicaciones/pantallas de la consulta autorizada de
  modelos relacionados. Sin entrada directa: sin tarjeta en el cajón ni acceso
  mediante URL. Esto no implica denegar un catálogo que otra aplicación necesita
  consultar mediante una relación, siempre con autorización explícita.

Caso de aceptación: un usuario entra a Contactos y selecciona País/Estado/Municipio,
pero no ve Ubicaciones en el cajón, no abre sus rutas directas ni modifica sus
catálogos. La consulta relacional debe conservar permisos de lectura/reglas y
publicación mínima; ocultar una aplicación no concede acceso a todos sus datos.
La entrada directa tampoco debe obtenerse sólo por tener lectura relacional.

## Interfaz propuesta, pendiente de contrato

Formulario del grupo con nombre y estado activo (resolver origen y significado del
estado sin contradecir el manifest), usuarios mediante tags y Notebook:

- Modelos: conservar CRUD/import/export y reglas de registro existentes.
- Campos: modelo, campo, no leer, no escribir e invisible. No leer debe impedir
  entregar datos desde servidor; no escribir debe impedir mutaciones. Invisible
  es presentación y no sustituye permisos. Estudiar implicación no leer→no escribir.
- Acciones de modelo: modelo, acción y restricción. Propuesta: «Bloquear» deniega
  ejecución y oculta el botón; no confundir con ocultación exclusivamente visual.
  Mantener condiciones de @action, permisos del modelo y reglas de registro.
- Aplicaciones: configuración de entrada directa y visibilidad, coherente con
  modelos compartidos. Ocultar una tarjeta por sí solo no bloquea rutas/servicios.

Modelo/campo/acción se seleccionarían desde sus declaraciones registradas. La
forma final de las tablas, el nombre Grupos frente a Accesos y la sintaxis de
excepciones en manifest/BD siguen por diseñar. No hay API nueva implementada.

## Siguiente paso y criterios de aceptación

1. Diseñar el contrato de entrada directa frente a lectura relacional con el caso
   Contactos/Ubicaciones, cubriendo rutas de lista/registro y endpoints de servidor:
   no basta esconder tarjetas o enlaces ni confiar en una intención del cliente.
2. Definir precedencia manifest/overrides, valores omitidos y combinación de varios
   grupos. La propuesta anterior de que «false siempre gana» NO se acordó; no
   adoptarla como decisión. Mantener explícitos grupos implícitos/heredados y
   protección del administrador, sin ampliar privilegios al migrar configuraciones.
3. Concretar restricciones de campos y acciones conforme al
   [pendiente de permisos por campo](permisos-campos.md), preservando valores
   omitidos, constraints, concurrencia, auditoría y personalizaciones.
4. Acordar fases y comprobaciones con casos pequeños antes de implementar.

Aceptación: varios roles por usuario; asignación por tags sin cuentas nuevas;
grupos detectados sin duplicación; permisos omitidos compatibles; lectura de
relaciones mínima y autorizada sin entrada directa; URL/peticiones falsificadas
denegadas; bloqueo real de campos/acciones; revocaciones efectivas y sin fugas en
listas, búsquedas, lookups, exportaciones, historial y salidas derivadas.

Oportunidad de simplificación: resolver pertenencia y capacidades una vez por
petición y compartirlas entre navegación, campos y servicios. Aceptación: sin
consultas/condiciones duplicadas por vista ni cachés privadas entre usuarios,
con revalidación transaccional y semánticas de entrada/lectura claramente separadas.

## Antecedente: reversión del 2026-11-16

Se retiraron las implementaciones recientes del catálogo de modelos/Fields y la
visibilidad de menús por grupo. El usuario quiere revisar su funcionamiento y
metodología antes de retomarlas. Sus fuentes anteriores se conservan en Git;
no se consideran un contrato vigente ni deben reactivarse por anticipación.

Se mantiene el Accesos básico: grupos declarados en los módulos, asignación de
miembros, ajustes CRUD y activación de reglas de registro. También se conserva el
ORM y la protección de las líneas One2many según el acceso a su padre.

## Alcance futuro por diseñar

- Catálogo administrativo de modelos y Fields desde sus declaraciones en código.
- Visibilidad de aplicaciones, menús y vistas por grupo.
- Campos ocultos, de sólo lectura y obligatorios; autorización de lectura/escritura
  en servidor, con contratos parciales y dependencias relacionadas/calculadas.
- Composición de varios grupos, herencia, alcance por registro y excepciones de
  administrador, con ejemplos pequeños que el usuario pueda comprobar.
- Edición de políticas, concurrencia, migraciones y reversión documentadas.

Antes de implementar, acordar ejemplos concretos de qué debe ver y poder hacer
cada perfil. Mostrar u ocultar elementos no debe sustituir la autorización de
operaciones ni exponer datos que el servidor deba proteger.

## Reversión

No borrar ni editar la migración ya aplicada que creó access_menu_hidden. Una
migración posterior, 20261117013335_revert_menu_visibility, retira esa tabla.
Respaldar sus filas antes de aplicarla en una base existente. No modificar las
tablas anteriores de usuarios, miembros, overrides CRUD o reglas.

La reversión de desarrollo se aplicó el 2026-11-16 (fecha local): tabla vacía,
respaldo privado en .environment-backups, migraciones anteriores conservadas.
La migración de retirada permanece versionada para otros entornos; no se aplicó
en producción. Los grupos, miembros y reglas previos se conservaron.
