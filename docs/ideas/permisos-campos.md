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

### Implementado (2026-11-26)

Aprobado por el usuario con catálogo en el manifest (A) y alcance por pantalla y
presentación (B). Código: `src/lib/modules/pages.ts` (compilePages, hiddenPagesFor),
`pages` en define.ts/compose.ts (también en extensiones), `AccessPageHidden` en
access-control.prisma con la migración `20261126120000_group_page_visibility`
(**no aplicada**), `src/lib/access/page-policy.server.ts` + readAccessCapabilities
(`hiddenPages`), `config.hiddenPages = { declared, form, modal }` en modelClientConfig
(pantalla default) y ModelRoute (pantalla presentada), `NotebookPolicyContext` desde
ModelForm, Notebook (sin pestaña, panel montado como deshabilitado, fallback a la
primera visible, sin marco si todas ocultas, aviso genérico ante errores ocultos,
avisos de consola en desarrollo) y FormView (no enfoca campos de páginas
deshabilitadas/ocultas). Grupos: `groupDetail().pages`, `setPageVisibility` y la
pestaña «Páginas». Directorio declara `pages.additionalInfo` de Partner.

Diferencias con el plan: no se detecta en desarrollo un notebook del catálogo que
ningún formulario monte (sólo desajustes de páginas en un Notebook montado, como
console.warn). El aviso de errores ocultos lo pinta el Notebook, no FormView.

Importante: hasta aplicar la migración, la consulta de páginas ocultas falla para
usuarios no administradores (capacidades por petición) y al abrir un grupo en Ajustes.
Aplicarla requiere aprobación del usuario (`npm run db:deploy` o el flujo orm:sync).

### Plan de implementación (2026-11-26, aprobado; ver «Implementado»)

Precedentes que se reutilizan: `AccessMenuHidden` + `setMenuVisibility` (ocultar
por grupo sólo como presentación), `loadElementPolicies` (acumulación positiva por
grupos implicados, sólo grupos del módulo dueño, bypass de admin), `groupDetail`
(catálogo desde el registro, nunca desde el navegador) y `config.fieldAccess`
(política proyectada por actor en ModelClientConfig). Hoy Notebook ya monta todas
las páginas y oculta las inactivas con `hidden` + `inert`; `id` es opcional (si
falta usa `useId`, no estable) y ya sirve de ancla de inserciones.

**1. Catálogo declarado en el manifest (decisión A).** Las páginas viven en TSX
de cliente y el servidor no puede leerlas. Propuesta: el modelo declara sus
páginas ocultables, con el id del Notebook y el name de cada página:

```ts
partner: {
  // ...
  pages: {
    additionalInfo: { otherAddresses: "Otras direcciones", sales: "Ventas", purchase: "Compras", otherInfo: "Otra información" },
  },
}
```

- Compilación: ids/names con el mismo patrón que los IDs de pantalla, etiquetas no
  vacías, límites (p. ej. 8 notebooks × 20 páginas). Sólo lo declarado se puede
  ocultar; lo no declarado se comporta como hoy.
- Comprobación en desarrollo: si un Notebook con `id` de un formulario de modelo
  pinta una página declarada que no existe, o el catálogo nombra un notebook que
  ningún formulario monta, `console.error` como las inserciones. No falla en
  producción.
- Extensiones: `extends["x.modelo"].pages` añade páginas al catálogo del modelo
  base (insertadas con `notebook:<id>`); colisión de name → error al componer.
- Alternativa B (no recomendada para la primera versión): extraer el catálogo del
  TSX con el compilador de TypeScript durante `orm:generate`, sólo con literales.
  Evita duplicar, pero añade un analizador frágil y archivos generados que caducan.

**2. Alcance de la regla (decisión B).** Fila = grupo + modelo + pantalla + layout
(form/modal) + notebook + página, como pide el pendiente. Ajustes lista, por cada
pantalla × layout del modelo, el catálogo completo. Alternativa más simple:
grupo + modelo + notebook + página (misma vista en todas las pantallas/modales).

