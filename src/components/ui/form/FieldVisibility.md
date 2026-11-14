# Invisible en Fields

Todos los Fields de formulario aceptan `invisible?: boolean`, incluidos los modos
display, el widget header, relaciones e imágenes. Oculta conjuntamente etiqueta y
control, sin dejar un hueco en Stack o en la cuadrícula de FormLayout.

```tsx
<FieldText<Values> name="name" invisible />
<FieldText<Values> name="notes" invisible={!showDetails} />
<FieldImage mode="display" name="fabricanteLogo" invisible={!showDetails} />
```

La condición se calcula en React (por ejemplo con useWatch); no se aceptan strings
de expresiones, funciones ni dominios en la declaración del modelo. Para una
condición dentro de un formulario ModelForm, usar un componente hijo que invoque
useFormContext/useWatch dentro del provider.

También se puede declarar el valor predeterminado en el modelo:

```ts
reference = Fields.Text({ label: "Referencia", invisible: true });
```

Los Fields enlazados al contrato heredan ese valor. `invisible={false}` lo anula
para una vista particular; omitir la prop (o undefined) conserva el valor heredado.
Las vistas automáticas y las expulsadas con eject usan el mismo mecanismo. En los
scaffolds con contratos generados hay que regenerar sus artefactos; los módulos
declarativos actuales lo leen en runtime, sin SQL ni orm:sync por este cambio.

Los controles permanecen montados y registrados en RHF, con sus valores, estado
dirty, callbacks, validación y autocomplete off. Ocultar no equivale a disabled,
unregister o borrar; Zod sigue validando y el valor se incluye al guardar.
Un campo obligatorio oculto necesita un valor válido de origen; el rechazo se
informa mediante las alertas habituales. Las ventanas auxiliares de búsqueda y
edición de imágenes no permanecen visibles cuando se oculta su Field.

`invisible` es presentación de formularios: no cambia ACL, publicación de datos,
lookup, auditoría ni columnas de colección. Para listas usar `list: false`; para
datos privados aplicar publicación y autorización del servidor. Un valor oculto
continúa en el navegador y puede verse con sus herramientas de desarrollo.

Demo con RHF/Zod, condición dinámica y override de metadatos: `/sample#field-invisible`.
