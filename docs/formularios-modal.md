# Formularios en modal

Implementado el 2026-11-22 para modelos declarativos. Un subcontacto es un
registro independiente: abre su formulario, con sus extensiones y reglas,
en un diálogo sobre el principal. Guardarlo conserva el borrador del principal.
No requiere SQL por sí mismo.

## Colecciones de consulta

Ejemplo conceptual para un modelo declarativo `DirectorioContacto` (Directorio
aún no está implementado), en su clase o extensión:

```ts
parentId = Fields.Many2one("DirectorioContacto", {
  label: "Contacto principal",
  onDelete: "Restrict",
  domain: d => d.neq("id", d.record.id),
});
childIds = Fields.One2many("DirectorioContacto", {
  label: "Subcontactos",
  inverse: "parentId",
  readonly: true,
});
```

En el formulario o archivo de inserciones:

```tsx
import { ModelChildCollections } from "@/components/modules/ModelForm";

<ModelChildCollections name="childIds" openIn="modal" />
```

`openIn` es `"page"` por defecto. Con `"modal"`, «Nuevo» y las filas abren el
formulario del hijo; la inversa recibe el ID persistido del principal como valor
inicial. El tipo de contacto mantiene su default del modelo: para una dirección de
entrega, elegir Entrega. Primero hay que guardar el principal.

La lista conserva consulta y paginación al refrescar tras un guardado confirmado.
La creación exige capacidad de crear e inversa Many2one publicada y editable.
El hijo exige sus propios permisos de entrada/lectura/escritura, reglas, validaciones
y revisión; el modal no concede acceso. La consulta exige además lectura del principal
y del campo de colección, y fija la inversa en servidor.

`readonly: true` describe una consulta, fuera de RHF y del guardado del principal.
Guardar el principal conserva los hijos omitidos. Las líneas editables
`Fields.One2many` siguen en tabla inline y aún no se admiten en extensiones.

## Reutilizar el modal

`ModelFormModal` se monta condicionalmente desde un componente cliente:

```tsx
{editing && <ModelFormModal
  config={config}
  id={editing.id}
  defaults={{ parentId }}
  onClose={() => setEditing(null)}
  onSaved={() => refreshCollection()}
/>}
```

`id` ausente crea; con ID carga mediante `modelRead` y `FormViewLoader`.
`defaults` sólo propone campos escalares públicos/editables al crear; no cambia
identidad, revisión, folios ni campos sensibles. El servidor valida todos los valores.
No se mezclan con los `default_*` de la URL del principal.

`ModelRoute` entrega como slots React las vistas del formulario y sus colecciones
publicadas. Los loaders del manifest permanecen en servidor. Un destino distinto
recibe sus propias vistas/inserciones; una autorrelación reutiliza el formulario
modal registrado (con fallback al formulario de página). Los contratos de hijos distintos conservan el límite previo de un nivel de
colecciones. Las vistas personalizadas deben delegar carga, identidad y guardado en
`ModelForm`; éste obtiene el ID de la presentación modal. No cargar registros ni
tomar decisiones de negocio usando el prop `id` por fuera de ese componente.

Fuera de `ModelRoute`, se puede pasar una vista como children:
`<ModelFormModal ...><MiFormulario config={config} /></ModelFormModal>`.
Sin slot ni children se usa el formulario automático. Los slots que necesite una
vista personalizada se componen en servidor como en `ModelRoute`.

Guardar con éxito invoca `onSaved(values)` y cierra. Una acción de modelo exitosa
también sigue ese callback. El modal no navega ni ejecuta `router.refresh`;
no incluye Nuevo ni eliminación. La recarga manual de un registro confirma sólo su
propio borrador. Un error conserva el formulario para corregir/reintentar; no hay
reintentos de escrituras automáticos.

## Cierre y formularios manuales

`FormDialog` ofrece diálogo nativo, portal, foco y `FormNavigationScope`.
Para un FormView manual, poner `<FormDialogLock />` dentro del FormView para
compartir el bloqueo de guardado/acciones con el cierre. `ModelForm` lo incluye.

