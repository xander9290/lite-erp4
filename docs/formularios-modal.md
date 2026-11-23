# Formularios en modal

Implementado el 2026-11-22 para modelos declarativos. Un subcontacto es un
registro independiente: abre su formulario, con sus extensiones y reglas,
en un diálogo sobre el principal. Guardarlo conserva el borrador del principal.
No requiere SQL por sí mismo.

## Colecciones de consulta

En el modelo o su extensión:

```ts
parentId = Fields.Many2one("Partner", {
  label: "Contacto principal",
  onDelete: "Restrict",
  domain: d => d.neq("id", d.record.id),
});
childIds = Fields.One2many("Partner", {
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
npm run eject:view -- contactosextra core.partner modal --dry-run
npm run eject:view -- contactosextra core.partner modal
```

Este último ya se ejecutó en el proyecto. Archivo editable:
`src/modules/contactosextra/views/CorePartnerModal.tsx`. El registro queda en el
manifest del extensor, junto a las inserciones existentes:

```ts
extends: {
  "core.partner": {
    model: PartnerExtra,
    views: { modal: () => import("./views/CorePartnerModal") },
    insertions: {
      form: () => import("./views/PartnerInsertions"),
      list: () => import("./views/PartnerListInsertions"),
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
La página principal de Contactos conserva su TSX e inserciones. No se han cambiado
defaults, permisos ni reglas del contacto. Eject rechaza archivos/vistas existentes,
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

## Pendiente posterior: apertura de formularios desde TSX

Reformulado el 2026-11-22 por decisión del usuario. Las vistas modales independientes
y su eject ya están implementados; la apertura desde TSX es el siguiente pendiente.
Esta sección describe el plan, sin API implementada. Criterio: negocio en modelos/servicios, presentación e interacción en React
y contratos comprobables con TypeScript. Incorporar patrones de otros ERP cuando
resuelvan una necesidad concreta, sin reproducir su arquitectura por inercia.

Propuesta inicial: un componente cliente explícito, con nombre provisional
`ModelFormButton`, que indique modelo destino, presentación/vista, ID opcional
para edición y defaults para creación. Ejemplo conceptual, no API disponible:

```tsx
<ModelFormButton
  model="ventas.entrega"
  view="modal"
  defaults={{ saleOrderId: record.id }}
>
  Agregar entrega
</ModelFormButton>
```

`ventas.entrega` sería otro modelo registrado con sus Fields, formulario, lógica
de negocio, restricciones, permisos y servicio de guardado. Desde un pedido
`sale.order`, `saleOrderId` propone su ID; la referencia se persiste al guardar
el destino con éxito. Es un ejemplo conceptual: no crear Ventas ni estos modelos.
Para subcontactos, la vista puede proponer `parentId` y `partnerType: "delivery"`.
ID de destino presente edita; ausente crea. Los defaults aplican sólo a creación
y no deben sobrescribir los valores persistidos de un registro abierto para editar.

Responsabilidades y plan:

- El modelo/servicio define negocio, relaciones, restricciones y autorización.
  El manifest registra modelos, dependencias, accesos y vistas; la vista TSX
  declara el botón, su presentación y las propuestas de valores iniciales.
- Reutilizar ModelFormModal y la resolución de vistas ya implementada,
  manteniendo loaders en servidor. Tipar referencias de modelo/vista y defaults
  con los contratos públicos del framework, sin importar clases server-only al
  cliente. Concretar nombres y props al implementarlo.
- El servidor resuelve sólo modelos/vistas registrados y revalida actor, permisos,
  reglas, campos, referencias y revisión. Defaults e IDs del navegador son propuestas,
  no autorización; si el flujo requiere datos del origen, validar su identidad y
  lectura en servidor. Una relación obligatoria o inmutable se exige en el modelo/
  servicio, no sólo mediante el botón o un campo prellenado.
- Si necesita el ID del principal, exigir primero su guardado explícito. Abrir y
  cancelar conservan su borrador y no lo guardan automáticamente. Mantener guardado
  independiente, bloqueo, errores, cierre protegido y foco del modal existente.
- Conectar un callback tipado tras éxito para refrescar las colecciones afectadas,
  reutilizando el mecanismo actual; no refrescar la página ni descartar borradores.
  Compartir botones repetidos mediante componentes o funciones TSX cuando se necesite.

La propuesta anterior de un registro `windowActions` y botones `FormOpen` por ID
queda fuera del alcance inicial. Sólo reconsiderarlo si un caso real demuestra
que la composición TSX no cubre una reutilización o resolución dinámica necesaria.
Las acciones de negocio publicadas existentes conservan su contrato; no reescribir
decoradores, relaciones, permisos ni el framework completo por este cambio de plan.

Criterios de aceptación: abrir creación/edición del mismo u otro modelo con la
vista elegida; Many2one prellenado y persistido tras validación; defaults sin efecto
en edición; errores de tipado para referencias/campos inválidos y rechazo servidor
ante IDs/valores alterados o permisos insuficientes; origen sin guardar, cancelación,
fallo de guardado y refresco tras éxito preservan las garantías del principal/modal.
Incluir demo ficticia y pruebas apropiadas al implementar.

Beneficio buscado: reducir cada apertura a una declaración TSX tipada, reutilizando
resolución, diálogo, carga y guardado existentes sin agregar un registro de acciones
ni otro lenguaje de configuración. Esta tarea sólo documenta el pendiente.
