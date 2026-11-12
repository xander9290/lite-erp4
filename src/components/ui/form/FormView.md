# FormView

Card de formulario con un único `FormLayout`/`FormProvider`. El header contiene Guardar, Revertir, `headerActions`, `menuActions` y `statebar`; el body organiza los `FormGroup` en una o dos columnas según el ancho disponible; `footer` permite contenido adicional.

El header es compacto: navegación y acciones comparten fila cuando hay espacio,
sin bloque visible de icono, título, descripción ni badge de cambios. `title` sigue
siendo obligatorio como encabezado accesible; `description` e `icon` se aceptan
por compatibilidad, pero no se renderizan. El estado del formulario permanece en
el footer. Las acciones adicionales y el `statebar` conservan su fila propia.

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

FormView protege automáticamente la navegación cuando RHF indica `isDirty`, salvo
en modo `readOnly`. Requiere `FormNavigationProvider` dentro de AlertProvider en el
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
Usa ese mismo método al cerrar manualmente un modal con un formulario. Las llamadas
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

## FieldSelect statebar

`widget="statebar"` tiene prioridad sobre `type` y conserva el valor original `string | number`, el `onChange(value)` y la integración RHF. Por defecto es de solo lectura: `aria-current="step"` identifica el estado actual. No asume que todos los estados anteriores están completados ni ejecuta transiciones de negocio.

Para selección manual, agrega `readOnly={false}`. Usa radios nativos accesibles por teclado, respeta opciones `disabled` y participa en `isDirty`, validación y `reset`. El contenido se desplaza horizontalmente en espacios estrechos. Sin `widget`, dropdown y optional conservan su funcionamiento.

Las transiciones reales deben autorizarse en servidor contra el estado persistido y devolver el registro actualizado; entonces la acción puede llamar a `methods.reset(record)`. El widget no expone modelos ni aplica permisos.

Ejemplos con Zod en `/sample#form-view` y `/sample#field-select-statebar`. Las acciones de la demo validan, normalizan, cambian estados y preparan un reporte imprimible sin escribir en base de datos. No representan un sistema de persistencia o autorización.

Para organizar los Fields en pestañas, coloca `Notebook` y `NotebookPage` dentro del body. Comparten el contexto RHF y el guardado; consulta [Notebook.md](./Notebook.md).

Para cargar registros antes de mostrarlos, usa FormViewLoader. Consulta [alertas y carga de registros](../alerts/README.md).


El contrato enlazado y las nuevas APIs de presentación se documentan en
[Contratos de vistas](../../../../docs/contratos-vistas.md).