Cerrar por botón, Escape o fondo pide confirmar si ese formulario tiene cambios.
Cancelar conserva valores; aceptar descarta sólo su borrador. Una salida de página
protege conjuntamente principal y modales. Durante el guardado/acción, el cierre
está bloqueado. El foco vuelve al activador si sigue montado y disponible.
Los formularios viven separados en el DOM; sus submits no se propagan al principal.

Demo pública RHF/Zod: `/sample#form-dialog`, sin escrituras de negocio. Permite
crear/editar, probar el rechazo ERROR, cancelar un cierre y comprobar que el contador
de guardados del principal permanece en cero al guardar el hijo.

## Vista modal independiente y eject

Implementado el 2026-11-22. `views.form` presenta la página; `views.modal` presenta
el mismo modelo en un diálogo. Si no hay modal, se conserva el formulario normal
(o ModelForm automático), con sus extensiones. No hace falta otra ruta ni servicio.

Para un modelo propio:

```bash
npm run eject:view -- ubicaciones pais modal --dry-run
npm run eject:view -- ubicaciones pais modal
```

Genera `views/PaisModal.tsx` y registra el loader en `models.pais.views.modal`.
Para un modelo que tu módulo ya extiende, usa el ID completo del destino:

```bash
npm run eject:view -- bibliotecaextra biblioteca.libro modal --dry-run
npm run eject:view -- bibliotecaextra biblioteca.libro modal
```

Este último ya se ejecutó en el proyecto. Archivo editable:
`src/modules/bibliotecaextra/views/BibliotecaLibroModal.tsx`. El registro queda en el
manifest del extensor, junto a las inserciones existentes:

```ts
extends: {
  "biblioteca.libro": {
    model: LibroExtra,
    views: { modal: () => import("./views/BibliotecaLibroModal") },
    insertions: {
      form: () => import("./views/LibroInsertions"),
      list: () => import("./views/LibroListInsertions"),
    },
  },
},
```

En una extensión, `views.form` sigue siendo un bloque dentro del formulario base;
`views.modal` es el formulario completo del destino. No se cambian archivos del
propietario. Entre overrides modales gana la extensión que depende de las demás,
incluyendo dependencias transitivas; si quedan candidatas sin dependencia entre
ellas, la composición rechaza el conflicto. Sin override se usa el modal del dueño.

El TSX generado contiene ModelForm y Fields existentes: reorganiza grupos, Stack o
Notebook sin copiar carga/guardado/diálogo. Incluye campos base publicados y los de
la extensión actual (si ya tiene insertions.modal, conserva allí sus controles);
ModelExtensions presenta los de otras extensiones. Su
`excludeFields` evita repetir controles ya maquetados: ajústalo si decides devolver
alguno al grupo automático. Los modelos propios usan `FormValues<typeof Clase>`;
los destinos extendidos usan `Record<string, unknown>` porque el descriptor de
extensión actual no publica un tipo compuesto de campos. La validación y política
de cada Field siguen derivándose del contrato autorizado del servidor.

Las líneas editables conservan FieldOne2many inline. Las relaciones de consulta
se generan con ModelChildCollections; el modal las abre a su vez en modal.
La página principal del modelo conserva su TSX e inserciones. No se han cambiado
defaults, permisos ni reglas del registro. Eject rechaza archivos/vistas existentes,
manifests ambiguos y enlaces simbólicos; no admite force ni aplica SQL.

### Inserciones del modal

`insertions.modal` usa los mismos destinos, posiciones y reglas que
[las inserciones del formulario](inserciones-vistas.md). Con un layout modal propio,
sólo se cargan esas inserciones; las de página no se trasladan a anclas diferentes.
Las extensiones sin contenido modal muestran sus campos automáticamente donde se
coloque ModelExtensions. Si el modal usa el fallback al formulario normal, cada
extensión conserva su contenido form salvo que declare `insertions.modal`, que lo
sustituye para esa presentación. `views.modal` puede convivir con `insertions.modal`
si el layout publica las anclas correspondientes.

La demo `/sample#form-dialog` compara el mismo subcontacto con un grupo compacto
en modal y pestañas en una vista de página de consulta; comparten esquema. Es una
demo ficticia de presentación, no una instalación de modelos ni persistencia real.

## Apertura de formularios desde TSX

