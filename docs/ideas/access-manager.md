# Grupos por módulo

Contrato vigente desde 2026-11-21. Implementación autorizada por el usuario.
Reemplaza las propuestas del 2026-11-20 de pertenencia múltiple sin límite y la
propuesta intermedia de un único grupo global por puesto.

## Declaración y asignación

Cada módulo declara `groups`, `access` y `rules` en su manifest. Ajustes → Grupos
(ruta conservada `/erp/ajustes/accesos`) refleja esos grupos, su origen y permisos.
Los usuarios se agregan mediante etiquetas. No se crean grupos automáticamente
ni se inventan nuevos perfiles de negocio. Los overrides CRUD/import/export y
los estados de reglas existentes conservan su contrato; no se purgan por este cambio.

La pestaña Modelos muestra sólo los modelos del módulo dueño del grupo.
`setModelAccess` rechaza cualquier lote que incluya modelos de otro módulo antes
de escribir, incluso mezclados con modelos válidos. Abrir o guardar un grupo no
borra los overrides históricos ajenos; esta fase conserva las filas existentes.

Un usuario puede pertenecer a varios módulos, pero a un solo grupo explícito de
cada módulo. Para cambiarlo de grupo, quitarlo del anterior y asignarlo al nuevo.
El servidor comprueba todos los miembros antes de escribir, en Serializable;
una carrera se aborta o se rechaza, nunca combina ambos puestos. Al leer permisos,
asignaciones antiguas incompatibles también se rechazan. `implies` reutiliza
permisos y reglas; no crea pertenencias explícitas ni entrada a otros módulos.
El selector compartido de etiquetas admite hasta 100 usuarios seleccionados;
la acción conserva su límite previo de 1.000 miembros por petición.

Ejemplo para un módulo que ya tenga `pedido` (sólo documentación; no crea Ventas):

```ts
groups: { vendedor: "Vendedor", responsable: "Responsable" },
access: [
  { group: "vendedor", models: "pedido", perms: "cru" },
  { group: "responsable", models: "pedido", perms: "crud", export: true },
],
```

## Entrada directa y relaciones

Entrada directa exige grupo explícito del módulo dueño más el permiso efectivo
para la operación. Cajón, menús, rutas, metadatos y acciones de servidor comparten
esta separación. Tener un permiso por herencia u override de otro módulo no
concede entrada por sí solo. Sin snapshot de capacidades la presentación deniega.
Admin conserva bypass y Ajustes/core.user permanecen administrativos.
Contactos presenta core.partner: sus grupos se declaran en core, su dueño actual.
No se modifica el contrato de aplicaciones manuales sin modelos declarativos.
`drawer: false` sigue ocultando sólo la tarjeta, sin sustituir autorización.

Una relación Many2one/Many2many publicada permite consultar el destino desde el
modelo de origen autorizado, sin grupo del módulo destino. El servidor resuelve
el campo/destino desde el registro y entrega ID/etiqueta, no fichas completas.
Conserva reglas del destino, dominios de formulario y reglas recursivas del padre
One2many. Los filtros de listas usan la relación publicada sin un borrador de
formulario; los parámetros sólo usan destinos de acciones publicadas autorizadas.
El guardado revalida referencias; seleccionar no concede creación/edición/borrado
al destino. Quick-create requiere sus permisos directos habituales.

El alcance de lectura relacional es interno, ligado a actor, transacción y destino;
no puede usarse para escribir ni abrir el endpoint completo del catálogo. También
se reutiliza al resolver etiquetas, related/displayName, historial y las claves
externas declaradas de importación/exportación. Esas proyecciones mantienen sus
contratos y no publican campos sensibles por defecto.

## Inicio desde cero y límites

Retirados del código el grupo core.internal, su lectura automática de Partner y
las concesiones de Ubicaciones a ese grupo. El primer perfil nuevo acordado es
`ubicaciones.gestor`: CRUD sobre los cuatro catálogos e importar/exportar sobre
País/Estado/Municipio; sin usuarios asignados. Los
usuarios normales no obtienen entrada hasta declarar/asignar nuevos grupos; admin
puede seguir configurando. No hubo DDL ni borrado de asignaciones, overrides o
reglas de la base. IDs sin declaración se ignoran. Reutilizar un ID retirado exige
revisar sus asignaciones y ajustes guardados antes de volver a declararlo.

La unicidad por módulo se valida en servicios, con Serializable, sin una nueva
restricción SQL: escrituras Prisma/SQL directas deben respetar este contrato.
No se configura un grupo único en User ni se duplican identidades.

Campos y Acciones incorporan las excepciones por grupo descritas en
[Restricciones de campos y acciones](permisos-campos.md), con validación de datos
en servidor y migración aditiva propia. `invisible` sigue siendo presentación.
La visibilidad de pestañas y required por grupo permanecen pendientes.

Oportunidad de simplificación: compartir el contexto transaccional de entrada y
operación para reducir revalidaciones, manteniendo revocaciones y sin confiar en
una intención enviada por el cliente. No añadir cachés entre usuarios.

La evidencia de pruebas y las limitaciones actuales están en
[Estado del proyecto](../estado-proyecto.md).

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
