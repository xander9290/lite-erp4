# Capacidades efectivas por modelo

## Cambio vigente: grupos por módulo (2026-11-21)

Máximo un grupo explícito por usuario/módulo, sin grupo implícito universal.
La lectura efectiva sola no abre aplicaciones: se necesita pertenencia explícita
al módulo dueño. Relaciones publicadas consultan ID/etiqueta con autorización del
origen y reglas del destino, sin entrada ni escritura del destino. Se aplica en
rutas/acciones y dentro de los servicios transaccionales. Detalles, excepciones
nativas y transición en [Grupos por módulo](ideas/access-manager.md).
Las verificaciones siguientes son históricas salvo el cierre del 2026-11-21 en
el estado del proyecto.

Importar/exportar (2026-11-20): concesiones independientes por grupo/modelo,
sin ampliar CRUD. `false`/omitido no concede; otro grupo puede conceder, con
overrides por pareja grupo/modelo. Sólo ListView ofrece estas acciones en modelos
con contrato `transfer`. Servidor exige además read y create/write según la fila.
[Contrato, migración y límites](importar-exportar-listas.md).

Implementado el 2026-11-14 para módulos declarativos, incluida Flota.
La ruta compartida entrega a las vistas `config.capabilities`: `read`, `create`,
`write`, `unlink` y `move`. Las vistas TSX mantienen su diseño y no necesitan
repetir consultas o condiciones de permisos.

## Proyección del servidor

`getCurrentAccessUser` revalida usuario activo, rol y sessionVersion dentro de una
transacción RepeatableRead. `readAccessCapabilities` reúne membresías, herencia y
overrides en lote: hasta tres consultas para usuarios normales y una para admin.
Reutiliza la composición del motor: permisos acumulados entre grupos; el override
sustituye la declaración del grupo correspondiente. Otro grupo puede conservar
una concesión. La memoización React es por petición; no se guardan capacidades
privadas en el registro estático ni en cachés de servicios entre usuarios.

Las reglas por registro siguen evaluándose dentro de cada operación del servidor.
La capacidad general no garantiza que cualquier registro pueda modificarse.
La consulta relacional tiene su autorización separada; los permisos por campo siguen pendientes.

## Comportamiento compartido

| Capacidad | Presentación |
| --- | --- |
| read | Colección/formulario y navegación cuando además existe grupo explícito del dueño. |
| create | Nuevo y apertura del formulario de creación. |
| write | Campos editables, Guardar/Revertir y acciones de negocio. |
| unlink | Eliminar en lista y formulario, independiente de write. |
| move | Movimiento Kanban si hay escritura y alguna transición disponible. |

La UI exige también lectura para crear, editar o eliminar. Sin lectura no monta
los proveedores. `create`, `canDelete` o `movable` de una presentación sólo pueden
restringir lo permitido. Los componentes compartidos deniegan capacidades cuando
falta la proyección; `modelClientConfig(id)` sin actor sigue siendo configuración
estática para herramientas, no autorización. La ruta usa la versión con actor.
Fuentes propias deben proporcionar una proyección del servidor; los ejemplos
locales declaran capacidades ficticias explícitas.

En registros existentes ModelForm usa write; durante creación usa create. Un usuario
con creación pero sin edición puede dar de alta y pasa a consulta después de guardar.
Los botones de negocio requieren write y sus grupos declarados. Sólo se publican
nombres/etiquetas permitidos y transiciones disponibles, sin transmitir grupos.
Un grafo filtrado a `[]` sigue vacío: no habilita movimientos genéricos.
Las reglas y transiciones de cada registro se comprueban nuevamente al ejecutar.

FormButton respeta la lista publicada y FormView rechaza ejecutar una acción no
publicada. FormHeader deshabilita sus controles en consulta, incluido el statebar.
Cambiar a consulta no descarta un borrador ni libera su protección de navegación.
La eliminación independiente usa `deletion.allowReadOnly: true` en ModelForm;
FormView manual conserva el comportamiento anterior salvo esa opción explícita.

## Navegación y actualización

Los menús declarativos identifican su modelo y usan lectura efectiva, incluidos
overrides y grupos heredados. Se ocultan grupos vacíos y aplicaciones sin modelos
legibles. La entrada raíz elige el primer modelo legible. Las aplicaciones manuales
conservan su contrato admin/authenticated/grupos cuando no declaran accessModels.
No se ocultan menús por listas vacías ni por reglas que limitan algunos registros.

Los cambios se reflejan al recargar o navegar con datos revalidados; no hay
suscripción en tiempo real. Las acciones de Accesos ya invalidan el layout de ERP.
Una pantalla anterior nunca autoriza una operación: guardar, eliminar, acciones,
lecturas y movimientos vuelven a comprobar sesión, permisos, revisión y reglas.

Las capacidades CRUD originales no requieren migraciones ni orm:sync.
La ampliación de [campos y acciones](ideas/permisos-campos.md) incorpora políticas
por actor y sí requiere su migración aditiva. El fallback cuando un registro
relacionado carece de lectura conserva su alcance independiente.

## Verificación

Demo RHF/Zod `/sample#model-capabilities`: Consulta, Operador, Responsable y
Eliminador simulados, sin modificar cuentas ni BD. Comprobados controles y statebar
bloqueados, acciones filtradas, eliminación independiente y borrador conservado.

144 pruebas aprobadas entre acceso, aplicaciones, módulos, formularios, navegación
y ORM; ESLint de afectados, TypeScript y build de producción aprobados. El build
conserva tres avisos previos de trazado filesystem del gestor de módulos.

```bash
npm run test:access
npm run test:capabilities:integration
```

La segunda usa proyecto, esquema PostgreSQL, usuarios y datos desechables; verifica
overrides/herencia, menús, sesión y rechazos de escrituras, acciones, movimientos
y borrados. Incluye la integración existente de servicios y TypeScript de rutas.
Limpia sus recursos al terminar. Omite exclusivamente la suite de retirada/purga
con respaldos; no sustituye la integración completa de lifecycle, que requiere
pg_dump/pg_restore. No modifica usuarios ni registros reales del ERP.