Implementado el 2026-11-23 con `ModelFormButton`. Recibe `form` (referencia
estática generada), `view="modal"|"form"`, ID opcional, defaults escalares de
creación, origen persistido opcional y callback onSaved. Ambos layouts se presentan
en diálogo; view elige su contenido. No hay registro windowActions ni rutas nuevas.

`orm:sync` y la generación completa producen `src/generated/orm/forms/<módulo>`.
Para actualizar sólo referencias: `npm run orm:generate -- id --forms-only --write`;
sin --write revisa, --check detecta diferencias. No consulta la BD ni aplica SQL.
Los tipos incluyen escalares editables publicados y valores Selection; excluyen
identidad/revisión, campos sensibles, secuencias, virtuales y arrays. Las referencias
de una extensión apuntan al modelo base e incluyen sus campos más los del extensor;
no son referencias de la tabla compañera ni incluyen campos de otros extensores.

### Composición en servidor

`ModelRoute` prepara automáticamente las vistas form/modal del formulario actual y
los modales de sus colecciones readonly. Para destinos adicionales o páginas propias,
usar el componente servidor `ModelFormTargets forms={[Referencia]}` alrededor del
contenido que contiene los botones. Sólo prepara destinos legibles con entrada
directa, carga los loaders del manifest en servidor y conserva sus extensiones e
inserciones. Los proveedores anidados combinan sus destinos. No precarga todos los
modelos del ERP ni importa el registro servidor al cliente.

Esta composición es necesaria por el límite servidor/cliente de Next: las vistas
cliente deben formar parte del árbol RSC de la página, no devolverse como imports
nuevos desde una Server Action. El botón recibe sus slots por contexto; la acción
openModelForm devuelve sólo datos autorizados. Si falta un destino preparado, informa
el error en vez de abrir un formulario automático que perdería su personalización.
La configuración autorizada de cada apertura prevalece en ModelForm sobre el snapshot
del template; las operaciones de lectura/guardado vuelven a autorizarse.

### Apertura y guardado

La acción valida estrictamente destino, vista e identidad. Revalida sesión, grupo
de entrada, lectura y capacidad de crear al abrir una alta; al editar comprueba la
lectura del registro y respeta la consulta sin escritura. Si hay origin, exige ID
y lectura del registro de origen. No recibe actor, métodos, loaders ni SQL.

Defaults sólo en creación: hasta 50 escalares/16.000 caracteres JSON, públicos,
editables y permitidos por las políticas del actor. Rechaza nombres desconocidos,
identidad, secretos y campos protegidos; valida tipos y Many2one mediante el lookup
relacional autorizado y sus dominios. En edición los defaults no se utilizan.
El servicio de guardado sigue siendo la autoridad definitiva para relaciones,
reglas de registro, hooks, revisiones, permisos, transacción e historial.

`origin={{form:Referencia,id}}` desactiva el botón si falta ID persistido. No guarda
el origen automáticamente ni descarta sus borradores. Sus valores son propuestas:
las relaciones obligatorias/inmutables se exigen en el modelo o servicio.

El activador usa type=button, bloqueo del formulario padre, exclusión de dobles
clics e indicador de apertura. Tiene timeout de 15 segundos y reintento manual;
ignora la respuesta posterior al timeout o desmontaje, sin prometer cancelar SQL.
No reintenta escrituras. Reutiliza ModelFormModal/FormDialog para foco, cierre
protegido y bloqueo durante guardado. Un rechazo conserva el borrador del modal.

onSaved recibe ID/revisión confirmados y un Partial de los campos públicos tipados.
Cierra tras éxito; un fallo del callback de refresco informa que el registro ya se
guardó, sin mantenerlo abierto para duplicar el guardado. Para colecciones readonly
del formulario origen: `useModelChildCollectionsRefresh()` dentro de ModelForm,
como callback. Cambia el proveedor de consulta y conserva página/filtros/borradores;
no hace router.refresh ni guarda el principal. Las listas propias pueden usar su
propio callback de invalidación.

Ejemplo completo, creación relacionada y edición en
[/documentation#abrir-formularios-desde-un-boton-tsx](/documentation#abrir-formularios-desde-un-boton-tsx),
fuente [Crear módulos](crear-modulos.md). Demo ficticia en /sample#form-dialog:
mismo activador, respuestas JSON y modal, editor explícito sin modelos/BD reales.
