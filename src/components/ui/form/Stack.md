# Stack

Contenedor para organizar Fields en dos columnas con labels encima de los controles.
Admite `children`, atributos de `div`, `className` y únicamente `direction="block"`
(por defecto). No es necesario repetir direction en cada Field.

```tsx
import Stack from "@/components/ui/form/Stack";

<FormGroup legend="Datos generales" fullWidth>
  <Stack>
    <FieldText<Values> name="plate" />
    <FieldMany2One<Values> name="modeloId" />
    <FieldBoolean<Values> name="active" />
  </Stack>
</FormGroup>
```

También se puede usar directamente dentro de ModelForm/FormLayout, sin FormGroup.
La cuadrícula usa una columna cuando el ancho de Stack es menor de 24rem y dos
a partir de ese tamaño, independientemente del ancho de la pantalla. Mantiene el
orden de los hijos y separación uniforme. Un hijo con `className="col-span-full"`
puede ocupar ambas columnas; un widget header ya ocupa ese ancho.

Los Fields descendientes siempre usan dirección block, incluso si declaran inline
o están dentro de un componente propio o Fragment. Fuera de Stack conservan su
dirección habitual. Esta regla usa contexto, sin clonar hijos ni modificar sus props,
valores, validación o callbacks. Los componentes propios que dibujen controles sin
los Fields compartidos deben respetar por sí mismos la distribución acordada.

Stack sólo organiza: no crea un formulario, inputs ni un provider RHF. Los Fields
editables siguen necesitando FormLayout/ModelForm y conservan autocomplete off,
errores y la protección de cambios pendientes. No hace cálculos ni cambios en BD.

Demo con React Hook Form y Zod, validación/envío local y reset: `/sample#stack`.
