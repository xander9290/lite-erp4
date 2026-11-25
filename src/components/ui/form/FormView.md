# FormView

Card de formulario con un único `FormLayout`/`FormProvider`. El header contiene Guardar, Revertir, `headerActions`, `menuActions` y `statebar`; el body organiza los `FormGroup` en una o dos columnas según el ancho disponible; `footer` permite contenido adicional.

`density="compact"` compacta controles y composición del body; por defecto
`density="normal"` conserva las medidas actuales. También disponible en ModelForm
y FormLayout. [Medidas, alcance y demo](FormLayout.md#densidad-opcional).

## Eliminación opcional

`deletion` añade «Eliminar» al menú de acciones del formulario:

```tsx
<FormView
  title="Fabricante"
  methods={methods}
  onSubmit={saveRecord}
  deletion={{ action: deleteRecords, returnHref: "/erp/flota/fabricante" }}
>
  {/* Fields */}
</FormView>
```

La acción recibe un array con un único `{id, revision}` de los últimos valores
guardados (`defaultValues`/`reset` de RHF), nunca el borrador editable. Debe devolver
`ListDeleteResult` y autorizar y comprobar la revisión en el servidor; la UI no
sustituye esas comprobaciones. Se oculta en creación, consulta o sin identidad y
revisión válidas. El scaffold conecta la acción `deleteRecords` existente; Flota
también está conectada. Otros formularios deben proporcionar su acción autorizada.

`deletion.allowReadOnly: true` permite eliminar un registro en consulta cuando
existe permiso independiente de eliminación. ModelForm lo conecta sólo con unlink.
Por defecto FormView manual mantiene oculta la eliminación en consulta.

Siempre pide una confirmación destructiva, que incluye descartar cambios y notas
pendientes de la página. Cancelar o fallar conserva los borradores y permanece en
el formulario. Sólo `ok: true, deleted: 1` confirma la eliminación. Ante un fallo de
red con resultado desconocido, se solicita recargar antes de volver a intentarlo;
no hay reintentos automáticos ni éxito optimista. Las restricciones de relaciones
del servidor se muestran sin forzar el borrado.

Tras el éxito usa `router.replace` para regresar a la colección de `returnTo`,
conservando su query (filtros/paginación). Sólo acepta rutas internas cuyo pathname
coincida exactamente con `returnHref` o `returnPaths`; no vuelve a detalles ni
URLs externas y no depende del historial del navegador. Si se abrió directamente
o el destino no está permitido, usa `returnHref`. Para variantes de una colección:

```tsx
deletion={{
  action: deleteRecords,
  returnHref: "/erp/flota/vehicle",
  returnPaths: ["/erp/flota/vehicle/tarjetas"],
}}
```

Si falla la navegación después de confirmar el borrado, se bloquea la edición y
se ofrece un enlace de retorno. No se eliminan automáticamente archivos remotos.
Demo RHF/Zod reversible, con cancelación/rechazo/consulta, en `/sample#form-deletion`.

## Acciones de formulario

`actionModel` (nombre del contrato), `runAction(name, {id, revision})` y `actions`
(nombres y labels publicados) habilitan
`FormHeader` y `FormButton`. FormHeader se monta en la cabecera mediante portal,
dentro del contexto RHF. FormButton (`type="button"`) se oculta en consulta y comparte
un único bloqueo síncrono con Guardar y los demás botones. Si se proporciona
`actions`, sólo muestra/ejecuta nombres publicados; una lista vacía no habilita
acciones. Desde 2026-11-22, FormButton exige referencias generadas como
`action={ventaActions.confirmar}`, ya no strings. Sin actionModel/snapshot o con
una referencia de otro modelo, se oculta. ModelForm conecta el nombre del contrato
automáticamente; los formularios manuales lo declaran. Tipado y generación en
[Acciones de formulario](../../../../docs/ideas/acciones-formulario.md#referencias-tipadas-y-generación-2026-11-22).
FormHeader deshabilita sus controles en consulta, incluido statebar:


1. Registro nuevo o con cambios: envía el formulario y espera el ciclo normal
   (reacciones, validación, guardado). Si falla, la acción no se ejecuta.
2. Registro limpio en edición: usa la identidad guardada, sin reescribir.
3. Ejecuta `runAction` con la revisión persistida. Éxito: reset, historial, toast y
   `onSaved`. Fallo: errores por campo y alerta, conservando lo guardado. Error de
   red: alerta, sin éxito aparente ni reintento.

FormLayout previene el envío nativo de forma síncrona antes de esperar reacciones:
un submit programático, o una reacción pendiente, podía dejar pasar un GET con los
valores en la URL. ModelForm conecta todo desde su configuración.
Demo ficticia: `/sample#form-actions`. Contrato de servidor en
[Acciones de formulario](../../../../docs/ideas/acciones-formulario.md).

En FormHeader, FieldSelect con widget statebar ocupa sólo su ancho necesario y
se alinea a la derecha, centrado verticalmente junto a los botones cuando caben.
Con poco espacio pasa a otra línea y conserva scroll horizontal dentro del
control. Separación y padding superior de esa fila: 8px. Fuera de FormHeader el
Field mantiene su ancho normal; no hace falta personalizar cada vista.

## Presentación

El header es compacto: navegación y acciones comparten fila cuando hay espacio,
sin bloque visible de icono, título, descripción ni badge de cambios. `title` sigue
siendo obligatorio como encabezado accesible; `description` e `icon` se aceptan
por compatibilidad, pero no se renderizan. El estado del formulario permanece en
el footer. Las acciones adicionales y el `statebar` conservan su fila propia.

El nombre de presentación del servidor llega separado de los valores editables:
FormViewLoader entrega `(values, audit, displayName)` y FormView llama
`onSaved(values, audit, displayName)`. Los callbacks anteriores siguen siendo
compatibles. La vista puede mantener ese texto para sus breadcrumbs; el scaffold
ya lo conecta y lo actualiza sólo tras guardar. No pasarlo a reset/defaultValues
ni registrarlo como Field de RHF. Contrato en [Nombres de presentación](../../../../docs/nombres-presentacion.md).

Por defecto, la tarjeta está centrada, ocupa el ancho disponible hasta `max-w-5xl`
(64rem) y su altura depende del contenido. Para formularios con tablas o más columnas,
usa `width="wide"` (máximo 80rem, `max-w-7xl`); ejemplo en `/sample#field-one2many`.
En pantallas pequeñas ambas variantes se ajustan al ancho del padre. El scroll vertical
de formularios largos corresponde al contenedor de la página, no a una altura fija
de FormView cuando usa `layout="content"` (default).

En las páginas del ERP, usar `layout="page"` y montar la vista directamente bajo
el layout, sin wrappers con padding ni ancho máximo. Así ocupa el área debajo del
Top, mantiene header/footer visibles y desplaza el body. `FormViewLoader` transmite
esa altura al editor. `breadcrumbs={[{label: "Contactos", href: "/erp/contactos"},
{label: "Nuevo contacto"}]}` integra la navegación en el header y conserva el guard
de cambios pendientes. En `layout="page"`, la hoja de campos aprovecha todo el
ancho disponible hasta la auditoría, sin límite normal/wide. `width` sólo limita
el ancho de la tarjeta y su hoja en `layout="content"`.
La hoja de campos se alinea a la izquierda del body, con separación exterior de
8px en móvil y 12px desde `sm`; los FormGroup conservan su padding interior.
La grilla admite un máximo de dos columnas: desde 42rem de ancho de la hoja,
dos FormGroup normales comparten fila; por debajo se apilan. La separación entre
grupos es de 8px tanto horizontal como vertical. Un grupo único
ocupa una columna, dejando libre la segunda en escritorio. `fullWidth` permite ocupar las
dos columnas incluso si hay otros; omitirlo para colocarlos lado a lado.

Los Fields con `direction="inline"` comparten una columna de label de 7rem
(112px), separación de 8px y control que ocupa el resto. El label se alinea a la
izquierda y al centro vertical del control; los textos largos se parten en líneas.
Así el espacio entre label y control no crece al ensanchar el formulario.

`audit={recordAudit}` presenta creador/avatar, creación y última actualización en
una columna lateral derecha de 18rem desde 56rem de ancho del formulario, separada
por un borde y extendida a todo el alto del body, sin tarjeta interior ni márgenes.
Con `layout="page"`, campos y auditoría tienen scroll independiente en escritorio;
header y footer permanecen visibles. En anchos menores la auditoría se coloca
debajo de los campos, con separador superior y scroll compartido del body.
La hoja de campos calcula sus columnas con su propio ancho disponible. Sin `audit`
no se reserva panel; `audit={null}` permite mostrar el aviso previo al primer guardado
en modo creación. Los datos autorizados permanecen fuera de RHF, defaults y payload;
el editor mantiene el estado y lo actualiza con `onSaved(values, audit)`.
Ejemplo RHF/Zod con autor nulo y guardado local en `/sample#record-audit`.

`activity={{ recordId, load, addNote }}` añade historial y notas en esa columna,
ampliándola a 24rem y sustituyendo el resumen superior de creador/fechas por el
historial, con avatar junto al autor de cada entrada. Se actualiza tras guardar sin resetear borradores de nota ni
valores del formulario. Las notas tienen guard de salida independiente de RHF;
antes del primer guardado no se habilitan. La creación sólo muestra «Registro
creado» y las diferencias aparecen al guardar ediciones. No hay refresco periódico
del historial. Las acciones deben autorizar en servidor.
Contrato y límites en [Actividad de registros](../../../../docs/actividad-registros.md).

```tsx
"use client";

const methods = useForm<Values>({
  resolver: zodResolver(schema),
  defaultValues: savedRecord,
});

<FormView
  title="Documento"
  methods={methods}
  onSubmit={saveDocument}
  menuActions={({ isDirty, busy }) => [
    { id: "print", label: "Imprimir reporte", disabled: isDirty || busy, onSelect: prepareReport },
  ]}
  headerActions={({ isDirty, busy }) => (
    <button type="button" disabled={isDirty || busy} onClick={confirmDocument}>
      Confirmar
    </button>
  )}
  statebar={
    <FieldSelect name="state" widget="statebar" options={states} aria-label="Estado" />
  }
  footer={<p>Información adicional</p>}
>
  <FormGroup legend="Datos">
    <FieldText name="name" label="Nombre" />
  </FormGroup>
</FormView>
```

## Guardado y cambios

### Nuevo registro desde el formulario

Pasa `onNew` para mostrar el botón «Nuevo» en el header (`newLabel="Crear"` cambia
su texto). FormView confirma los cambios pendientes antes de ejecutar el callback y
bloquea los controles durante la operación. Sin `onNew` el botón no se muestra.

El callback puede navegar directamente a la ruta de alta, como en Usuarios, o iniciar
un alta en la misma vista con `methods.reset(newDefaults)` y `mode="create"`. Los
defaults de alta deben omitir el ID/revisión del registro anterior y establecer los
valores iniciales de cada modelo. Tras guardar, cambiar a `mode="edit"`. Ejemplo con
Zod y limpieza de Fields/Notebook en `/sample#form-view`.

```tsx
<FormView
  methods={methods}
  title={creating ? "Nuevo registro" : "Editar registro"}
  mode={creating ? "create" : "edit"}
  onNew={creating ? undefined : () => {
    methods.reset(newDefaults);
    setCreating(true);
  }}
  onSubmit={saveRecord}
/>
```

Usuarios usa `router.bfcacheId` como key del editor para que una navegación nueva a
`/erp/usuarios/nuevo` no recupere un alta anterior desde la caché de Next.js. La ruta
queda en modo creación y usa `newUserDefaults`, sin copiar los permisos del usuario
abierto.

FormView protege automáticamente la navegación cuando RHF indica `isDirty`,
también si cambia a `readOnly` con un borrador pendiente. Requiere `FormNavigationProvider` dentro de AlertProvider en el
layout raíz, montado antes de layouts asíncronos. Los enlaces internos, cambios por
router y Atrás/Adelante muestran «Cambios sin guardar»: «Seguir editando» conserva
los valores; «Salir sin guardar» restaura el último punto guardado antes de continuar,
para que la caché de navegación tampoco recupere un borrador descartado. Guardar con éxito o Revertir
limpia la protección antes de ejecutar los callbacks. Un guardado rechazado conserva
el bloqueo. Abrir otra pestaña o descargar un archivo no abandona el formulario.

Cerrar/recargar la pestaña solicita el aviso nativo del navegador; su texto no puede
personalizarse y su aparición depende del navegador (especialmente en móviles o
salidas externas en Safari). Es una prevención de pérdidas accidentales, no un
autoguardado.

Las acciones que abandonan la vista después de un efecto deben confirmar **antes**
del efecto. Por ejemplo, LogoutButton usa `useFormNavigation().run(async () => { ... })`
para confirmar antes de cerrar la sesión y evitar una segunda pregunta al navegar.
Para un modal anidado, usa `FormDialog` y `<FormDialogLock />` dentro de FormView:
su scope confirma y descarta sólo ese borrador, preservando el del principal.
`ModelFormModal` lo conecta automáticamente. [Contrato y ejemplos](../../../../docs/formularios-modal.md).
Las llamadas
directas a `history.pushState`/`replaceState` y las redirecciones impuestas por el
servidor quedan fuera de la navegación cliente interceptada. Si un Link necesita
`replace`, `scroll` o callbacks propios, usa `NavigationGuardLink` de `nextjs-nav-guard`
para conservar esas opciones cuando haya cambios pendientes.

Ejemplo funcional: modifica `/sample#form-view` y usa su enlace de salida «Inicio de
sesión». La integración utiliza `nextjs-nav-guard` 1.1.3, compatible con Next.js 16.

`onSubmit` recibe los datos validados (incluidas las transformaciones de Zod) y debe devolver `FormViewResult<Values>`. Requiere el AlertProvider instalado en el layout raíz:

```ts
// Después de persistir y releer el registro:
return { ok: true, values: savedRecord, message: "Documento guardado." };

// Un rechazo conserva los cambios y el último punto de restauración:
return { ok: false, kind: "validation", error: "Revisa los datos.", fieldErrors: { name: "Nombre duplicado." } };
```

`values` debe ser el objeto completo para los Fields, con los tipos de entrada de RHF. Si el resolver transforma a otro tipo de salida, convierte el registro guardado al tipo de entrada antes de devolverlo.

En éxito, después de finalizar `handleSubmit`, `reset(values)` establece los nuevos defaults y limpia `isDirty`. Revertir usa `reset()` para volver a ese punto. La validación local usa los toasts existentes; los rechazos del servidor muestran un diálogo «Error de validación» con `kind="validation"` o si contienen `fieldErrors`, sin resetear el formulario. Los errores generales usan `kind="server"`; las excepciones muestran un mensaje genérico y permiten reintentar. No pongas otro `<form>` o `FormLayout` dentro de FormView.

`mode="edit"` (default) impide guardar sin cambios. Usa `mode="create"` para permitir el primer guardado con los defaults; cambia a `edit` tras crear. `onSaved(values)` sirve para actualizar el registro local o navegar, y `onRevert()` para limpiar estados auxiliares. No uses `reset()` dentro de `onSubmit`.

`busy` bloquea Fields y botones durante acciones externas. `disabled` bloquea la vista completa; `readOnly` bloquea los Fields y oculta Guardar/Revertir, dejando disponibles las acciones de consulta. Los slots `headerActions` y `footer` aceptan nodos o funciones con `{ methods, isDirty, busy, readOnly }`. Los botones de acciones deben usar `type="button"`; las acciones asíncronas deben establecer `busy` y manejar sus errores.

`menuActions` agrupa acciones secundarias, como imprimir o exportar, en un dropdown con engrane junto a Guardar/Revertir. Acepta un arreglo o una función del mismo contexto; cada acción tiene `id`, `label`, `onSelect` y opcionalmente `icon` y `disabled`. El menú se cierra al elegir una acción, pulsar Escape o salir de él. Las acciones principales permanecen en `headerActions`. Si no hay elementos, no se muestra el engrane.

## Navegar entre registros (2026-11-25)

`pager={{ position, total, onPrevious, onNext }}` muestra «3 / 12» con flechas
anterior/siguiente junto a los breadcrumbs. Cada movimiento pasa por el guard de
cambios sin guardar (`useFormNavigation().run`), como «Nuevo». Sin `onPrevious` u
`onNext`, esa flecha queda desactivada; mientras guarda o ejecuta se bloquean.

ModelForm lo conecta solo: cuando la página de lista o tarjetas que lo abrió está
recordada (`src/components/ui/collection/recordPager.ts`), recorre **los registros
de esa página** en el orden mostrado (búsqueda, filtros, orden, pantalla). Al llegar
al primero/último de la página se desactiva; cambiar de página se hace en la lista.

- `useListView` guarda en `sessionStorage` los IDs de cada página cargada bajo su
  URL (hasta 20 páginas por pestaña); el formulario busca su `returnTo` validado.
- Es presentación: cada registro se abre con la lectura autorizada habitual. Sin
  página recordada (enlace directo, otra pestaña, almacenamiento bloqueado), con
  listas agrupadas, kanban, modales o un registro nuevo no aparece.
- La página recordada es la que se vio: si después cambian los datos, el orden no
  se recalcula hasta volver a la lista.

## FieldSelect statebar

`widget="statebar"` tiene prioridad sobre `type` y conserva el valor original `string | number`, el `onChange(value)` y la integración RHF. Por defecto es de solo lectura: `aria-current="step"` identifica el estado actual. No asume que todos los estados anteriores están completados ni ejecuta transiciones de negocio.

Para selección manual, agrega `readOnly={false}`. Usa radios nativos accesibles por teclado, respeta opciones `disabled` y participa en `isDirty`, validación y `reset`. El contenido se desplaza horizontalmente en espacios estrechos. Sin `widget`, dropdown y optional conservan su funcionamiento.

Las transiciones reales deben autorizarse en servidor contra el estado persistido y devolver el registro actualizado; entonces la acción puede llamar a `methods.reset(record)`. El widget no expone modelos ni aplica permisos.

Ejemplos con Zod en `/sample#form-view` y `/sample#field-select-statebar`. Las acciones de la demo validan, normalizan, cambian estados y preparan un reporte imprimible sin escribir en base de datos. No representan un sistema de persistencia o autorización.

Para organizar los Fields en pestañas, coloca `Notebook` y `NotebookPage` dentro del body. Comparten el contexto RHF y el guardado; consulta [Notebook.md](./Notebook.md).

Para cargar registros antes de mostrarlos, usa FormViewLoader. Consulta [alertas y carga de registros](../alerts/README.md).


El contrato enlazado y las nuevas APIs de presentación se documentan en
[Contratos de vistas](../../../../docs/contratos-vistas.md).

## Carga y guardado discretos (2026-11-15)

FormViewLoader ya no abre alerts.loading. Antes de recibir el registro muestra
un marco del formulario con placeholders estáticos e indicador «Cargando registro…»
en la cabecera, sin modal ni backdrop. No monta Fields editables con datos vacíos
o del registro anterior. Cargas posteriores/reintentos usan el mismo estado;
conserva timeout, descarte de respuestas antiguas, errores autorizados y Reintentar.
No se cancela en servidor una Server Action que ya fue enviada.

FormView conserva visible el formulario al guardar, con Fields, statebar y acciones
bloqueados mediante los fieldsets existentes y aria-busy. La cabecera indica
«Guardando cambios…» con spinner discreto, junto al botón Guardando y el estado
del footer. El texto añadido es visual; el footer conserva el anuncio accesible
para evitar duplicarlo. Otros estados busy muestran su indicación correspondiente.
No se modifica el ciclo de validación/guardado, locks, borrador, revisión ni dirty
guard. Los errores y confirmaciones mantienen sus diálogos; alerts.loading sigue
disponible para otros flujos explícitos. No cambia la confirmación de eliminación.

Ejemplos existentes /sample#alerts y /sample#form-view; carga/guardado de ejemplo
incluyen 600 ms de latencia ficticia para observar el bloqueo, sin escrituras de BD.

## Acciones con parámetros

Las acciones publicadas pueden incluir params (metadatos de Fields) y lookups.
FormButton solicita esos argumentos con RHF/Zod separado antes de guardar. Cancelar
no escribe; confirmar conserva el flujo guardar → ejecutar con revisión persistida.
FormActionRunner recibe `(action, target, params?)`. Los parameterErrors no se
registran en RHF del documento. El diálogo es hermano de FormLayout, nunca un form
anidado. Contrato, cancelación y límites: [acciones con parámetros](../../../../docs/acciones-parametros.md).


## Confirmación opcional de FormButton

`<FormButton action={acciones.archivar} confirm="¿Archivar este registro?" />`
usa useAlerts antes de parámetros, validación/guardado y acción. Cancelar conserva
borradores sin escrituras. Sin texto no pregunta. Un lock cubre el ciclo completo;
al volver de los diálogos se comprueba que el registro y la acción sigan vigentes.
Confirm es presentación; el servidor conserva autorización y revisión. No se
reintentan mutaciones automáticamente. Ejemplos en /sample#form-actions,
/sample#action-parameters y [el contrato](../../../../docs/ideas/acciones-formulario.md#confirmación-en-formbutton-2026-11-23).