**3. Almacenamiento.** Tabla nueva `access_page_hidden` (`AccessPageHidden`) con
PK compuesta de los campos del alcance, igual a `access_menu_hidden`. Migración
vacía, sin datos de negocio; aplicarla requiere aprobación. Filas cuyo catálogo
desaparece se ignoran al proyectar y se pueden limpiar desde Grupos.

**4. Servidor.**
- `loadElementPolicies` carga también las páginas ocultas (mismo filtro de módulo
  dueño); `ElementPolicies.hiddenPages[model]` como claves de alcance.
- `projectElementAccess` / `modelClientConfig` proyectan para la pantalla y layout
  pedidos `config.hiddenPages: readonly string[]` (`"<notebook>/<page>"`),
  filtrado contra el catálogo compuesto. Admin → vacío. También en form-open
  (modales) y en el formulario de página de ModelRoute.
- Admin: `groupDetail` añade `pages` (modelo · pantalla · layout · notebook ·
  página, etiqueta, hidden) y `setPageVisibility(groupId, changes)` valida cada
  cambio contra el catálogo y sólo toca las filas enviadas (≤1000, Serializable),
  como `setMenuVisibility`.

**5. Cliente.**
- ModelForm provee un contexto `FormPagePolicy` con `hiddenPages`; Notebook con
  `id` lo lee. Una página oculta: sin pestaña, panel montado pero siempre
  `hidden` + `inert` y nunca activable (clic, teclado, `defaultPage`,
  `activePage` ni el evento de revelar errores). Conserva valores RHF, borradores
  y validación Zod/servidor; la protección de datos sigue siendo de fieldAccess.
- Selección: si la página activa o `defaultPage` está oculta, la primera visible
  y habilitada. Todas ocultas: no se pinta el Notebook (sin tablist vacío).
- Errores en una página oculta: FormView no intenta enfocarlos; muestra un aviso
  genérico «Hay datos que no puedes revisar en este formulario; contacta a un
  administrador» sin nombrar la página ni los campos. No se relaja la validación.
- Notebook sin `id` o fuera de ModelForm: sin cambios.

**6. Ajustes → Grupos.** Sección «Páginas» junto a Campos/Acciones con la misma
UI de casillas («Ocultar»), agrupada por modelo · pantalla · formulario/modal.

**7. Directorio.** Declarar `pages.additionalInfo` de Partner (PartnerForm ya usa
`id="additionalInfo"`). UserForm (`userNotebook`, core) queda fuera: core no tiene
grupos de módulo y las reglas sólo aplican a modelos del módulo del grupo.

**8. Pruebas y verificación.**
- Unitarias: compilación del catálogo (patrones, duplicados, extensiones,
  límites), acumulación por grupos implicados, módulo ajeno ignorado, bypass de
  admin, proyección por pantalla/layout, `setPageVisibility` rechaza páginas fuera
  del catálogo y no toca otras filas.
- Componente (render en servidor/DOM): pestaña omitida, activa por defecto oculta
  → primera visible, todas ocultas → sin Notebook, valores conservados al guardar,
  error en página oculta → aviso genérico sin revelar.
- Integración PostgreSQL en esquema temporal: migración y políticas.
- Regresión: test:access, test:form-model, test:form-navigation, test:modules,
  test:views; TypeScript y ESLint. Navegador en Directorio con un grupo de prueba
  que el usuario asigne (Claude no crea asignaciones reales sin pedirlo).

Fuera de alcance: ocultar FormGroup/Stack u otros contenedores, ocultar por
condición del registro, required por grupo y vistas manuales fuera de ModelForm.
Decisiones pendientes del usuario: A (catálogo en manifest o extraído del TSX) y
B (alcance con pantalla/layout o sólo modelo).

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
